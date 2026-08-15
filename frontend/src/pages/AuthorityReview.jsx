import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle, XCircle, Warning, CircleNotch, ShieldCheck } from "@phosphor-icons/react";
import { Shell } from "@/components/Shell";
import { Hash } from "@/components/Hash";
import { SealStamp } from "@/components/SealStamp";
import { PdfViewer } from "@/components/PdfViewer";
import { api, apiError } from "@/lib/api";
import { bytes, fmtDate, SCAN_LABELS, REASON_LABELS } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { AUTHORITY_NAV } from "@/pages/ownerNav";
import { AuthorityPending } from "@/pages/AuthorityQueue";

const REASONS = ["INCOMPLETE_DOCUMENT", "SUSPECTED_FORGERY", "UNREADABLE", "OTHER"];

export default function AuthorityReview() {
  const { docId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [doc, setDoc] = useState(null);
  const [hoverDecision, setHoverDecision] = useState(null);
  const [confirm, setConfirm] = useState(null); // 'APPROVED' | 'REJECTED'
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);

  useEffect(() => {
    if (user?.approvalStatus === "ACTIVE") {
      api.get(`/authority/documents/${docId}`).then(({ data }) => setDoc(data)).catch(() => setDoc(false));
    }
  }, [docId, user]);

  if (user && user.approvalStatus !== "ACTIVE") return <AuthorityPending />;

  const decide = async () => {
    if (confirm === "REJECTED" && !reason) { toast.error("Pilih alasan penolakan"); return; }
    setBusy(true);
    try {
      const { data } = await api.post(`/authority/documents/${docId}/decide`, {
        decision: confirm,
        rejectionReasonCode: confirm === "REJECTED" ? reason : undefined,
      });
      setDone(data);
      setConfirm(null);
      toast.success(confirm === "APPROVED" ? "Dokumen terverifikasi & ditandatangani" : "Dokumen ditolak");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell nav={AUTHORITY_NAV}>
      <button
        onClick={() => navigate("/authority/antrean")}
        data-testid="review-back"
        className="mb-6 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-bone/50 transition-colors duration-300 hover:text-bone"
      >
        <ArrowLeft size={13} /> Kembali ke antrean
      </button>

      {doc === null ? (
        <p className="font-mono text-sm text-bone/40">Memuat…</p>
      ) : doc === false ? (
        <p className="font-mono text-sm text-rose-seal/80">Dokumen tidak ditemukan.</p>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* LEFT — preview */}
          <div className="lg:col-span-7">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-medium text-bone">{doc.fileName}</h2>
              <span className="font-mono text-[11px] uppercase tracking-widest text-bone/40">Pratinjau Aman</span>
            </div>
            <div className="panel max-h-[72vh] overflow-y-auto p-4">
              {done ? (
                <div className="flex flex-col items-center justify-center gap-4 py-24">
                  <SealStamp status={done.status} size={160} animate />
                  <p className="font-mono text-sm text-bone/50">Berkas telah dimusnahkan permanen.</p>
                </div>
              ) : (
                <PdfViewer docId={docId} />
              )}
            </div>
          </div>

          {/* RIGHT — metadata + decision */}
          <div className="lg:col-span-5">
            <div className="panel p-6">
              <p className="mb-5 font-mono text-[11px] uppercase tracking-widest text-bone/40">Metadata</p>
              <dl className="space-y-3.5 font-mono text-[13px]">
                <Row label="Pemohon"><span className="text-bone">{doc.ownerEmail}</span></Row>
                <Row label="Ukuran"><span className="text-bone">{bytes(doc.fileSize)}</span></Row>
                <Row label="Potongan (4KB)"><span className="text-bone">{doc.chunkCount}</span></Row>
                <Row label="Diajukan"><span className="text-bone/70 text-[12px]">{fmtDate(doc.submittedAt)}</span></Row>
                <Row label="docHash"><Hash value={doc.docHash} testid="review-dochash" /></Row>
                <Row label="fullFileHash"><Hash value={doc.fullFileHash} testid="review-fullhash" /></Row>
              </dl>

              <div className="mt-6 border-t border-hair pt-5">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-bone/40">Pindai Risiko</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(doc.scanReport || {}).map(([k, v]) => (
                    <span key={k} data-testid={`review-scan-${k}`} className="inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px]"
                      style={{ color: v ? "#D98324" : "rgba(20,52,78,0.45)", borderColor: v ? "#D9832455" : "var(--hair)", background: v ? "#D9832414" : "transparent" }}>
                      {v && <Warning size={12} weight="fill" />} {SCAN_LABELS[k]}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {done ? (
              <div className="panel mt-6 p-6 animate-fade-up" data-testid="decision-result">
                <div className="mb-4 flex items-center gap-2 font-mono text-[12px] uppercase tracking-widest text-emerald-seal">
                  <ShieldCheck size={16} weight="fill" /> Tanda Tangan ECDSA P-384
                </div>
                <div className="space-y-3 font-mono text-[12px]">
                  <Row label="Status"><span style={{ color: done.status === "APPROVED" ? "#12A093" : "#E24C3C" }}>{done.status}</span></Row>
                  <Row label="keyId"><span className="text-bone/70">{done.keyIdentifier}</span></Row>
                  <div>
                    <p className="mb-1 text-bone/45">signature</p>
                    <p className="break-all text-[11px] text-bone/70" data-testid="decision-signature">{done.signature}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="panel mt-6 p-6">
                <p className="mb-5 font-mono text-[11px] uppercase tracking-widest text-bone/40">Keputusan</p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onMouseEnter={() => setHoverDecision("APPROVED")}
                    onMouseLeave={() => setHoverDecision(null)}
                    onClick={() => { setConfirm("APPROVED"); }}
                    data-testid="decide-approve"
                    className="group relative flex flex-col items-center gap-2 overflow-hidden border border-emerald-seal/40 bg-emerald-seal/5 px-4 py-6 transition-colors duration-300 hover:bg-emerald-seal/12"
                  >
                    <CheckCircle size={28} weight={hoverDecision === "APPROVED" ? "fill" : "regular"} className="text-emerald-seal" />
                    <span className="font-mono text-[12px] uppercase tracking-widest text-emerald-seal">Setujui</span>
                  </button>
                  <button
                    onMouseEnter={() => setHoverDecision("REJECTED")}
                    onMouseLeave={() => setHoverDecision(null)}
                    onClick={() => { setConfirm("REJECTED"); }}
                    data-testid="decide-reject"
                    className="group relative flex flex-col items-center gap-2 overflow-hidden border border-rose-seal/40 bg-rose-seal/5 px-4 py-6 transition-colors duration-300 hover:bg-rose-seal/12"
                  >
                    <XCircle size={28} weight={hoverDecision === "REJECTED" ? "fill" : "regular"} className="text-rose-seal" />
                    <span className="font-mono text-[12px] uppercase tracking-widest text-rose-seal">Tolak</span>
                  </button>
                </div>
                <div className="mt-6 flex items-center justify-center opacity-30">
                  <SealStamp status={hoverDecision || "PENDING"} size={92} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* confirmation dialog */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/70 backdrop-blur-sm px-6" data-testid="confirm-dialog">
          <div className="panel w-full max-w-md p-8">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-xl font-medium tracking-tight text-bone">
                {confirm === "APPROVED" ? "Konfirmasi Verifikasi" : "Konfirmasi Penolakan"}
              </h3>
              <SealStamp status={confirm} size={56} />
            </div>
            <p className="mb-6 text-sm leading-relaxed text-bone/55">
              Keputusan ini bersifat final dan ditandatangani secara kriptografis. Berkas asli akan
              dimusnahkan permanen dan tidak dapat dipulihkan.
            </p>

            {confirm === "REJECTED" && (
              <div className="mb-6">
                <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">Alasan Penolakan</label>
                <select
                  data-testid="reject-reason-select"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full bg-ink px-4 py-3 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-rose-seal"
                >
                  <option value="" className="bg-panel">— pilih alasan —</option>
                  {REASONS.map((r) => (
                    <option key={r} value={r} className="bg-panel">{REASON_LABELS[r]}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                data-testid="confirm-cancel"
                className="flex-1 border border-hair px-4 py-3 font-mono text-[12px] uppercase tracking-widest text-bone/60 transition-colors duration-300 hover:text-bone"
              >
                Batal
              </button>
              <button
                onClick={decide}
                disabled={busy}
                data-testid="confirm-decide"
                className="flex flex-1 items-center justify-center gap-2 px-4 py-3 font-mono text-[12px] font-medium uppercase tracking-widest text-ink transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-50"
                style={{ background: confirm === "APPROVED" ? "#12A093" : "#E24C3C" }}
              >
                {busy ? <CircleNotch size={14} className="animate-spin" /> : null}
                {confirm === "APPROVED" ? "Terbitkan Verifikasi" : "Tolak Dokumen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </Shell>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hair pb-3 last:border-0">
      <dt className="text-bone/45">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
