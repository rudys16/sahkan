import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HourglassMedium, Warning, ArrowRight } from "@phosphor-icons/react";
import { Shell } from "@/components/Shell";
import { Hash } from "@/components/Hash";
import { SealStamp } from "@/components/SealStamp";
import { api } from "@/lib/api";
import { bytes, fmtDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { AUTHORITY_NAV } from "@/pages/ownerNav";

export function AuthorityPending() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <div className="grain pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative">
        <SealStamp status="PENDING" size={180} animate />
        <div className="mt-10 flex items-center justify-center gap-2 font-mono text-[12px] uppercase tracking-[0.3em] text-amber-seal">
          <HourglassMedium size={16} weight="fill" /> Status Akun
        </div>
        <h1 className="mt-4 text-4xl font-medium tracking-tighter text-bone" data-testid="authority-pending-title">
          Menunggu persetujuan admin
        </h1>
        <p className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-bone/55">
          Akun penerbit <span className="font-mono text-bone/80">{user?.email}</span> sedang ditinjau.
          Setelah admin menyetujui institusi Anda, antrean review akan terbuka otomatis.
        </p>
        <button
          onClick={async () => { await logout(); navigate("/login"); }}
          data-testid="authority-pending-logout"
          className="mt-10 border border-hair px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest text-bone/60 transition-colors duration-300 hover:border-rose-seal/60 hover:text-rose-seal"
        >
          Keluar
        </button>
      </div>
    </div>
  );
}

export default function AuthorityQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (user?.approvalStatus === "ACTIVE") {
      api.get("/authority/queue").then(({ data }) => setItems(data)).catch(() => setItems([]));
    }
  }, [user]);

  if (user && user.approvalStatus !== "ACTIVE") return <AuthorityPending />;

  return (
    <Shell nav={AUTHORITY_NAV}>
      <div className="mb-10 flex items-end justify-between">
        <div>
          <p className="mb-3 font-mono text-[12px] uppercase tracking-[0.3em] text-emerald-seal">
            Penerbit · {user?.institution?.name}
          </p>
          <h1 className="text-4xl font-medium tracking-tighter text-bone">Antrean Review</h1>
        </div>
        {items && (
          <span className="font-mono text-[13px] text-bone/50" data-testid="queue-count">
            {items.length} menunggu
          </span>
        )}
      </div>

      {items === null ? (
        <p className="font-mono text-sm text-bone/40">Memuat…</p>
      ) : items.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="opacity-40"><SealStamp status="APPROVED" size={110} /></div>
          <p className="text-lg text-bone/70">Antrean kosong</p>
          <p className="max-w-xs font-mono text-[12px] text-bone/40">Tidak ada dokumen yang menunggu keputusan saat ini.</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full border-collapse text-left" data-testid="queue-table">
            <thead>
              <tr className="border-b border-hair font-mono text-[11px] uppercase tracking-widest text-bone/40">
                <th className="px-5 py-4 font-normal">Berkas</th>
                <th className="px-5 py-4 font-normal">Pemohon</th>
                <th className="px-5 py-4 font-normal">docHash</th>
                <th className="px-5 py-4 text-right font-normal">Ukuran</th>
                <th className="px-5 py-4 font-normal">Risiko</th>
                <th className="px-5 py-4 font-normal">Diajukan</th>
                <th className="px-5 py-4 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => {
                const warn = d.scanReport && Object.values(d.scanReport).some(Boolean);
                return (
                  <tr key={d.docId} data-testid={`queue-row-${d.docId}`} className="group border-b border-hair transition-colors duration-300 last:border-0 hover:bg-panel-hi">
                    <td className="px-5 py-4 text-sm text-bone">{d.fileName}</td>
                    <td className="px-5 py-4 font-mono text-[13px] text-bone/70">{d.ownerEmail}</td>
                    <td className="px-5 py-4"><Hash value={d.docHash} testid={`queue-hash-${d.docId}`} /></td>
                    <td className="px-5 py-4 text-right font-mono text-[13px] text-bone/70">{bytes(d.fileSize)}</td>
                    <td className="px-5 py-4">
                      {warn ? (
                        <span className="inline-flex items-center gap-1.5 font-mono text-[11px] text-amber-seal" data-testid={`queue-warn-${d.docId}`}>
                          <Warning size={13} weight="fill" /> Perhatian
                        </span>
                      ) : (
                        <span className="font-mono text-[11px] text-bone/35">Bersih</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-mono text-[12px] text-bone/50">{fmtDate(d.submittedAt)}</td>
                    <td className="px-5 py-4">
                      <button
                        onClick={() => navigate(`/authority/review/${d.docId}`)}
                        data-testid={`queue-review-${d.docId}`}
                        className="flex items-center gap-1.5 border border-hair px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bone/70 transition-colors duration-300 group-hover:border-emerald-seal group-hover:text-emerald-seal"
                      >
                        Tinjau <ArrowRight size={13} weight="bold" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
