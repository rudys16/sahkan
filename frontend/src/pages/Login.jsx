import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowRight, CircleNotch } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";
import { SealStamp } from "@/components/SealStamp";
import { VersionBadge } from "@/components/VersionBadge";
import { api, apiError } from "@/lib/api";
import { useAuth, homeFor } from "@/context/AuthContext";
import { LOGIN } from "@/constants/testIds/auth";

export default function Login() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/login", { email: email.trim(), password });
      const { data: me } = await api.get("/auth/me");
      setUser(me);
      toast.success("Berhasil masuk");
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
            Masuk dengan email dan kata sandi untuk mengajukan atau meninjau dokumen.
          </p>
        </div>
        <p className="relative font-mono text-[11px] uppercase tracking-[0.3em] text-bone/25">
          Mode demo · admin@sahkan.id / Sahkan!Admin2026
        </p>
      </div>

      {/* right form */}
      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-md">
          <form onSubmit={submit} className="space-y-6">
            <div>
              <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">
                Alamat Email
              </label>
              <input
                data-testid={LOGIN.emailInput}
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@email.com"
                className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
              />
            </div>
            <div>
              <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">
                Kata Sandi
              </label>
              <input
                data-testid={LOGIN.passwordInput}
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              data-testid={LOGIN.submitButton}
              className="flex w-full items-center justify-center gap-2 bg-emerald-seal px-6 py-3.5 font-mono text-[13px] font-medium uppercase tracking-widest text-ink transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-50"
            >
              {busy ? <CircleNotch size={16} className="animate-spin" /> : <ArrowRight size={16} weight="bold" />}
              Masuk
            </button>
          </form>

          <div className="mt-10 border-t border-hair pt-6">
            <button
              onClick={() => navigate("/register")}
              data-testid={LOGIN.registerLink}
              className="font-mono text-[11px] uppercase tracking-widest text-bone/40 transition-colors duration-300 hover:text-bone"
            >
              Belum punya akun? Daftar →
            </button>
          </div>

          <div className="mt-6">
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
