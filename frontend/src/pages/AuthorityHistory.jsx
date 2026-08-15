import React, { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Hash } from "@/components/Hash";
import { StatusBadge } from "@/components/StatusBadge";
import { SealStamp } from "@/components/SealStamp";
import { api } from "@/lib/api";
import { bytes, fmtDate } from "@/lib/format";
import { useAuth } from "@/context/AuthContext";
import { AUTHORITY_NAV } from "@/pages/ownerNav";
import { AuthorityPending } from "@/pages/AuthorityQueue";

export default function AuthorityHistory() {
  const { user } = useAuth();
  const [items, setItems] = useState(null);

  useEffect(() => {
    if (user?.approvalStatus === "ACTIVE") {
      api.get("/authority/history").then(({ data }) => setItems(data)).catch(() => setItems([]));
    }
  }, [user]);

  if (user && user.approvalStatus !== "ACTIVE") return <AuthorityPending />;

  return (
    <Shell nav={AUTHORITY_NAV}>
      <div className="mb-10">
        <p className="mb-3 font-mono text-[12px] uppercase tracking-[0.3em] text-emerald-seal">
          Penerbit · {user?.institution?.name}
        </p>
        <h1 className="text-4xl font-medium tracking-tighter text-bone">Riwayat Keputusan</h1>
      </div>

      {items === null ? (
        <p className="font-mono text-sm text-bone/40">Memuat…</p>
      ) : items.length === 0 ? (
        <div className="panel flex flex-col items-center justify-center gap-4 py-24 text-center">
          <div className="opacity-40"><SealStamp status="PENDING" size={110} /></div>
          <p className="text-lg text-bone/70">Belum ada keputusan</p>
        </div>
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full border-collapse text-left" data-testid="history-table">
            <thead>
              <tr className="border-b border-hair font-mono text-[11px] uppercase tracking-widest text-bone/40">
                <th className="px-5 py-4 font-normal">Berkas</th>
                <th className="px-5 py-4 font-normal">Pemohon</th>
                <th className="px-5 py-4 font-normal">docHash</th>
                <th className="px-5 py-4 font-normal">Tanda Tangan</th>
                <th className="px-5 py-4 font-normal">Diputus</th>
                <th className="px-5 py-4 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.docId} data-testid={`history-row-${d.docId}`} className="border-b border-hair transition-colors duration-300 last:border-0 hover:bg-panel-hi">
                  <td className="px-5 py-4 text-sm text-bone">{d.fileName}</td>
                  <td className="px-5 py-4 font-mono text-[13px] text-bone/70">{d.ownerEmail}</td>
                  <td className="px-5 py-4"><Hash value={d.docHash} /></td>
                  <td className="px-5 py-4"><Hash value={d.signature} testid={`history-sig-${d.docId}`} /></td>
                  <td className="px-5 py-4 font-mono text-[12px] text-bone/50">{fmtDate(d.decidedAt)}</td>
                  <td className="px-5 py-4"><StatusBadge status={d.status} reasonCode={d.rejectionReasonCode} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Shell>
  );
}
