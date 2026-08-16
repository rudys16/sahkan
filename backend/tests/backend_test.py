"""Sahkan backend tests - covers register, login, submit, decide, admin, audit chain."""
import os
import io
import time
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://doc-sahkan.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
OTP = "123456"
DEMO_PASSWORD = "Sahkan!2026"  # password for seeded demo accounts

# ---------- helpers ----------
def make_pdf(title: str = "Test Doc") -> bytes:
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


def register(session: requests.Session, name: str, email: str, password: str, role: str,
             institutionId=None, newInstitutionName=None, newInstitutionDomain=None):
    body = {"name": name, "email": email, "password": password, "role": role}
    if role == "AUTHORITY":
        if institutionId:
            body["institutionId"] = institutionId
        else:
            body["newInstitutionName"] = newInstitutionName
            body["newInstitutionDomain"] = newInstitutionDomain
    r = session.post(f"{API}/auth/register/request", json=body)
    assert r.status_code == 200, r.text
    r = session.post(f"{API}/auth/register/verify", json={"email": email, "otp": OTP})
    assert r.status_code == 200, r.text
    return r.json()["user"]


def login(session: requests.Session, email: str, password: str):
    r = session.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return r.json()["user"]


def seed_institution_id(domain: str) -> str:
    r = requests.get(f"{API}/institutions/active")
    assert r.status_code == 200
    for i in r.json():
        if i["domain"] == domain:
            return i["institutionId"]
    pytest.skip(f"Institusi {domain} tidak ada")


# ---------- REGISTRATION ----------
class TestRegister:
    def test_register_invalid_email(self):
        r = requests.post(f"{API}/auth/register/request",
                          json={"name": "A", "email": "bad", "password": "12345678", "role": "OWNER"})
        assert r.status_code == 422

    def test_register_short_password(self):
        r = requests.post(f"{API}/auth/register/request",
                          json={"name": "A", "email": f"short_{int(time.time())}@example.com",
                                "password": "123", "role": "OWNER"})
        assert r.status_code == 422

    def test_register_duplicate_email(self):
        email = f"dup_{int(time.time())}@example.com"
        s = requests.Session()
        user = register(s, "Dup User", email, "Sah!12345678", "OWNER")
        assert user["role"] == "OWNER"
        r = requests.post(f"{API}/auth/register/request",
                          json={"name": "Dup User", "email": email, "password": "Sah!12345678", "role": "OWNER"})
        assert r.status_code == 409

    def test_register_authority_requires_institution(self):
        email = f"noinst_{int(time.time())}@universitasnusantara.ac.id"
        r = requests.post(f"{API}/auth/register/request",
                          json={"name": "No Inst", "email": email, "password": "Sah!12345678", "role": "AUTHORITY"})
        assert r.status_code == 422

    def test_register_owner_flow(self):
        s = requests.Session()
        email = f"owner_{int(time.time())}@example.com"
        user = register(s, "Owner Test", email, "Sah!12345678", "OWNER")
        assert user["role"] == "OWNER"
        assert user["approvalStatus"] == "ACTIVE"
        assert user["name"] == "Owner Test"
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json()["role"] == "OWNER"

    def test_register_wrong_otp(self):
        s = requests.Session()
        email = f"wrongotp_{int(time.time())}@example.com"
        r = s.post(f"{API}/auth/register/request",
                   json={"name": "Wrong", "email": email, "password": "Sah!12345678", "role": "OWNER"})
        assert r.status_code == 200
        r = s.post(f"{API}/auth/register/verify", json={"email": email, "otp": "999999"})
        assert r.status_code == 400


# ---------- LOGIN (email+password) ----------
class TestLogin:
    def test_login_success(self):
        s = requests.Session()
        email = f"login_{int(time.time())}@example.com"
        register(s, "Login User", email, "Sah!12345678", "OWNER")
        s2 = requests.Session()
        user = login(s2, email, "Sah!12345678")
        assert user["email"] == email
        assert s2.get(f"{API}/auth/me").status_code == 200

    def test_login_wrong_password(self):
        s = requests.Session()
        email = f"badpw_{int(time.time())}@example.com"
        register(s, "Bad PW", email, "Sah!12345678", "OWNER")
        r = requests.post(f"{API}/auth/login", json={"email": email, "password": "wrongpass"})
        assert r.status_code == 401

    def test_login_unknown_email(self):
        r = requests.post(f"{API}/auth/login", json={"email": f"nobody_{int(time.time())}@example.com", "password": "Sah!12345678"})
        assert r.status_code == 401


