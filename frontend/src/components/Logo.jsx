import React from "react";

export function Logo({ size = 28, withText = true }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden>
        <circle cx="20" cy="20" r="18" fill="none" stroke="#2FBF71" strokeWidth="2.5" />
        <circle cx="20" cy="20" r="14" fill="none" stroke="#2FBF71" strokeWidth="0.8" strokeDasharray="2 3" opacity="0.6" />
        <path d="M12 21 L18 27 L29 13" fill="none" stroke="#E8E6E1" strokeWidth="3" strokeLinecap="square" />
      </svg>
      {withText && (
        <span className="font-mono text-[15px] font-medium tracking-[0.3em] text-bone">SAHKAN</span>
      )}
    </div>
  );
}
