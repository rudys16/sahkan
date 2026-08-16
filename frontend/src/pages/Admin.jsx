import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle, XCircle, ShieldCheck, LinkSimple, SealCheck, SealWarning, CaretLeft, CaretRight } from "@phosphor-icons/react";
import { Shell } from "@/components/Shell";
import { Hash } from "@/components/Hash";
import { api, apiError } from "@/lib/api";
import { fmtDate } from "@/lib/format";

const ADMIN_NAV = [
  { to: "/admin", label: "Persetujuan" },
  { to: "/admin/audit", label: "Rantai Audit" },
];

const EVENT_COLOR = { SUBMIT: "#F59E0B", DECIDE: "#2FBF71", ADMIN_ACTION: "#E8E6E1" };

export default function Admin({ view = "approvals" }) {
  const [pending, setPending] = useState(null);
  const [chain, setChain] = useState(null);
  const [page, setPage] = useState(1);
  const limit = 15;

  const loadPending = useCallback(() => {
    api.get("/admin/pending-authorities").then(({ data }) => setPending(data));
  }, []);
  const loadChain = useCallback((p) => {
    api.get(`/admin/audit-chain?page=${p}&limit=${limit}`).then(({ data }) => setChain(data));
  }, []);

  useEffect(() => {
    if (view === "approvals") loadPending();
    else loadChain(page);
  }, [view, page, loadPending, loadChain]);

  const act = async (userId, action) => {
    try {
      await api.post(`/admin/authorities/${userId}/${action}`);
      toast.success(action === "approve" ? "Penerbit disetujui" : "Penerbit ditolak");
      loadPending();
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
    }
  };

  return (
    <Shell nav={ADMIN_NAV}>
      <div className="mb-10 flex items-center gap-3">
        <ShieldCheck size={22} weight="fill" className="text-amber-seal" />
        <p className="font-mono text-[12px] uppercase tracking-[0.3em] text-amber-seal">Konsol Admin</p>
      </div>

      {view === "approvals" ? (
        <>
          <h1 className="mb-8 text-4xl font-medium tracking-tighter text-bone">Persetujuan Penerbit</h1>
          {pending === null ? (
            <p className="font-mono text-sm text-bone/40">Memuat…</p>
          ) : pending.length === 0 ? (
            <div className="panel flex flex-col items-center justify-center gap-3 py-24 text-center">
              <SealCheck size={48} className="text-emerald-seal opacity-70" />
              <p className="text-lg text-bone/70">Tidak ada permintaan tertunda</p>
              <p className="max-w-xs font-mono text-[12px] text-bone/40">Semua penerbit telah ditinjau.</p>
            </div>
          ) : (
            <div className="panel overflow-hidden">
              <table className="w-full border-collapse text-left" data-testid="pending-authorities-table">
                <thead>
                    <tr className="border-b border-hair font-mono text-[11px] uppercase tracking-widest text-bone/40">
                    <th className="px-5 py-4 font-normal">Nama</th>
                    <th className="px-5 py-4 font-normal">Email</th>
                    <th className="px-5 py-4 font-normal">Institusi</th>
                    <th className="px-5 py-4 font-normal">Domain</th>
                    <th className="px-5 py-4 font-normal">Diminta</th>
                    <th className="px-5 py-4 text-right font-normal">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pending.map((u) => (
                    <tr key={u.userId} data-testid={`pending-row-${u.userId}`} className="border-b border-hair last:border-0 hover:bg-panel-hi">
                      <td className="px-5 py-4 font-mono text-[13px] text-bone">{u.name || u.email}</td>
                      <td className="px-5 py-4 font-mono text-[13px] text-bone">{u.email}</td>
                      <td className="px-5 py-4 text-sm text-bone/80">{u.institution?.name || "—"}</td>
                      <td className="px-5 py-4 font-mono text-[12px] text-bone/50">{u.institution?.domain || u.emailDomain}</td>
                      <td className="px-5 py-4 font-mono text-[12px] text-bone/50">{fmtDate(u.createdAt)}</td>
                      <td className="px-5 py-4">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => act(u.userId, "approve")} data-testid={`approve-${u.userId}`}
                            className="flex items-center gap-1.5 border border-emerald-seal/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-emerald-seal transition-colors duration-300 hover:bg-emerald-seal/12">
                            <CheckCircle size={13} weight="fill" /> Setujui
                          </button>
                          <button onClick={() => act(u.userId, "reject")} data-testid={`reject-${u.userId}`}
                            className="flex items-center gap-1.5 border border-rose-seal/40 px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-rose-seal transition-colors duration-300 hover:bg-rose-seal/12">
                            <XCircle size={13} weight="fill" /> Tolak
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="mb-8 flex items-end justify-between">
            <h1 className="text-4xl font-medium tracking-tighter text-bone">Rantai Audit WORM</h1>
            {chain && <span className="font-mono text-[13px] text-bone/50">{chain.total} entri · hash-chained</span>}
          </div>
          {chain === null ? (
            <p className="font-mono text-sm text-bone/40">Memuat…</p>
          ) : (
            <>
              <div className="space-y-3" data-testid="audit-chain-list">
                {chain.entries.map((e) => (
                  <div key={e.logId} data-testid={`audit-entry-${e.logId}`} className="panel grid grid-cols-1 gap-4 p-5 md:grid-cols-12">
                    <div className="md:col-span-3">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-widest" style={{ color: EVENT_COLOR[e.eventType] || "#E8E6E1" }}>
                          {e.eventType}
                        </span>
                        {e.valid ? (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-emerald-seal" data-testid={`audit-valid-${e.logId}`}>
                            <SealCheck size={13} weight="fill" /> valid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-rose-seal" data-testid={`audit-invalid-${e.logId}`}>
                            <SealWarning size={13} weight="fill" /> INVALID
                          </span>
                        )}
                      </div>
                      <p className="mt-2 font-mono text-[11px] text-bone/45">{fmtDate(e.createdAt)}</p>
                      <p className="mt-1 font-mono text-[11px] text-bone/45">{e.actorRole || "—"}</p>
                    </div>
                    <div className="space-y-1.5 md:col-span-9">
                      <div className="flex items-center gap-2 font-mono text-[11px] text-bone/45">
                        <LinkSimple size={12} /> prev
                        <Hash value={e.prevLogHash} size="text-[11px]" />
                      </div>
                      <div className="flex items-center gap-2 font-mono text-[11px] text-bone/70">
                        <span className="opacity-45">hash</span>
                        <Hash value={e.logHash} size="text-[11px]" testid={`audit-hash-${e.logId}`} />
                      </div>
                      {e.docHash && (
                        <div className="flex items-center gap-2 font-mono text-[11px] text-bone/55">
                          <span className="opacity-45">doc</span>
                          <Hash value={e.docHash} size="text-[11px]" />
                        </div>
                      )}
                      <pre className="mt-2 overflow-x-auto border border-hair bg-ink px-3 py-2 font-mono text-[11px] text-bone/60">{JSON.stringify(e.detail)}</pre>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between">
                <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} data-testid="audit-prev"
                  className="flex items-center gap-1.5 border border-hair px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bone/60 transition-colors duration-300 hover:text-bone disabled:opacity-30">
                  <CaretLeft size={13} /> Sebelumnya
                </button>
                <span className="font-mono text-[12px] text-bone/50">Halaman {chain.page}</span>
                <button disabled={page * limit >= chain.total} onClick={() => setPage((p) => p + 1)} data-testid="audit-next"
                  className="flex items-center gap-1.5 border border-hair px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bone/60 transition-colors duration-300 hover:text-bone disabled:opacity-30">
                  Berikutnya <CaretRight size={13} />
                </button>
              </div>
            </>
          )}
        </>
      )}
    </Shell>
  );
}
