import React from "react";
import version from "@/version.json";

export function VersionBadge({ className = "" }) {
  const built = version.builtAt ? new Date(version.builtAt) : null;
  return (
    <span
      data-testid="version-badge"
      className={`inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-bone/35 ${className}`}
      title={`Dibangun ${built ? built.toLocaleString("id-ID") : "—"} · commit ${version.commit}`}
    >
      <span className="h-1 w-1 rounded-full bg-emerald-seal/60" />
      Sahkan v{version.version} · {version.commit}
    </span>
  );
}
