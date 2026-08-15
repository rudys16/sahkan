import React from "react";

// Bespoke Sahkan mark: shield (navy→teal) + document + check + lock.
export function LogoMark({ size = 30 }) {
  const id = React.useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 52" aria-hidden>
      <defs>
        <linearGradient id={`g-${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#163C5C" />
          <stop offset="0.55" stopColor="#1C6E77" />
          <stop offset="1" stopColor="#18B0A0" />
        </linearGradient>
      </defs>
      {/* shield */}
      <path
        d="M24 1 L45 8 V26 C45 39 36 47 24 51 C12 47 3 39 3 26 V8 Z"
        fill={`url(#g-${id})`}
      />
      {/* document */}
      <path d="M17 12 H29 L33 16 V30 H17 Z" fill="#FFFFFF" />
      <path d="M29 12 L33 16 H29 Z" fill="#DCE6EA" />
      <rect x="20" y="17" width="10" height="1.6" rx="0.8" fill="#163C5C" opacity="0.55" />
      <rect x="20" y="20.5" width="10" height="1.6" rx="0.8" fill="#163C5C" opacity="0.55" />
      <rect x="20" y="24" width="6.5" height="1.6" rx="0.8" fill="#163C5C" opacity="0.55" />
      {/* check */}
      <path d="M15 25 L22 32 L35 18" fill="none" stroke="#17B0A0" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
      {/* lock */}
      <rect x="20.5" y="37" width="7" height="6" rx="1" fill="#FFFFFF" />
      <path d="M21.6 37 V35.4 A2.4 2.4 0 0 1 26.4 35.4 V37" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
      <circle cx="24" cy="39.6" r="0.9" fill="#163C5C" />
    </svg>
  );
}

export function Logo({ size = 30, withText = true }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <LogoMark size={size} />
      {withText && (
        <span className="font-mono text-[15px] font-semibold tracking-[0.28em] text-navy">SAHKAN</span>
      )}
    </div>
  );
}
