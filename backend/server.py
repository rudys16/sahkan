from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response as FastResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import json
import hmac
import base64
import hashlib
import logging
import uuid
from pathlib import Path
from typing import Optional
from datetime import datetime, timezone, timedelta

import jwt
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# ---------------------------------------------------------------------------
# Config / environment
# ---------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALG = 'HS256'
DEV_OTP = os.environ.get('DEV_OTP', '123456')
ADMIN_EMAIL = os.environ['ADMIN_EMAIL'].lower()
ADMIN_PASSWORD = os.environ['ADMIN_PASSWORD']
BLOB_KEY = bytes.fromhex(os.environ['BLOB_ENCRYPTION_KEY'])
SIGNING_KEY_ID = os.environ['SIGNING_KEY_ID']
SIGNING_KEY_PRIVATE_PEM = base64.b64decode(os.environ['SIGNING_KEY_PRIVATE_B64'])
SIGNING_KEY_PUBLIC_PEM = base64.b64decode(os.environ['SIGNING_KEY_PUBLIC_B64'])
_signing_private_key = serialization.load_pem_private_key(SIGNING_KEY_PRIVATE_PEM, password=None)

GENESIS_PREV_HASH = '0' * 64

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger('sahkan')

app = FastAPI(title='Sahkan')
api = APIRouter(prefix='/api')


# ---------------------------------------------------------------------------
# Crypto helpers (Python stdlib equivalent of node:crypto)
# ---------------------------------------------------------------------------
def scrypt_hash(secret: str) -> str:
    salt = os.urandom(16)
    dk = hashlib.scrypt(secret.encode(), salt=salt, n=16384, r=8, p=1, dklen=32)
    return f"{salt.hex()}:{dk.hex()}"


def scrypt_verify(secret: str, stored: str) -> bool:
    try:
        salt_hex, hash_hex = stored.split(':')
        dk = hashlib.scrypt(secret.encode(), salt=bytes.fromhex(salt_hex), n=16384, r=8, p=1, dklen=32)
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical_json(obj: dict) -> str:
    return json.dumps(obj, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def aes_encrypt(plaintext: bytes) -> str:
    nonce = os.urandom(12)
    ct = AESGCM(BLOB_KEY).encrypt(nonce, plaintext, None)
    return base64.b64encode(nonce + ct).decode()


def aes_decrypt(blob_b64: str) -> bytes:
    raw = base64.b64decode(blob_b64)
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(BLOB_KEY).decrypt(nonce, ct, None)


def ecdsa_sign(envelope: dict) -> str:
    message = canonical_json(envelope).encode()
    sig = _signing_private_key.sign(message, ec.ECDSA(hashes.SHA384()))
    return sig.hex()


def build_merkle_root(leaves: list) -> str:
    """Binary Merkle tree over hex leaf hashes.
    Odd-node rule: a lone node at any level is PROMOTED up unchanged (one deterministic rule).
    """
    if not leaves:
        return sha256_hex(b'')
    level = list(leaves)
    while len(level) > 1:
        nxt = []
        for i in range(0, len(level), 2):
            if i + 1 < len(level):
                combined = bytes.fromhex(level[i]) + bytes.fromhex(level[i + 1])
                nxt.append(sha256_hex(combined))
            else:
                nxt.append(level[i])  # promote lone node unchanged
        level = nxt
    return level[0]


def scan_pdf(buf: bytes) -> dict:
    """Non-destructive risk scan by scanning raw bytes. The file is NEVER modified."""
    return {
        'hasJavascript': (b'/JavaScript' in buf) or (b'/JS' in buf) or (b'/OpenAction' in buf) or (b'/AA' in buf),
        'hasFormFields': (b'/AcroForm' in buf),
        'hasEmbeddedFiles': (b'/EmbeddedFile' in buf) or (b'/EmbeddedFiles' in buf),
        'hasExternalRefs': (b'/URI' in buf) or (b'/Launch' in buf) or (b'/GoToR' in buf),
    }


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def iso(dt: datetime) -> str:
    return dt.isoformat()


# ---------------------------------------------------------------------------
# JWT / cookie helpers
# ---------------------------------------------------------------------------
def create_token(user: dict) -> str:
    payload = {
        'userId': user['_id'],
        'role': user['role'],
        'institutionId': user.get('institutionId'),
        'exp': now_utc() + timedelta(hours=24),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key='access_token', value=token, httponly=True, secure=True,
        samesite='none', max_age=86400, path='/',
    )


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get('access_token')
    if not token:
        raise HTTPException(status_code=401, detail='Belum masuk')
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail='Sesi kedaluwarsa')
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail='Token tidak valid')
    user = await db.users.find_one({'_id': payload['userId']})
    if not user:
        raise HTTPException(status_code=401, detail='Pengguna tidak ditemukan')
    return user


