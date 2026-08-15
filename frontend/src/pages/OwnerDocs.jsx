import React, { useEffect, useState } from "react";
import { FileDashed } from "@phosphor-icons/react";
import { Shell } from "@/components/Shell";
import { Hash } from "@/components/Hash";
import { StatusBadge } from "@/components/StatusBadge";
import { SealStamp } from "@/components/SealStamp";
import { api } from "@/lib/api";
import { bytes, fmtDate } from "@/lib/format";
import { OWNER_NAV } from "@/pages/ownerNav";

export default function OwnerDocs() {
  const [docs, setDocs] = useState(null);

  useEffect(() => {
    api.get("/owner/documents").then(({ data }) => setDocs(data));
  }, []);

  return (
    <Shell nav={OWNER_NAV}>
      <div className="mb-10">
        <p className="mb-3 font-mono text-[12px] uppercase tracking-[0.3em] text-emerald-seal">Pemohon</p>
        <h1 className="text-4xl font-medium tracking-tighter text-bone">Dokumen Saya</h1>
      </div>

      {docs === null ? (
        <p className="font-mono text-sm text-bone/40">Memuat…</p>
      ) : docs.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="panel overflow-hidden">
          <table className="w-full border-collapse text-left" data-testid="owner-docs-table">
            <thead>
              <tr className="border-b border-hair font-mono text-[11px] uppercase tracking-widest text-bone/40">
                <th className="px-5 py-4 font-normal">Berkas</th>
                <th className="px-5 py-4 font-normal">Institusi</th>
                <th className="px-5 py-4 font-normal">docHash</th>
                <th className="px-5 py-4 text-right font-normal">Ukuran</th>
                <th className="px-5 py-4 font-normal">Diajukan</th>
                <th className="px-5 py-4 font-normal">Status</th>
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.docId} data-testid={`owner-doc-row-${d.docId}`} className="border-b border-hair transition-colors duration-300 last:border-0 hover:bg-panel-hi">
                  <td className="px-5 py-4 text-sm text-bone">{d.fileName}</td>
                  <td className="px-5 py-4 font-mono text-[13px] text-bone/70">{d.institutionName}</td>
                  <td className="px-5 py-4"><Hash value={d.docHash} testid={`owner-doc-hash-${d.docId}`} /></td>
                  <td className="px-5 py-4 text-right font-mono text-[13px] text-bone/70">{bytes(d.fileSize)}</td>
                  <td className="px-5 py-4 font-mono text-[12px] text-bone/50">{fmtDate(d.submittedAt)}</td>
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

function EmptyState() {
  return (
    <div className="panel flex flex-col items-center justify-center gap-5 py-24 text-center">
      <div className="opacity-40"><SealStamp status="PENDING" size={110} /></div>
      <FileDashed size={0} />
      <div>
        <p className="text-lg text-bone/70">Belum ada dokumen</p>
        <p className="mt-1 max-w-xs font-mono text-[12px] text-bone/40">
          Dokumen yang Anda ajukan akan tampil di sini beserta status verifikasinya.
        </p>
      </div>
    </div>
  );
}