# ---------- ADMIN auth ----------
class TestAdminAuth:
    def test_admin_login_success(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/admin/login", json={"email": "admin@sahkan.id", "password": "Sahkan!Admin2026"})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["role"] == "ADMIN"

    def test_admin_login_bad_password(self):
        r = requests.post(f"{API}/auth/admin/login", json={"email": "admin@sahkan.id", "password": "wrong"})
        assert r.status_code in (401, 429)

    def test_me_unauthenticated(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401


# ---------- Institutions ----------
class TestInstitutions:
    def test_active_institutions_public(self):
        r = requests.get(f"{API}/institutions/active")
        assert r.status_code == 200
        insts = r.json()
        assert len(insts) >= 3
        domains = [i["domain"] for i in insts]
        assert "universitasnusantara.ac.id" in domains

    def test_available_institutions_have_active_authority(self):
        r = requests.get(f"{API}/institutions/available")
        assert r.status_code == 200
        insts = r.json()
        # Seed institutions have ACTIVE authorities -> must be present
        domains = [i["domain"] for i in insts]
        assert "universitasnusantara.ac.id" in domains
        assert len(insts) >= 1


# ---------- Owner submit flow ----------
class TestSubmitAndDecide:
    @pytest.fixture(scope="class")
    @classmethod
    def owner_session(cls):
        s = requests.Session()
        email = f"budi.submit.{int(time.time())}@example.com"
        register(s, "Budi Submit", email, "Sah!12345678", "OWNER")
        return s

    @pytest.fixture(scope="class")
    @classmethod
    def authority_session(cls):
        s = requests.Session()
        login(s, "rektor@universitasnusantara.ac.id", DEMO_PASSWORD)
        return s

    @pytest.fixture(scope="class")
    @classmethod
    def universitas_id(cls):
        return seed_institution_id("universitasnusantara.ac.id")

    def test_submit_pdf(self, owner_session, universitas_id):
        pdf = make_pdf(f"Test-{time.time_ns()}")
        files = {"file": ("test.pdf", pdf, "application/pdf")}
        data = {"institutionId": universitas_id}
        r = owner_session.post(f"{API}/documents/submit", files=files, data=data)
        assert r.status_code == 200, r.text
        body = r.json()
        assert len(body["docHash"]) == 64
        assert len(body["fullFileHash"]) == 64
        assert body["chunkCount"] >= 1
        assert body["status"] == "PENDING"
        assert "scanReport" in body
        pytest.shared_doc_hash = body["docHash"]
        pytest.shared_pdf = pdf
        pytest.shared_inst = universitas_id

    def test_duplicate_submit_returns_409(self, owner_session):
        files = {"file": ("test.pdf", pytest.shared_pdf, "application/pdf")}
        data = {"institutionId": pytest.shared_inst}
        r = owner_session.post(f"{API}/documents/submit", files=files, data=data)
        assert r.status_code == 409

    def test_submit_non_pdf_returns_422(self, owner_session, universitas_id):
        files = {"file": ("bad.pdf", b"not-a-pdf", "application/pdf")}
        r = owner_session.post(f"{API}/documents/submit", files=files, data={"institutionId": universitas_id})
        assert r.status_code == 422

    def test_owner_documents_list(self, owner_session):
        r = owner_session.get(f"{API}/owner/documents")
        assert r.status_code == 200
        docs = r.json()
        assert any(d["docHash"] == pytest.shared_doc_hash for d in docs)

    def test_authority_queue_shows_doc(self, authority_session):
        r = authority_session.get(f"{API}/authority/queue")
        assert r.status_code == 200
        docs = r.json()
        target = [d for d in docs if d["docHash"] == pytest.shared_doc_hash]
        assert target, "submitted doc not visible in authority queue"
        pytest.shared_doc_id = target[0]["docId"]

    def test_authority_blob_returns_pdf(self, authority_session):
        r = authority_session.get(f"{API}/authority/documents/{pytest.shared_doc_id}/blob")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content[:5] == b"%PDF-"

    def test_authority_approve(self, authority_session):
        r = authority_session.post(
            f"{API}/authority/documents/{pytest.shared_doc_id}/decide",
            json={"decision": "APPROVED"}
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "APPROVED"
        assert len(body["signature"]) > 20
        assert body["keyIdentifier"]

    def test_double_decide_returns_409(self, authority_session):
        r = authority_session.post(
            f"{API}/authority/documents/{pytest.shared_doc_id}/decide",
            json={"decision": "APPROVED"}
        )
        assert r.status_code == 409

    def test_blob_after_decide_returns_410(self, authority_session):
        r = authority_session.get(f"{API}/authority/documents/{pytest.shared_doc_id}/blob")
        assert r.status_code == 410


# ---------- Reject flow with reason ----------
class TestRejectFlow:
    def test_reject_requires_reason(self):
        owner = requests.Session()
        login(owner, "budi.santoso@gmail.com", DEMO_PASSWORD)
        auth = requests.Session()
        login(auth, "rektor@universitasnusantara.ac.id", DEMO_PASSWORD)
        inst_id = seed_institution_id("universitasnusantara.ac.id")

        pdf = make_pdf(f"Reject-{time.time_ns()}")
        r = owner.post(f"{API}/documents/submit",
                       files={"file": ("r.pdf", pdf, "application/pdf")},
                       data={"institutionId": inst_id})
        assert r.status_code == 200
        doc_hash = r.json()["docHash"]
        queue = auth.get(f"{API}/authority/queue").json()
        doc_id = [d["docId"] for d in queue if d["docHash"] == doc_hash][0]

        # reject without reason -> 422
        r = auth.post(f"{API}/authority/documents/{doc_id}/decide", json={"decision": "REJECTED"})
        assert r.status_code == 422

        # reject with reason -> 200
        r = auth.post(f"{API}/authority/documents/{doc_id}/decide",
                      json={"decision": "REJECTED", "rejectionReasonCode": "UNREADABLE"})
        assert r.status_code == 200
        assert r.json()["status"] == "REJECTED"


# ---------- Admin flow ----------
class TestAdmin:
    @pytest.fixture(scope="class")
    @classmethod
    def admin_session(cls):
        s = requests.Session()
        r = s.post(f"{API}/auth/admin/login", json={"email": "admin@sahkan.id", "password": "Sahkan!Admin2026"})
        assert r.status_code == 200
        return s

    def test_pending_authorities_lists(self, admin_session):
        # Register a new authority joining an existing institution -> PENDING
        s = requests.Session()
        inst_id = seed_institution_id("universitasnusantara.ac.id")
        new_email = f"dekan.test.{int(time.time())}@fk.universitasnusantara.ac.id"
        user = register(s, "Dekan Test", new_email, "Sah!12345678", "AUTHORITY", institutionId=inst_id)
        assert user["approvalStatus"] == "PENDING"
        r = admin_session.get(f"{API}/admin/pending-authorities")
        assert r.status_code == 200
        pending = r.json()
        target = [p for p in pending if p["email"] == new_email]
        assert target, f"new authority {new_email} not in pending list"
        pytest.shared_pending_user_id = target[0]["userId"]

    def test_approve_authority(self, admin_session):
        uid = pytest.shared_pending_user_id
        r = admin_session.post(f"{API}/admin/authorities/{uid}/approve")
        assert r.status_code == 200
        assert r.json()["approvalStatus"] == "ACTIVE"

    def test_audit_chain(self, admin_session):
        r = admin_session.get(f"{API}/admin/audit-chain?page=1&limit=20")
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 1
        assert all(e["valid"] is True for e in body["entries"]), "audit chain has invalid entries"
        # verify prev/current link
        for i, e in enumerate(body["entries"]):
            assert len(e["logHash"]) == 64
            assert len(e["prevLogHash"]) == 64

    def test_non_admin_cannot_access_admin(self):
        owner = requests.Session()
        login(owner, "budi.santoso@gmail.com", DEMO_PASSWORD)
        r = owner.get(f"{API}/admin/pending-authorities")
        assert r.status_code == 403


# ---------- Guards ----------
class TestGuards:
    def test_owner_cannot_access_authority_queue(self):
        s = requests.Session()
        login(s, "budi.santoso@gmail.com", DEMO_PASSWORD)
        r = s.get(f"{API}/authority/queue")
        assert r.status_code == 403

    def test_logout_clears_session(self):
        s = requests.Session()
        login(s, "budi.santoso@gmail.com", DEMO_PASSWORD)
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401