def require_role(*roles):
    async def dep(user: dict = Depends(get_current_user)):
        if user['role'] not in roles:
            raise HTTPException(status_code=403, detail='Akses ditolak')
        return user
    return dep


async def require_authority_active(user: dict = Depends(get_current_user)):
    if user['role'] != 'AUTHORITY':
        raise HTTPException(status_code=403, detail='Akses ditolak')
    if user.get('approvalStatus') != 'ACTIVE':
        raise HTTPException(status_code=403, detail='Akun penerbit belum disetujui admin')
    return user


# ---------------------------------------------------------------------------
# Audit chain (WORM, insert-only, hash-chained)
# ---------------------------------------------------------------------------
async def append_audit(event_type: str, actor_id: Optional[str], actor_role: Optional[str],
                       doc_hash: Optional[str], institution_id: Optional[str], detail: dict):
    state = await db.chainState.find_one({'_id': 'chain'})
    prev_hash = state['headLogHash'] if state else GENESIS_PREV_HASH
    log_id = str(uuid.uuid4())
    created_at = iso(now_utc())
    fields = {
        'logId': log_id,
        'eventType': event_type,
        'docHash': doc_hash,
        'actorId': actor_id,
        'actorRole': actor_role,
        'institutionId': institution_id,
        'detail': detail,
        'prevLogHash': prev_hash,
        'createdAt': created_at,
    }
    log_hash = sha256_hex((canonical_json(fields) + prev_hash).encode())
    record = {**fields, 'logHash': log_hash, '_id': log_id}
    await db.auditChain.insert_one(record)
    await db.chainState.update_one(
        {'_id': 'chain'},
        {'$set': {'headLogHash': log_hash, 'headLogId': log_id, 'updatedAt': created_at}},
        upsert=True,
    )
    return record


def recompute_log_hash(entry: dict) -> str:
    fields = {
        'logId': entry['logId'],
        'eventType': entry['eventType'],
        'docHash': entry.get('docHash'),
        'actorId': entry.get('actorId'),
        'actorRole': entry.get('actorRole'),
        'institutionId': entry.get('institutionId'),
        'detail': entry.get('detail'),
        'prevLogHash': entry['prevLogHash'],
        'createdAt': entry['createdAt'],
    }
    return sha256_hex((canonical_json(fields) + entry['prevLogHash']).encode())


# ---------------------------------------------------------------------------
# Serialization helpers
# ---------------------------------------------------------------------------
def public_user(u: dict) -> dict:
    return {
        'userId': u['_id'], 'email': u['email'], 'role': u['role'],
        'institutionId': u.get('institutionId'), 'approvalStatus': u.get('approvalStatus'),
        'isVerified': u.get('isVerified', False),
    }


def domain_suffix_match(email_domain: str, inst_domain: str) -> bool:
    email_domain = email_domain.lower()
    inst_domain = inst_domain.lower()
    return email_domain == inst_domain or email_domain.endswith('.' + inst_domain)


# ---------------------------------------------------------------------------
# AUTH endpoints
# ---------------------------------------------------------------------------
@api.post('/auth/otp/request')
async def otp_request(body: dict):
    email = (body.get('email') or '').strip().lower()
    purpose = body.get('purpose')
    if '@' not in email or '.' not in email.split('@')[-1]:
        raise HTTPException(status_code=422, detail='Format email tidak valid')
    if purpose not in ('OWNER_AUTH', 'AUTHORITY_LOGIN'):
        raise HTTPException(status_code=422, detail='Tujuan tidak valid')
    session_id = str(uuid.uuid4())
    await db.otpSessions.insert_one({
        '_id': session_id, 'sessionId': session_id, 'email': email, 'purpose': purpose,
        'otpHash': scrypt_hash(DEV_OTP), 'attempts': 0, 'isVerified': False,
        'expiresAt': now_utc() + timedelta(minutes=5), 'createdAt': iso(now_utc()),
    })
    return {'sessionId': session_id, 'devMode': True, 'message': 'Kode OTP demo: 123456'}


