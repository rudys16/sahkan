import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, UploadSimple, FilePdf, MagnifyingGlass, SealCheck, SealWarning, ShieldCheck, CircleNotch } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";
import { Hash } from "@/components/Hash";
import { SealStamp } from "@/components/SealStamp";
import { StatusBadge } from "@/components/StatusBadge";
import { api, apiError } from "@/lib/api";
import { bytes, fmtDate } from "@/lib/format";

export default function VerifyPublic() {
  const navigate = useNavigate();
  const [mode, setMode] = useState("file"); // file | hash
  const [file, setFile] = useState(null);
  const [drag, setDrag] = useState(false);
  const [hash, setHash] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const inputRef = useRef(null);

  const pick = (f) => {
    if (!f) return;
    if (f.type !== "application/pdf" && !f.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Hanya berkas PDF");
      return;
    }
    setFile(f);
    setResult(null);
  };

  const verify = async () => {
    setBusy(true);
    setResult(null);
    try {
      const fd = new FormData();
      if (mode === "file") {
        if (!file) { setBusy(false); return; }
        fd.append("file", file);
      } else {
        if (!hash.trim()) { setBusy(false); return; }
        fd.append("docHash", hash.trim());
      }
      const { data } = await api.post("/verify/document", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      if (!data.found) toast.error("Dokumen tidak ditemukan dalam registri");
      else if (data.signatureValid) toast.success("Tanda tangan sah & terverifikasi");
      else if (data.signatureValid === false) toast.error("Tanda tangan TIDAK sah");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const verdict = result && result.found
    ? result.signatureValid === true
      ? "VALID"
      : result.signatureValid === false
      ? "INVALID"
      : "PENDING"
    : result && !result.found
    ? "NOTFOUND"
    : null;

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-hair px-6 py-5">
        <button onClick={() => navigate("/")} data-testid="verify-logo"><Logo /></button>
        <button
          onClick={() => navigate("/login")}
          data-testid="verify-to-login"
          className="border border-hair px-4 py-2 font-mono text-[12px] uppercase tracking-widest text-bone/70 transition-colors duration-300 hover:border-emerald-seal hover:text-emerald-seal"
        >
          Masuk
        </button>
      </header>

      <div className="mx-auto max-w-[1100px] px-6 py-14">
        <button
          onClick={() => navigate("/")}
          data-testid="verify-back"
          className="mb-8 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-bone/50 transition-colors duration-300 hover:text-bone"
        >
          <ArrowLeft size={13} /> Beranda
        </button>

        <p className="mb-3 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.3em] text-emerald-seal">
          <ShieldCheck size={16} weight="fill" /> Verifikasi Publik
        </p>
        <h1 className="text-4xl font-medium tracking-tighter text-bone sm:text-5xl">Cek Keaslian Dokumen</h1>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-bone/55">
          Unggah dokumen PDF atau masukkan <span className="font-mono text-bone/80">docHash</span> untuk memverifikasi
          keputusan resmi institusi. Sistem menghitung ulang akar Merkle dan memeriksa tanda tangan
          ECDSA P-384 terhadap kunci publik penerbit.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* input */}
          <div className="lg:col-span-6">
            <div className="mb-6 flex border border-hair">
              <button
                data-testid="verify-mode-file"
                onClick={() => { setMode("file"); setResult(null); }}
                className={`flex-1 px-4 py-3 font-mono text-[12px] uppercase tracking-widest transition-colors duration-300 ${mode === "file" ? "bg-emerald-seal text-ink" : "text-bone/50 hover:text-bone"}`}
              >
                Unggah PDF
              </button>
              <button
                data-testid="verify-mode-hash"
                onClick={() => { setMode("hash"); setResult(null); }}
                className={`flex-1 px-4 py-3 font-mono text-[12px] uppercase tracking-widest transition-colors duration-300 ${mode === "hash" ? "bg-emerald-seal text-ink" : "text-bone/50 hover:text-bone"}`}
              >
                Masukkan docHash
              </button>
            </div>

            {mode === "file" ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
                onClick={() => inputRef.current?.click()}
                data-testid="verify-dropzone"
                className={`grain relative flex cursor-pointer flex-col items-center justify-center overflow-hidden border border-dashed px-8 py-16 text-center transition-colors duration-300 ${drag ? "border-emerald-seal bg-emerald-seal/5" : "border-hair hover:border-bone/30"}`}
              >
                <input ref={inputRef} type="file" accept="application/pdf" className="hidden" data-testid="verify-file-input"
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
                    <p className="text-sm text-bone/70">Tarik PDF ke sini atau klik untuk memilih</p>
                    <p className="mt-1 font-mono text-[11px] uppercase tracking-widest text-bone/35">Berkas tidak diunggah ke server permanen</p>
                  </>
                )}
              </div>
            ) : (
              <div>
                <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">docHash (SHA-256 Merkle root)</label>
                <input
                  data-testid="verify-hash-input"
                  value={hash}
                  onChange={(e) => setHash(e.target.value)}
                  placeholder="a094e1609a8d96af..."
                  className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
                />
              </div>
            )}

            <button
              onClick={verify}
              disabled={busy || (mode === "file" ? !file : !hash.trim())}
              data-testid="verify-submit"
              className="mt-6 flex w-full items-center justify-center gap-2 bg-emerald-seal px-6 py-4 font-mono text-[13px] font-medium uppercase tracking-widest text-ink transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-40"
            >
              {busy ? <CircleNotch size={16} className="animate-spin" /> : <MagnifyingGlass size={16} weight="bold" />}
              Verifikasi Sekarang
            </button>
          </div>

          {/* result */}
          <div className="lg:col-span-6">
            {!result ? (
              <div className="panel flex h-full flex-col items-center justify-center gap-4 p-12 text-center">
                <SealStamp status="PENDING" size={120} />
                <p className="max-w-xs font-mono text-[12px] leading-relaxed text-bone/40">
                  Hasil verifikasi kriptografis akan muncul di sini.
                </p>
              </div>
            ) : verdict === "NOTFOUND" ? (
              <div className="panel grain relative overflow-hidden p-8 animate-fade-up" data-testid="verify-result">
                <div className="mb-5 flex items-center gap-2 font-mono text-[12px] uppercase tracking-widest text-rose-seal">
                  <SealWarning size={16} weight="fill" /> Tidak Ditemukan
                </div>
                <p className="text-sm leading-relaxed text-bone/60">
                  docHash ini tidak terdaftar dalam registri Sahkan. Dokumen belum pernah diajukan
                  atau bukan versi yang sama persis.
                </p>
                <div className="mt-5 border-t border-hair pt-4">
                  <p className="mb-1 font-mono text-[11px] text-bone/45">docHash yang dihitung</p>
                  <Hash value={result.docHash} full size="text-[11px]" testid="verify-computed-hash" />
                </div>
              </div>
            ) : (
              <div className="panel grain relative overflow-hidden p-8 animate-fade-up" data-testid="verify-result">
                <div className="mb-6 flex items-center justify-between">
                  <StatusBadge status={result.status} reasonCode={result.rejectionReasonCode} />
                  <SealStamp status={result.status} size={72} animate />
                </div>

                <div
                  className="mb-6 flex items-center gap-3 border px-4 py-3"
                  data-testid="verify-verdict"
                  style={{
                    color: verdict === "VALID" ? "#12A093" : verdict === "INVALID" ? "#E24C3C" : "#D98324",
                    borderColor: verdict === "VALID" ? "#12A09355" : verdict === "INVALID" ? "#E24C3C55" : "#D9832455",
                    background: verdict === "VALID" ? "#12A09314" : verdict === "INVALID" ? "#E24C3C14" : "#D9832414",
                  }}
                >
                  {verdict === "VALID" ? <SealCheck size={22} weight="fill" /> : verdict === "INVALID" ? <SealWarning size={22} weight="fill" /> : <ShieldCheck size={22} />}
                  <div>
                    <p className="font-mono text-[13px] uppercase tracking-widest">
                      {verdict === "VALID" ? "Tanda tangan sah" : verdict === "INVALID" ? "Tanda tangan tidak sah" : "Belum ditandatangani"}
                    </p>
                    <p className="font-mono text-[11px] opacity-70">ECDSA P-384 · {result.keyIdentifier || "—"}</p>
                  </div>
                </div>

                <dl className="space-y-3.5 font-mono text-[13px]">
                  <Row label="Institusi Penerbit"><span className="text-bone">{result.institution?.name || "—"}</span></Row>
                  <Row label="Berkas"><span className="text-bone/80">{result.fileName}</span></Row>
                  <Row label="Ukuran"><span className="text-bone/80">{bytes(result.fileSize)}</span></Row>
                  <Row label="Potongan (4KB)"><span className="text-bone/80">{result.chunkCount}</span></Row>
                  <Row label="Diputus"><span className="text-bone/70 text-[12px]">{fmtDate(result.decidedAt)}</span></Row>
                  <Row label="docHash"><Hash value={result.docHash} testid="verify-result-hash" /></Row>
                  <Row label="fullFileHash"><Hash value={result.fullFileHash} /></Row>
                </dl>

                {result.signature && (
                  <div className="mt-5 border-t border-hair pt-4">
                    <p className="mb-1 font-mono text-[11px] text-bone/45">signature</p>
                    <p className="break-all font-mono text-[11px] text-bone/70" data-testid="verify-signature">{result.signature}</p>
                  </div>
                )}
                {result.computed && (
                  <p className="mt-4 font-mono text-[11px] text-emerald-seal/80">
                    ✓ Berkas Anda cocok persis dengan dokumen yang terdaftar.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hair pb-3 last:border-0">
      <dt className="text-bone/45">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}
