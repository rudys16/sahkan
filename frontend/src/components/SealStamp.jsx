import React from "react";

// Bespoke verification seal. status: PENDING | APPROVED | REJECTED
export function SealStamp({ status = "PENDING", size = 96, animate = false, className = "" }) {
  const map = {
    APPROVED: { color: "#12A093", label: "TERVERIFIKASI", rot: -6 },
    REJECTED: { color: "#E24C3C", label: "DITOLAK", rot: -9 },
    PENDING: { color: "#D98324", label: "MENUNGGU", rot: -4 },
  };
  const s = map[status] || map.PENDING;
  const ghost = status === "PENDING";

  return (
    <div
      className={`relative inline-flex ${animate ? "animate-stamp-in" : ""} ${className}`}
      style={{ transform: `rotate(${s.rot}deg)`, width: size, height: size, color: s.color }}
      aria-label={s.label}
    >
      <svg viewBox="0 0 120 120" width={size} height={size} style={{ opacity: ghost ? 0.65 : 1 }}>
        <defs>
          <path id={`arc-${status}`} d="M60,60 m-42,0 a42,42 0 1,1 84,0 a42,42 0 1,1 -84,0" fill="none" />
        </defs>
        <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth={ghost ? 1.5 : 3} strokeDasharray={ghost ? "3 5" : "0"} opacity="0.9" />
        <circle cx="60" cy="60" r="47" fill="none" stroke="currentColor" strokeWidth="1" strokeDasharray="2 4" opacity="0.6" />
        <text fontFamily="'IBM Plex Mono', monospace" fontSize="9.5" letterSpacing="3" fill="currentColor" opacity="0.85">
          <textPath href={`#arc-${status}`} startOffset="8%">
            SAHKAN · {s.label} · SAHKAN ·
          </textPath>
        </text>

        {status === "APPROVED" && (
          <path d="M42 62 L54 74 L80 44" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="square" strokeLinejoin="miter" />
        )}
        {status === "REJECTED" && (
          <>
            <path d="M44 44 L76 76" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
            <path d="M76 44 L44 76" stroke="currentColor" strokeWidth="6" strokeLinecap="square" />
            <line x1="26" y1="60" x2="94" y2="60" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.7" />
          </>
        )}
        {status === "PENDING" && (
          <>
            <circle cx="60" cy="60" r="5" fill="currentColor" opacity="0.8" />
            <circle cx="44" cy="60" r="3" fill="currentColor" opacity="0.5" />
            <circle cx="76" cy="60" r="3" fill="currentColor" opacity="0.5" />
          </>
        )}
      </svg>
    </div>
  );
}