@api.post('/auth/otp/verify')
async def otp_verify(body: dict, response: Response):
    email = (body.get('email') or '').strip().lower()
    purpose = body.get('purpose')
    otp = (body.get('otp') or '').strip()
    session = await db.otpSessions.find_one(
        {'email': email, 'purpose': purpose, 'isVerified': False},
        sort=[('createdAt', -1)],
    )
    if not session:
        raise HTTPException(status_code=400, detail='Sesi OTP tidak ditemukan. Minta kode baru.')
    exp = session['expiresAt']
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if exp < now_utc():
        raise HTTPException(status_code=400, detail='Kode OTP kedaluwarsa')
    if session['attempts'] >= 5:
        raise HTTPException(status_code=429, detail='Terlalu banyak percobaan. Minta kode baru.')
    if not scrypt_verify(otp, session['otpHash']):
        await db.otpSessions.update_one({'_id': session['_id']}, {'$inc': {'attempts': 1}})
        raise HTTPException(status_code=400, detail='Kode OTP salah')
    await db.otpSessions.update_one({'_id': session['_id']}, {'$set': {'isVerified': True}})
    await db.otpSessions.delete_many({'email': email, 'purpose': purpose, '_id': {'$ne': session['_id']}})

    email_domain = email.split('@')[-1]
    user = await db.users.find_one({'email': email})
    if not user:
        role = 'OWNER' if purpose == 'OWNER_AUTH' else 'AUTHORITY'
        approval = 'ACTIVE' if role == 'OWNER' else 'PENDING'
        user = {
            '_id': str(uuid.uuid4()), 'email': email, 'emailDomain': email_domain,
            'role': role, 'institutionId': None, 'approvalStatus': approval,
            'approvedBy': None, 'approvedAt': None, 'isVerified': True, 'createdAt': iso(now_utc()),
        }
        await db.users.insert_one(user)
    else:
        await db.users.update_one({'_id': user['_id']}, {'$set': {'isVerified': True}})

    token = create_token(user)
    set_auth_cookie(response, token)
    return {'user': public_user(user)}


@api.post('/auth/admin/login')
async def admin_login(body: dict, response: Response):
    email = (body.get('email') or '').strip().lower()
    password = body.get('password') or ''
    ident = f'admin:{email}'
    attempt = await db.login_attempts.find_one({'_id': ident})
    if attempt and attempt.get('lockedUntil'):
        lu = attempt['lockedUntil']
        if lu.tzinfo is None:
            lu = lu.replace(tzinfo=timezone.utc)
        if lu > now_utc():
            raise HTTPException(status_code=429, detail='Akun terkunci. Coba lagi dalam beberapa menit.')

    user = await db.users.find_one({'email': email, 'role': 'ADMIN'})
    if not user or not scrypt_verify(password, user.get('passwordHash', '')):
        count = (attempt.get('count', 0) if attempt else 0) + 1
        update = {'count': count}
        if count >= 5:
            update['lockedUntil'] = now_utc() + timedelta(minutes=15)
        await db.login_attempts.update_one({'_id': ident}, {'$set': update}, upsert=True)
        raise HTTPException(status_code=401, detail='Email atau kata sandi salah')

    await db.login_attempts.delete_one({'_id': ident})
    token = create_token(user)
    set_auth_cookie(response, token)
    return {'user': public_user(user)}


@api.post('/auth/logout')
async def logout(response: Response):
    response.delete_cookie('access_token', path='/')
    return {'ok': True}


@api.get('/auth/me')
async def me(user: dict = Depends(get_current_user)):
    inst = None
    if user.get('institutionId'):
        inst = await db.institutions.find_one({'_id': user['institutionId']})
    result = public_user(user)
    result['institution'] = {'name': inst['name'], 'domain': inst['domain'], 'status': inst['status']} if inst else None
    return result


