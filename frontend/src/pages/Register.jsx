import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, CircleNotch, UserPlus, BuildingOffice, Envelope } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";
import { SealStamp } from "@/components/SealStamp";
import { VersionBadge } from "@/components/VersionBadge";
import { api, apiError } from "@/lib/api";
import { useAuth, homeFor } from "@/context/AuthContext";
import { REGISTER } from "@/constants/testIds/auth";

const ROLES = [
  { key: "OWNER", label: "Pemohon", hint: "Ajukan dokumen untuk diverifikasi." },
  { key: "AUTHORITY", label: "Penerbit", hint: "Gunakan email korporat institusi Anda." },
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

export default function Register() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [step, setStep] = useState(1);
  const [busy, setBusy] = useState(false);

  // step 1 fields
  const [role, setRole] = useState("OWNER");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [instOption, setInstOption] = useState("existing"); // "existing" | "new"
  const [institutionId, setInstitutionId] = useState("");
  const [instName, setInstName] = useState("");
  const [instDomain, setInstDomain] = useState("");
  const [institutions, setInstitutions] = useState([]);

  // step 2 fields
  const [otp, setOtp] = useState("");

  // fetch active institutions when role is AUTHORITY
  useEffect(() => {
    if (role === "AUTHORITY") {
      api.get("/institutions/active").then(({ data }) => {
        setInstitutions(data);
      }).catch(() => {});
    }
  }, [role]);

  const submitStep1 = async (e) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Kata sandi minimal 8 karakter");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("Konfirmasi kata sandi tidak cocok");
      return;
    }
    if (role === "AUTHORITY") {
      if (instOption === "existing" && !institutionId) {
        toast.error("Pilih institusi atau daftar baru");
        return;
      }
      if (instOption === "new" && (!instName.trim() || !instDomain.trim())) {
        toast.error("Pilih institusi atau daftar baru");
        return;
      }
    }
    setBusy(true);
    try {
      const body = {
        name: name.trim(),
        email: email.trim(),
        password,
        role: role === "OWNER" ? "OWNER" : "AUTHORITY",
      };
      if (role === "AUTHORITY") {
        if (instOption === "existing") {
          body.institutionId = institutionId;
        } else {
          body.newInstitutionName = instName.trim();
          body.newInstitutionDomain = instDomain.trim();
        }
      }
      await api.post("/auth/register/request", body);
      setStep(2);
      toast.success("Kode OTP dikirim (mode demo: 123456)");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  const submitStep2 = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/register/verify", { email: email.trim(), otp });
      const { data: me } = await api.get("/auth/me");
      setUser(me);
      toast.success("Akun berhasil dibuat");
      navigate(homeFor(me));
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
        <button onClick={() => navigate("/")} data-testid="register-back-home">
          <Logo />
        </button>
        <div className="pointer-events-none absolute -left-20 bottom-10 opacity-[0.05]">
          <SealStamp status="PENDING" size={460} />
        </div>
        <div className="relative">
          <h2 className="text-4xl font-medium leading-tight tracking-tighter text-bone">
            Daftar.
            <br />
            Aman.
            <br />
            <span className="text-emerald-seal">Terpercaya.</span>
          </h2>
          <p className="mt-6 max-w-sm text-sm leading-relaxed text-bone/50">
            Buat akun untuk mengajukan atau menerbitkan dokumen. Verifikasi melalui kode sekali pakai.
          </p>
        </div>
        <p className="relative font-mono text-[11px] uppercase tracking-[0.3em] text-bone/25">
          Mode demo · kode OTP 123456
        </p>
      </div>

      {/* right form */}
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          {step === 1 ? (
            <>
              <div className="mb-8 flex border border-hair">
                {ROLES.map((r) => (
                  <button
                    key={r.key}
                    data-testid={`register-role-${r.key === "OWNER" ? "OWNER_AUTH" : "AUTHORITY_LOGIN"}`}
                    onClick={() => { setRole(r.key); setInstitutionId(""); setInstName(""); setInstDomain(""); }}
                    className={`flex-1 px-4 py-3 font-mono text-[12px] uppercase tracking-widest transition-colors duration-300 ${
                      role === r.key ? "bg-emerald-seal text-ink" : "text-bone/50 hover:text-bone"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              <p className="mb-8 text-sm text-bone/50">{ROLES.find((r) => r.key === role).hint}</p>

              <form onSubmit={submitStep1} className="space-y-6">
                <div>
                  <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">
                    Nama Lengkap
                  </label>
                  <input
                    data-testid={REGISTER.nameInput}
                    type="text"
                    required
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
                  />
                </div>
                <div>
                  <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">
                    Alamat Email
                  </label>
                  <input
                    data-testid={REGISTER.emailInput}
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={role === "AUTHORITY" ? "nama@institusi.go.id" : "nama@email.com"}
                    className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
                  />
                  {role === "AUTHORITY" && (
                    <p className="mt-2 font-mono text-[11px] text-bone/40">Gunakan email korporat institusi Anda.</p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">
                    Kata Sandi
                  </label>
                  <input
                    data-testid={REGISTER.passwordInput}
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
                  />
                  <p className="mt-2 font-mono text-[11px] text-bone/40">Minimal 8 karakter</p>
                </div>
                <div>
                  <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">
                    Konfirmasi Kata Sandi
                  </label>
                  <input
                    data-testid={REGISTER.passwordConfirmInput}
                    type="password"
                    required
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
                  />
                </div>

                {role === "AUTHORITY" && (
                  <div className="space-y-4 border-t border-hair pt-6">
                    <label className="mb-3 block font-mono text-[11px] uppercase tracking-widest text-bone/50">
                      Institusi
                    </label>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="instOption"
                          checked={instOption === "existing"}
                          onChange={() => setInstOption("existing")}
                          className="accent-emerald-seal"
                        />
                        <span className="font-mono text-[12px] text-bone/70">Pilih institusi aktif</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="instOption"
                          checked={instOption === "new"}
                          onChange={() => setInstOption("new")}
                          className="accent-emerald-seal"
                        />
                        <span className="font-mono text-[12px] text-bone/70">Daftar institusi baru</span>
                      </label>
                    </div>

                    {instOption === "existing" ? (
                      <select
                        data-testid="register-institution-select"
                        value={institutionId}
                        onChange={(e) => setInstitutionId(e.target.value)}
                        className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
                      >
                        <option value="" className="bg-panel">— pilih institusi —</option>
                        {institutions.map((i) => (
                          <option key={i.institutionId} value={i.institutionId} className="bg-panel">
                            {i.name} · {i.domain}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">
                            Nama Institusi
                          </label>
                          <input
                            data-testid="register-inst-name-input"
                            type="text"
                            required={instOption === "new"}
                            value={instName}
                            onChange={(e) => setInstName(e.target.value)}
                            className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
                          />
                        </div>
                        <div>
                          <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">
                            Domain
                          </label>
                          <input
                            data-testid="register-inst-domain-input"
                            type="text"
                            required={instOption === "new"}
                            value={instDomain}
                            onChange={(e) => setInstDomain(e.target.value)}
                            placeholder="institusi.ac.id"
                            className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
                          />
                          <p className="mt-2 font-mono text-[11px] text-bone/40">Domain harus sama dengan domain email Anda</p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  data-testid={REGISTER.submitButton}
                  className="flex w-full items-center justify-center gap-2 bg-emerald-seal px-6 py-3.5 font-mono text-[13px] font-medium uppercase tracking-widest text-ink transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-50"
                >
                  {busy ? <CircleNotch size={16} className="animate-spin" /> : <ArrowRight size={16} weight="bold" />}
                  Daftar
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={submitStep2} className="space-y-6">
              <button
                type="button"
                onClick={() => setStep(1)}
                data-testid="register-back"
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
                data-testid="register-verify-otp"
                className="flex w-full items-center justify-center gap-2 bg-emerald-seal px-6 py-3.5 font-mono text-[13px] font-medium uppercase tracking-widest text-ink transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-40"
              >
                {busy ? <CircleNotch size={16} className="animate-spin" /> : null}
                Verifikasi & Buat Akun
              </button>
            </form>
          )}

          <div className="mt-10 border-t border-hair pt-6">
            <button
              onClick={() => navigate("/login")}
              data-testid={REGISTER.loginLink}
              className="font-mono text-[11px] uppercase tracking-widest text-bone/40 transition-colors duration-300 hover:text-bone"
            >
              Sudah punya akun? Masuk →
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
