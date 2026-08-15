import React from "react";
import { REASON_LABELS } from "@/lib/format";

const CFG = {
  PENDING: { color: "#D98324", label: "MENUNGGU", dot: true },
  APPROVED: { color: "#12A093", label: "TERVERIFIKASI" },
  REJECTED: { color: "#E24C3C", label: "DITOLAK" },
};

export function StatusBadge({ status, reasonCode, className = "" }) {
  const c = CFG[status] || CFG.PENDING;
  return (
    <span
      className={`inline-flex items-center gap-2 px-2.5 py-1 font-mono text-[11px] uppercase tracking-widest ${className}`}
      style={{ color: c.color, border: `1px solid ${c.color}55`, background: `${c.color}12` }}
      data-testid={`status-badge-${status}`}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
      {c.label}
      {status === "REJECTED" && reasonCode ? (
        <span className="opacity-70 normal-case tracking-normal">· {REASON_LABELS[reasonCode]}</span>
      ) : null}
    </span>
  );
}