# ---------------------------------------------------------------------------
# INSTITUTIONS
# ---------------------------------------------------------------------------
@api.get('/institutions/active')
async def active_institutions():
    docs = await db.institutions.find({'status': 'ACTIVE'}).sort('name', 1).to_list(500)
    return [{'institutionId': d['_id'], 'name': d['name'], 'domain': d['domain']} for d in docs]


@api.post('/institutions')
async def create_institution(body: dict, user: dict = Depends(require_role('AUTHORITY'))):
    name = (body.get('name') or '').strip()
    domain = (body.get('domain') or '').strip().lower()
    if not name or not domain:
        raise HTTPException(status_code=422, detail='Nama dan domain wajib diisi')
    if not domain_suffix_match(user['emailDomain'], domain):
        raise HTTPException(status_code=422, detail='Domain institusi harus cocok dengan domain email Anda')
    if await db.institutions.find_one({'$or': [{'name': name}, {'domain': domain}]}):
        raise HTTPException(status_code=409, detail='Institusi dengan nama/domain ini sudah ada')
    inst_id = str(uuid.uuid4())
    await db.institutions.insert_one({
        '_id': inst_id, 'institutionId': inst_id, 'name': name, 'domain': domain,
        'status': 'PENDING', 'createdBy': user['_id'], 'createdAt': iso(now_utc()),
        'decidedBy': None, 'decidedAt': None,
    })
    await db.users.update_one({'_id': user['_id']}, {'$set': {'institutionId': inst_id, 'approvalStatus': 'PENDING'}})
    await append_audit('ADMIN_ACTION', user['_id'], 'AUTHORITY', None, inst_id,
                       {'action': 'INSTITUTION_CREATE', 'name': name, 'domain': domain})
    return {'institutionId': inst_id, 'status': 'PENDING'}


@api.post('/institutions/join')
async def join_institution(body: dict, user: dict = Depends(require_role('AUTHORITY'))):
    inst_id = body.get('institutionId')
    inst = await db.institutions.find_one({'_id': inst_id})
    if not inst:
        raise HTTPException(status_code=404, detail='Institusi tidak ditemukan')
    if not domain_suffix_match(user['emailDomain'], inst['domain']):
        raise HTTPException(status_code=422, detail='Domain email Anda tidak cocok dengan institusi ini')
    await db.users.update_one({'_id': user['_id']}, {'$set': {'institutionId': inst_id, 'approvalStatus': 'PENDING'}})
    await append_audit('ADMIN_ACTION', user['_id'], 'AUTHORITY', None, inst_id, {'action': 'INSTITUTION_JOIN'})
    return {'institutionId': inst_id, 'status': 'PENDING'}


# ---------------------------------------------------------------------------
# ADMIN
# ---------------------------------------------------------------------------
@api.get('/admin/pending-authorities')
async def pending_authorities(user: dict = Depends(require_role('ADMIN'))):
    users = await db.users.find({'role': 'AUTHORITY', 'approvalStatus': 'PENDING'}).to_list(500)
    out = []
    for u in users:
        inst = await db.institutions.find_one({'_id': u.get('institutionId')}) if u.get('institutionId') else None
        out.append({
            'userId': u['_id'], 'email': u['email'], 'emailDomain': u['emailDomain'],
            'createdAt': u['createdAt'],
            'institution': {'name': inst['name'], 'domain': inst['domain']} if inst else None,
        })
    return out


@api.post('/admin/authorities/{user_id}/approve')
async def approve_authority(user_id: str, user: dict = Depends(require_role('ADMIN'))):
    return await _decide_authority(user_id, 'ACTIVE', user)


@api.post('/admin/authorities/{user_id}/reject')
async def reject_authority(user_id: str, user: dict = Depends(require_role('ADMIN'))):
    return await _decide_authority(user_id, 'REJECTED', user)


