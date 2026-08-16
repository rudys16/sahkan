import React, { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UploadSimple, FilePdf, Warning, CircleNotch, CheckCircle } from "@phosphor-icons/react";
import { Shell } from "@/components/Shell";
import { Hash } from "@/components/Hash";
import { SealStamp } from "@/components/SealStamp";
import { api, API, apiError } from "@/lib/api";
import { bytes, SCAN_LABELS, fmtDate } from "@/lib/format";
import { OWNER_NAV } from "@/pages/ownerNav";

export default function OwnerSubmit() {
  const [institutions, setInstitutions] = useState([]);
  const [institutionId, setInstitutionId] = useState("");
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get("/institutions/available").then(({ data }) => {
      setInstitutions(data);
      if (data[0]) setInstitutionId(data[0].institutionId);
    });
  }, []);

  const pick = (f) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Hanya berkas PDF yang diperbolehkan");
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Ukuran melebihi 10MB");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const submit = async () => {
    if (!file || !institutionId) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("institutionId", institutionId);
      const { data } = await api.post("/documents/submit", fd);
      setResult(data);
      setFile(null);
      toast.success("Dokumen diajukan — menunggu review");
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail;
      if (status === 409) {
        toast.error(detail || "Dokumen ini sudah pernah didaftarkan sebelumnya.");
      } else {
        toast.error(apiError(detail));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Shell nav={OWNER_NAV}>
      <div className="mb-10 grid grid-cols-1 items-end gap-4 lg:grid-cols-12">
        <div className="lg:col-span-9">
          <p className="mb-3 font-mono text-[12px] uppercase tracking-[0.3em] text-emerald-seal">Pemohon</p>
          <h1 className="text-4xl font-medium tracking-tighter text-bone">Ajukan Dokumen</h1>
          <p className="mt-3 max-w-xl text-sm text-bone/55">
            Berkas Anda dipecah, di-hash, dan dienkripsi. Salinan asli tidak pernah disimpan permanen
            dan dimusnahkan setelah keputusan diterbitkan.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
            onClick={() => inputRef.current?.click()}
            data-testid="file-dropzone"
            className={`grain relative flex cursor-pointer flex-col items-center justify-center overflow-hidden border border-dashed px-8 py-16 text-center transition-colors duration-300 ${
              drag ? "border-emerald-seal bg-emerald-seal/5" : "border-hair hover:border-bone/30"
            }`}
          >
            <input ref={inputRef} type="file" accept="application/pdf" className="hidden" data-testid="file-input"
              onChange={(e) => pick(e.target.files?.[0])} />
            {file ? (
              <>
                <FilePdf size={40} weight="duotone" className="mb-4 text-emerald-seal" />
                <p className="font-mono text-sm text-bone">{file.name}</p>
                <p className="mt-1 font-mono text-[12px] text-bone/50">{bytes(file.size)}</p>
              </>
            ) : (
              <>
                <UploadSimple size={40} className="mb-4 text-bone/40" />
                <p className="text-sm text-bone/70">Tarik berkas PDF ke sini atau klik untuk memilih</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-bone/35">PDF · maks 10MB</p>
              </>
            )}
          </div>

          <div className="mt-6">
            <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">Institusi Tujuan</label>
            <select
              data-testid="institution-select"
              value={institutionId}
              onChange={(e) => setInstitutionId(e.target.value)}
              className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
            >
              {institutions.map((i) => (
                <option key={i.institutionId} value={i.institutionId} className="bg-panel">
                  {i.name} · {i.domain}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={submit}
            disabled={!file || busy}
            data-testid="submit-document-button"
            className="mt-6 flex w-full items-center justify-center gap-2 bg-emerald-seal px-6 py-4 font-mono text-[13px] font-medium uppercase tracking-widest text-ink transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-40"
          >
            {busy ? <CircleNotch size={16} className="animate-spin" /> : <UploadSimple size={16} weight="bold" />}
            Ajukan untuk Verifikasi
          </button>
        </div>

        <div className="lg:col-span-5">
          {result ? (
            <div className="panel grain relative overflow-hidden p-8 animate-fade-up" data-testid="submit-result">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono text-[12px] uppercase tracking-widest text-amber-seal">
                  <CheckCircle size={16} weight="fill" /> Diterima · Menunggu
                </div>
                <SealStamp status="PENDING" size={64} animate />
              </div>

              <dl className="space-y-4 font-mono text-[13px]">
                <Row label="docHash"><Hash value={result.docHash} testid="result-dochash" /></Row>
                <Row label="fullFileHash"><Hash value={result.fullFileHash} testid="result-fullhash" /></Row>
                <Row label="Potongan (4KB)"><span className="text-bone" data-testid="result-chunkcount">{result.chunkCount}</span></Row>
                <Row label="Ukuran"><span className="text-bone">{bytes(result.fileSize)}</span></Row>
                <Row label="Kedaluwarsa"><span className="text-bone/70 text-[11px]">{fmtDate(result.pendingExpiresAt)}</span></Row>
              </dl>

              <div className="mt-6 border-t border-hair pt-5">
                <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-bone/50">Pindai Risiko</p>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(result.scanReport).map(([k, v]) => (
                    <span
                      key={k}
                      data-testid={`scan-chip-${k}`}
                      className="inline-flex items-center gap-1.5 border px-2.5 py-1 font-mono text-[11px]"
                      style={{
                        color: v ? "#D98324" : "rgba(20,52,78,0.45)",
                        borderColor: v ? "#D9832455" : "var(--hair)",
                        background: v ? "#D9832414" : "transparent",
                      }}
                    >
                      {v && <Warning size={12} weight="fill" />}
                      {SCAN_LABELS[k]}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="panel flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
              <SealStamp status="PENDING" size={120} />
              <p className="max-w-xs font-mono text-[12px] leading-relaxed text-bone/40">
                Ringkasan kriptografis dokumen akan muncul di sini setelah pengajuan.
              </p>
            </div>
          )}
        </div>
      </div>
    </Shell>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hair pb-3">
      <dt className="text-bone/45">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
