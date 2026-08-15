import React, { useState } from "react";
import { Copy, Check } from "@phosphor-icons/react";
import { groupHash } from "@/lib/format";

export function Hash({ value, full = false, size = "text-sm", testid }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    if (!value) return;
    navigator.clipboard?.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1200);
  };
  return (
    <button
      onClick={copy}
      data-testid={testid || "hash-copy"}
      title={value}
      className={`group inline-flex items-center gap-2 font-mono ${size} text-bone/85 transition-colors duration-300 hover:text-emerald-seal`}
    >
      <span className="break-all text-left">{full ? value : groupHash(value)}</span>
      {copied ? (
        <Check size={13} weight="bold" className="text-emerald-seal" />
      ) : (
        <Copy size={13} className="opacity-0 transition-opacity duration-300 group-hover:opacity-60" />
      )}
    </button>
  );
}