async def _decide_authority(user_id: str, status: str, admin: dict):
    target = await db.users.find_one({'_id': user_id, 'role': 'AUTHORITY'})
    if not target:
        raise HTTPException(status_code=404, detail='Penerbit tidak ditemukan')
    await db.users.update_one({'_id': user_id}, {'$set': {
        'approvalStatus': status, 'approvedBy': admin['_id'], 'approvedAt': iso(now_utc()),
    }})
    if target.get('institutionId'):
        await db.institutions.update_one({'_id': target['institutionId']}, {'$set': {
            'status': status, 'decidedBy': admin['_id'], 'decidedAt': iso(now_utc()),
        }})
    await append_audit('ADMIN_ACTION', admin['_id'], 'ADMIN', None, target.get('institutionId'),
                       {'action': f'AUTHORITY_{status}', 'targetUser': user_id, 'targetEmail': target['email']})
    return {'userId': user_id, 'approvalStatus': status}


@api.get('/admin/audit-chain')
async def audit_chain(page: int = 1, limit: int = 20, user: dict = Depends(require_role('ADMIN'))):
    skip = (page - 1) * limit
    total = await db.auditChain.count_documents({})
    entries = await db.auditChain.find({}).sort('createdAt', 1).skip(skip).limit(limit).to_list(limit)
    out = []
    for e in entries:
        valid = recompute_log_hash(e) == e['logHash']
        out.append({
            'logId': e['logId'], 'eventType': e['eventType'], 'docHash': e.get('docHash'),
            'actorId': e.get('actorId'), 'actorRole': e.get('actorRole'),
            'institutionId': e.get('institutionId'), 'detail': e.get('detail'),
            'prevLogHash': e['prevLogHash'], 'logHash': e['logHash'],
            'createdAt': e['createdAt'], 'valid': valid,
        })
    return {'total': total, 'page': page, 'limit': limit, 'entries': out}


# ---------------------------------------------------------------------------
# DOCUMENT SUBMIT (OWNER)
# ---------------------------------------------------------------------------
async def _process_submit(buf: bytes, file_name: str, owner_id: str, institution_id: str, owner_role: str = 'OWNER'):
    if len(buf) < 5 or buf[:5] != b'%PDF-':
        raise HTTPException(status_code=422, detail='File bukan PDF yang valid')
    if len(buf) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail='Ukuran file melebihi 10MB')

    inst = await db.institutions.find_one({'_id': institution_id, 'status': 'ACTIVE'})
    if not inst:
        raise HTTPException(status_code=422, detail='Institusi tujuan tidak aktif')

    scan_report = scan_pdf(buf)

    chunks = [buf[i:i + 4096] for i in range(0, len(buf), 4096)]
    leaves = [sha256_hex(c) for c in chunks]
    doc_hash = build_merkle_root(leaves)
    full_file_hash = sha256_hex(buf)

    if await db.documents.find_one({'docHash': doc_hash}):
        raise HTTPException(status_code=409, detail='Dokumen ini sudah pernah didaftarkan')

    encrypted_blob = aes_encrypt(buf)
    doc_id = str(uuid.uuid4())
    submitted_at = iso(now_utc())
    doc = {
        '_id': doc_id, 'docId': doc_id, 'docHash': doc_hash, 'fullFileHash': full_file_hash,
        'ownerId': owner_id, 'institutionId': institution_id, 'fileName': file_name,
        'fileSize': len(buf), 'chunkCount': len(chunks), 'scanReport': scan_report,
        'encryptedBlob': encrypted_blob, 'status': 'PENDING', 'rejectionReasonCode': None,
        'submittedAt': submitted_at, 'decidedAt': None, 'decidedBy': None,
        'signature': None, 'keyIdentifier': None,
        'pendingExpiresAt': now_utc() + timedelta(hours=24),
    }
    await db.documentChunks.insert_many([
        {'_id': f'{doc_hash}:{i}', 'docHash': doc_hash, 'chunkIndex': i, 'chunkHash': leaves[i]}
        for i in range(len(leaves))
    ])
    await db.documents.insert_one(doc)
    await append_audit('SUBMIT', owner_id, owner_role, doc_hash, institution_id,
                       {'fileName': file_name, 'fileSize': len(buf), 'chunkCount': len(chunks),
                        'scanReport': scan_report})

    try:
        ba = bytearray(buf)
        for i in range(len(ba)):
            ba[i] = 0
    except Exception:
        pass

    return {
        'docHash': doc_hash, 'fullFileHash': full_file_hash, 'chunkCount': len(chunks),
        'fileSize': doc['fileSize'], 'scanReport': scan_report, 'status': 'PENDING',
        'pendingExpiresAt': iso(doc['pendingExpiresAt']),
    }


