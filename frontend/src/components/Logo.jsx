import React from "react";

// Sahkan brand mark — uses the uploaded logo emblem (shield + document + check + lock).
export function LogoMark({ size = 30 }) {
  return (
    <img
      src="/sahkan-mark.png"
      alt="Sahkan"
      width={size}
      height={size}
      className="object-contain"
      style={{ height: size, width: "auto" }}
    />
  );
}

export function Logo({ size = 32, withText = true }) {
  return (
    <div className="flex items-center gap-2.5 select-none">
      <LogoMark size={size} />
      {withText && (
        <span className="font-mono text-[15px] font-semibold tracking-[0.28em] text-navy">SAHKAN</span>
      )}
    </div>
  );
}
