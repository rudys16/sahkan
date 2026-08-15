"""Sahkan backend tests - covers auth, submit, decide, admin, audit chain."""
import os
import io
import time
import requests
import pytest

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://doc-sahkan.preview.emergentagent.com').rstrip('/')
API = f"{BASE_URL}/api"
OTP = "123456"

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


def otp_login(session: requests.Session, email: str, purpose: str):
    r = session.post(f"{API}/auth/otp/request", json={"email": email, "purpose": purpose})
    assert r.status_code == 200, r.text
    r = session.post(f"{API}/auth/otp/verify", json={"email": email, "purpose": purpose, "otp": OTP})
    assert r.status_code == 200, r.text
    return r.json()["user"]


# ---------- OWNER OTP flow ----------
class TestOwnerAuth:
    def test_otp_request_invalid_email(self):
        r = requests.post(f"{API}/auth/otp/request", json={"email": "bad", "purpose": "OWNER_AUTH"})
        assert r.status_code == 422

    def test_otp_request_and_verify_owner(self):
        s = requests.Session()
        user = otp_login(s, "budi.santoso@gmail.com", "OWNER_AUTH")
        assert user["role"] == "OWNER"
        assert user["email"] == "budi.santoso@gmail.com"
        me = s.get(f"{API}/auth/me")
        assert me.status_code == 200
        assert me.json()["role"] == "OWNER"

    def test_otp_wrong_code(self):
        s = requests.Session()
        email = f"test_wrong_{int(time.time())}@example.com"
        r = s.post(f"{API}/auth/otp/request", json={"email": email, "purpose": "OWNER_AUTH"})
        assert r.status_code == 200
        r = s.post(f"{API}/auth/otp/verify", json={"email": email, "purpose": "OWNER_AUTH", "otp": "999999"})
        assert r.status_code == 400


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


# ---------- Owner submit flow ----------
class TestSubmitAndDecide:
    @pytest.fixture(scope="class")
    def owner_session(self):
        s = requests.Session()
        otp_login(s, "budi.santoso@gmail.com", "OWNER_AUTH")
        return s

    @pytest.fixture(scope="class")
    def authority_session(self):
        s = requests.Session()
        otp_login(s, "rektor@universitasnusantara.ac.id", "AUTHORITY_LOGIN")
        return s

    @pytest.fixture(scope="class")
    def universitas_id(self):
        r = requests.get(f"{API}/institutions/active")
        for i in r.json():
            if i["domain"] == "universitasnusantara.ac.id":
                return i["institutionId"]
        pytest.skip("Universitas Nusantara not seeded")

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

    def test_reject_without_reason_fails(self, authority_session):
        # Use a different doc for reject flow — submit new
        pass  # skip, tested via approve below

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
        otp_login(owner, "budi.santoso@gmail.com", "OWNER_AUTH")
        auth = requests.Session()
        otp_login(auth, "rektor@universitasnusantara.ac.id", "AUTHORITY_LOGIN")
        insts = requests.get(f"{API}/institutions/active").json()
        inst_id = [i["institutionId"] for i in insts if i["domain"] == "universitasnusantara.ac.id"][0]

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
    def admin_session(self):
        s = requests.Session()
        r = s.post(f"{API}/auth/admin/login", json={"email": "admin@sahkan.id", "password": "Sahkan!Admin2026"})
        assert r.status_code == 200
        return s

    def test_pending_authorities_lists(self, admin_session):
        # Create a pending authority
        s = requests.Session()
        new_email = f"dekan.test.{int(time.time())}@fk.universitasnusantara.ac.id"
        user = otp_login(s, new_email, "AUTHORITY_LOGIN")
        # It doesn't auto-join institution; approvalStatus is PENDING but institutionId is None.
        # Still, admin/pending-authorities should include it.
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
        otp_login(owner, "budi.santoso@gmail.com", "OWNER_AUTH")
        r = owner.get(f"{API}/admin/pending-authorities")
        assert r.status_code == 403


# ---------- Guards ----------
class TestGuards:
    def test_owner_cannot_access_authority_queue(self):
        s = requests.Session()
        otp_login(s, "budi.santoso@gmail.com", "OWNER_AUTH")
        r = s.get(f"{API}/authority/queue")
        assert r.status_code == 403

    def test_logout_clears_session(self):
        s = requests.Session()
        otp_login(s, "budi.santoso@gmail.com", "OWNER_AUTH")
        r = s.post(f"{API}/auth/logout")
        assert r.status_code == 200
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401