@api.post('/documents/submit')
async def submit_document(file: UploadFile = File(...), institutionId: str = Form(...),
                          user: dict = Depends(require_role('OWNER'))):
    buf = await file.read()
    return await _process_submit(buf, file.filename or 'dokumen.pdf', user['_id'], institutionId)


@api.get('/owner/documents')
async def owner_documents(user: dict = Depends(require_role('OWNER'))):
    docs = await db.documents.find({'ownerId': user['_id']}).sort('submittedAt', -1).to_list(500)
    out = []
    for d in docs:
        inst = await db.institutions.find_one({'_id': d['institutionId']})
        out.append({
            'docId': d['_id'], 'fileName': d['fileName'], 'fileSize': d['fileSize'],
            'status': d['status'], 'rejectionReasonCode': d.get('rejectionReasonCode'),
            'institutionName': inst['name'] if inst else '-',
            'docHash': d['docHash'], 'chunkCount': d['chunkCount'],
            'submittedAt': d['submittedAt'], 'decidedAt': d.get('decidedAt'),
            'scanReport': d.get('scanReport'), 'signature': d.get('signature'),
            'keyIdentifier': d.get('keyIdentifier'),
        })
    return out


# ---------------------------------------------------------------------------
# AUTHORITY REVIEW & DECIDE
# ---------------------------------------------------------------------------
@api.get('/authority/queue')
async def authority_queue(user: dict = Depends(require_authority_active)):
    docs = await db.documents.find(
        {'institutionId': user['institutionId'], 'status': 'PENDING'}
    ).sort('submittedAt', 1).to_list(500)
    out = []
    for d in docs:
        owner = await db.users.find_one({'_id': d['ownerId']})
        out.append({
            'docId': d['_id'], 'fileName': d['fileName'], 'fileSize': d['fileSize'],
            'ownerEmail': owner['email'] if owner else '-', 'chunkCount': d['chunkCount'],
            'docHash': d['docHash'], 'scanReport': d.get('scanReport'),
            'submittedAt': d['submittedAt'],
        })
    return out


def _ensure_institution_match(user: dict, doc: dict):
    if doc['institutionId'] != user.get('institutionId'):
        raise HTTPException(status_code=403, detail='Dokumen bukan milik institusi Anda')


