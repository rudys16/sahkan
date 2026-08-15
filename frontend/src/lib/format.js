export function groupHash(hash, head = 6, tail = 6) {
  if (!hash) return "—";
  if (hash.length <= head + tail) return hash;
  return `${hash.slice(0, head)}····${hash.slice(-tail)}`;
}

export function bytes(n) {
  if (n == null) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const REASON_LABELS = {
  INCOMPLETE_DOCUMENT: "Dokumen tidak lengkap",
  SUSPECTED_FORGERY: "Diduga pemalsuan",
  UNREADABLE: "Tidak terbaca",
  OTHER: "Lainnya",
};

export const SCAN_LABELS = {
  hasJavascript: "JavaScript",
  hasFormFields: "Field Formulir",
  hasEmbeddedFiles: "Berkas Tertanam",
  hasExternalRefs: "Referensi Eksternal",
};
