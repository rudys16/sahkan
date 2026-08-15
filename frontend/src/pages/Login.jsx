import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CircleNotch } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";
import { SealStamp } from "@/components/SealStamp";
import { VersionBadge } from "@/components/VersionBadge";
import { api, apiError } from "@/lib/api";
import { useAuth, homeFor } from "@/context/AuthContext";

const TABS = [
  { key: "OWNER_AUTH", label: "Pemohon", hint: "Ajukan dokumen untuk diverifikasi." },
  { key: "AUTHORITY_LOGIN", label: "Penerbit", hint: "Gunakan email korporat institusi Anda." },
];

function OtpBoxes({ value, onChange, disabled }) {
  const refs = useRef([]);
  const set = (i, v) => {
    const digit = v.replace(/\D/g, "").slice(-1);
    const arr = value.split("");
    arr[i] = digit;
    const next = arr.join("").slice(0, 6);
    onChange(next);
    if (digit && i < 5) refs.current[i + 1]?.focus();
  };
  const onKey = (i, e) => {
    if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
  };
  const onPaste = (e) => {
    const t = (e.clipboardData.getData("text") || "").replace(/\D/g, "").slice(0, 6);
    if (t) { onChange(t); refs.current[Math.min(t.length, 5)]?.focus(); e.preventDefault(); }
  };
  return (
    <div className="flex gap-2.5" onPaste={onPaste}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          data-testid={`otp-input-${i}`}
          inputMode="numeric"
          maxLength={1}
          disabled={disabled}
          value={value[i] || ""}
          onChange={(e) => set(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          className="h-16 w-full bg-ink text-center font-mono text-2xl text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
        />
      ))}
    </div>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [purpose, setPurpose] = useState("OWNER_AUTH");
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  const activeTab = TABS.find((t) => t.key === purpose);

  const requestOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/otp/request", { email: email.trim(), purpose });
      setStep(2);
      toast.success("Kode OTP dikirim (mode demo: 123456)");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await api.post("/auth/otp/verify", { email: email.trim(), purpose, otp });
      const { data: me } = await api.get("/auth/me");
      setUser(me);
      toast.success("Berhasil masuk");
      navigate(homeFor(data.user));
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <div className="grid flex-1 grid-cols-1 lg:grid-cols-2">
      {/* left editorial column */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-r border-hair p-12 lg:flex">
        <button onClick={() => navigate("/")} data-testid="login-back-home">
          <Logo />
        </button>
        <div className="pointer-events-none absolute -left-20 bottom-10 opacity-[0.05]">
          <SealStamp status="PENDING" size={460} />
        </div>
        <div className="relative">
          <h2 className="text-4xl font-medium leading-tight tracking-tighter text-bone">
            Verifikasi.
            <br />
            Privat.
            <br />
            <span className="text-emerald-seal">Terbukti.</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-bone/50">
            Masuk untuk mengajukan atau meninjau dokumen. Otentikasi tanpa kata sandi
            melalui kode sekali pakai.
          </p>
        </div>
        <p className="relative font-mono text-[11px] uppercase tracking-[0.3em] text-bone/25">
          Mode demo · kode OTP 123456
        </p>
      </div>

      {/* right form */}
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <div className="mb-8 flex border border-hair">
            {TABS.map((t) => (
              <button
                key={t.key}
                data-testid={`login-tab-${t.key}`}
                onClick={() => { setPurpose(t.key); setStep(1); setOtp(""); }}
                className={`flex-1 px-4 py-3 font-mono text-[12px] uppercase tracking-widest transition-colors duration-300 ${
                  purpose === t.key ? "bg-emerald-seal text-ink" : "text-bone/50 hover:text-bone"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <p className="mb-8 text-sm text-bone/50">{activeTab.hint}</p>

          {step === 1 ? (
            <form onSubmit={requestOtp} className="space-y-6">
              <div>
                <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">
                  Alamat Email
                </label>
                <input
                  data-testid="login-email-input"
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={purpose === "AUTHORITY_LOGIN" ? "nama@institusi.go.id" : "nama@email.com"}
                  className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
                />
                {purpose === "AUTHORITY_LOGIN" && (
                  <p className="mt-2 font-mono text-[11px] text-bone/40">Gunakan email korporat institusi Anda.</p>
                )}
              </div>
              <button
                type="submit"
                disabled={busy}
                data-testid="login-request-otp"
                className="flex w-full items-center justify-center gap-2 bg-emerald-seal px-6 py-3.5 font-mono text-[13px] font-medium uppercase tracking-widest text-ink transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-50"
              >
                {busy ? <CircleNotch size={16} className="animate-spin" /> : <ArrowRight size={16} weight="bold" />}
                Kirim Kode
              </button>
            </form>
          ) : (
            <form onSubmit={verifyOtp} className="space-y-6">
              <button
                type="button"
                onClick={() => setStep(1)}
                data-testid="otp-back"
                className="flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-bone/50 transition-colors duration-300 hover:text-bone"
              >
                <ArrowLeft size={13} /> {email}
              </button>
              <div>
                <label className="mb-3 block font-mono text-[11px] uppercase tracking-widest text-bone/50">
                  Kode Verifikasi 6 Digit
                </label>
                <OtpBoxes value={otp} onChange={setOtp} disabled={busy} />
                <p className="mt-3 font-mono text-[11px] text-amber-seal/80">Mode demo: kode 123456</p>
              </div>
              <button
                type="submit"
                disabled={busy || otp.length !== 6}
                data-testid="login-verify-otp"
                className="flex w-full items-center justify-center gap-2 bg-emerald-seal px-6 py-3.5 font-mono text-[13px] font-medium uppercase tracking-widest text-ink transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-40"
              >
                {busy ? <CircleNotch size={16} className="animate-spin" /> : null}
                Verifikasi & Masuk
              </button>
            </form>
          )}

          <div className="mt-10 border-t border-hair pt-6">
            <button
              onClick={() => navigate("/admin/login")}
              data-testid="login-to-admin"
              className="font-mono text-[11px] uppercase tracking-widest text-bone/40 transition-colors duration-300 hover:text-bone"
            >
              Masuk sebagai Admin →
            </button>
          </div>
        </div>
      </div>
      </div>

      <footer className="border-t border-hair">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-bone/25">
            Verifikasi. Privat. Terbukti.
          </span>
          <VersionBadge />
        </div>
      </footer>
    </div>
  );
}