@api.get('/authority/documents/{doc_id}/blob')
async def authority_blob(doc_id: str, user: dict = Depends(require_authority_active)):
    doc = await db.documents.find_one({'_id': doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail='Dokumen tidak ditemukan')
    _ensure_institution_match(user, doc)
    if not doc.get('encryptedBlob'):
        raise HTTPException(status_code=410, detail='Berkas sudah dihapus setelah keputusan')
    pdf_bytes = aes_decrypt(doc['encryptedBlob'])
    return FastResponse(content=pdf_bytes, media_type='application/pdf',
                        headers={'Content-Disposition': 'inline; filename="preview.pdf"'})


@api.get('/authority/documents/{doc_id}')
async def authority_doc_detail(doc_id: str, user: dict = Depends(require_authority_active)):
    doc = await db.documents.find_one({'_id': doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail='Dokumen tidak ditemukan')
    _ensure_institution_match(user, doc)
    owner = await db.users.find_one({'_id': doc['ownerId']})
    return {
        'docId': doc['_id'], 'fileName': doc['fileName'], 'fileSize': doc['fileSize'],
        'ownerEmail': owner['email'] if owner else '-', 'chunkCount': doc['chunkCount'],
        'docHash': doc['docHash'], 'fullFileHash': doc['fullFileHash'],
        'scanReport': doc.get('scanReport'), 'status': doc['status'],
        'submittedAt': doc['submittedAt'],
    }


@api.post('/authority/documents/{doc_id}/decide')
async def decide_document(doc_id: str, body: dict, user: dict = Depends(require_authority_active)):
    decision = body.get('decision')
    reason = body.get('rejectionReasonCode')
    if decision not in ('APPROVED', 'REJECTED'):
        raise HTTPException(status_code=422, detail='Keputusan tidak valid')
    if decision == 'REJECTED' and reason not in ('INCOMPLETE_DOCUMENT', 'SUSPECTED_FORGERY', 'UNREADABLE', 'OTHER'):
        raise HTTPException(status_code=422, detail='Alasan penolakan wajib dipilih')

    doc = await db.documents.find_one({'_id': doc_id})
    if not doc:
        raise HTTPException(status_code=404, detail='Dokumen tidak ditemukan')
    _ensure_institution_match(user, doc)

    decided_at = iso(now_utc())
    upd = await db.documents.update_one(
        {'_id': doc_id, 'status': 'PENDING'},
        {'$set': {'status': decision, 'decidedBy': user['_id'], 'decidedAt': decided_at,
                  'rejectionReasonCode': reason if decision == 'REJECTED' else None}},
    )
    if upd.modified_count == 0:
        raise HTTPException(status_code=409, detail='Dokumen sudah diputuskan atau kedaluwarsa')

    chunk_docs = await db.documentChunks.find({'docHash': doc['docHash']}).sort('chunkIndex', 1).to_list(100000)
    leaves = [c['chunkHash'] for c in chunk_docs]
    if build_merkle_root(leaves) != doc['docHash']:
        raise HTTPException(status_code=500, detail='Kegagalan integritas Merkle')

    envelope = {
        'docHash': doc['docHash'], 'status': decision,
        'rejectionReasonCode': reason if decision == 'REJECTED' else None,
        'authorityId': user['_id'], 'institutionId': user['institutionId'],
        'keyIdentifier': SIGNING_KEY_ID, 'createdAt': decided_at,
    }
    signature = ecdsa_sign(envelope)

    await db.documents.update_one({'_id': doc_id}, {
        '$set': {'signature': signature, 'keyIdentifier': SIGNING_KEY_ID},
        '$unset': {'encryptedBlob': '', 'pendingExpiresAt': ''},
    })

    await append_audit('DECIDE', user['_id'], 'AUTHORITY', doc['docHash'], user['institutionId'],
                       {'decision': decision, 'rejectionReasonCode': reason if decision == 'REJECTED' else None,
                        'keyIdentifier': SIGNING_KEY_ID})

    return {'status': decision, 'signature': signature, 'keyIdentifier': SIGNING_KEY_ID}


@api.get('/authority/history')
async def authority_history(user: dict = Depends(require_authority_active)):
    docs = await db.documents.find(
        {'institutionId': user['institutionId'], 'status': {'$in': ['APPROVED', 'REJECTED']}}
    ).sort('decidedAt', -1).to_list(500)
    out = []
    for d in docs:
        owner = await db.users.find_one({'_id': d['ownerId']})
        out.append({
            'docId': d['_id'], 'fileName': d['fileName'], 'fileSize': d['fileSize'],
            'ownerEmail': owner['email'] if owner else '-', 'status': d['status'],
            'rejectionReasonCode': d.get('rejectionReasonCode'), 'docHash': d['docHash'],
            'signature': d.get('signature'), 'keyIdentifier': d.get('keyIdentifier'),
            'decidedAt': d.get('decidedAt'), 'submittedAt': d['submittedAt'],
        })
    return out


@api.get('/verify/public-key')
async def public_key():
    return {'keyIdentifier': SIGNING_KEY_ID, 'algorithm': 'ECDSA P-384',
            'publicKeyPem': SIGNING_KEY_PUBLIC_PEM.decode()}


# ---------------------------------------------------------------------------
# Startup: indexes + seed
# ---------------------------------------------------------------------------
def make_pdf(title: str) -> bytes:
    body = (
        b'%PDF-1.4\n'
        b'1 0 obj<< /Type /Catalog /Pages 2 0 R >>endobj\n'
        b'2 0 obj<< /Type /Pages /Kids [3 0 R] /Count 1 >>endobj\n'
        b'3 0 obj<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] '
        b'/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>endobj\n'
        b'4 0 obj<< /Length 74 >>stream\n'
        b'BT /F1 24 Tf 72 700 Td (' + title.encode() + b') Tj ET\n'
        b'endstream endobj\n'
        b'5 0 obj<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>endobj\n'
        b'trailer<< /Root 1 0 R >>\n%%EOF'
    )
    return body


async def create_indexes():
    await db.users.create_index('email', unique=True)
    await db.users.create_index('institutionId')
    await db.users.create_index([('role', 1), ('approvalStatus', 1)])
    await db.otpSessions.create_index('expiresAt', expireAfterSeconds=0)
    await db.institutions.create_index('name', unique=True)
    await db.institutions.create_index('domain', unique=True)
    await db.documents.create_index('docHash', unique=True)
    await db.documents.create_index([('ownerId', 1), ('status', 1)])
    await db.documents.create_index([('institutionId', 1), ('status', 1)])
    await db.documents.create_index('pendingExpiresAt', expireAfterSeconds=0)
    await db.documentChunks.create_index([('docHash', 1), ('chunkIndex', 1)], unique=True)


SEED_INSTITUTIONS = [
    ('Universitas Nusantara', 'universitasnusantara.ac.id', 'rektor@universitasnusantara.ac.id'),
    ('Kementerian Kesehatan RI', 'kemkes.go.id', 'sekjen@kemkes.go.id'),
    ('PT Cipta Karya', 'ciptakarya.co.id', 'direktur@ciptakarya.co.id'),
]


async def seed():
    admin = await db.users.find_one({'email': ADMIN_EMAIL, 'role': 'ADMIN'})
    if not admin:
        admin = {
            '_id': str(uuid.uuid4()), 'email': ADMIN_EMAIL, 'emailDomain': ADMIN_EMAIL.split('@')[-1],
            'role': 'ADMIN', 'institutionId': None, 'approvalStatus': 'ACTIVE',
            'passwordHash': scrypt_hash(ADMIN_PASSWORD), 'approvedBy': None, 'approvedAt': None,
            'isVerified': True, 'createdAt': iso(now_utc()),
        }
        await db.users.insert_one(admin)
    elif not scrypt_verify(ADMIN_PASSWORD, admin.get('passwordHash', '')):
        await db.users.update_one({'_id': admin['_id']}, {'$set': {'passwordHash': scrypt_hash(ADMIN_PASSWORD)}})

    first_inst_id = None
    for name, domain, auth_email in SEED_INSTITUTIONS:
        inst = await db.institutions.find_one({'domain': domain})
        if not inst:
            inst_id = str(uuid.uuid4())
            await db.institutions.insert_one({
                '_id': inst_id, 'institutionId': inst_id, 'name': name, 'domain': domain,
                'status': 'ACTIVE', 'createdBy': None, 'createdAt': iso(now_utc()),
                'decidedBy': admin['_id'], 'decidedAt': iso(now_utc()),
            })
        else:
            inst_id = inst['_id']
        authority = await db.users.find_one({'email': auth_email})
        if not authority:
            authority = {
                '_id': str(uuid.uuid4()), 'email': auth_email, 'emailDomain': domain,
                'role': 'AUTHORITY', 'institutionId': inst_id, 'approvalStatus': 'ACTIVE',
                'approvedBy': admin['_id'], 'approvedAt': iso(now_utc()), 'isVerified': True,
                'createdAt': iso(now_utc()),
            }
            await db.users.insert_one(authority)
        if first_inst_id is None:
            first_inst_id = inst_id

    owner_email = 'budi.santoso@gmail.com'
    owner = await db.users.find_one({'email': owner_email})
    if not owner:
        owner = {
            '_id': str(uuid.uuid4()), 'email': owner_email, 'emailDomain': 'gmail.com',
            'role': 'OWNER', 'institutionId': None, 'approvalStatus': 'ACTIVE',
            'approvedBy': None, 'approvedAt': None, 'isVerified': True, 'createdAt': iso(now_utc()),
        }
        await db.users.insert_one(owner)

    existing = await db.documents.find_one({'ownerId': owner['_id'], 'status': 'PENDING'})
    if not existing and first_inst_id:
        title = f'Ijazah Sarjana - Budi Santoso {uuid.uuid4().hex[:8]}'
        pdf = make_pdf(title)
        try:
            await _process_submit(pdf, 'ijazah-budi-santoso.pdf', owner['_id'], first_inst_id)
        except HTTPException as e:
            logger.warning(f'seed doc skipped: {e.detail}')


@app.on_event('startup')
async def startup():
    await create_indexes()
    await seed()
    logger.info('Sahkan backend siap.')


@app.on_event('shutdown')
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=['*'],
    allow_headers=['*'],
)
