import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, CircleNotch, ShieldCheck } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";
import { VersionBadge } from "@/components/VersionBadge";
import { api, apiError } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

export default function AdminLogin() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.post("/auth/admin/login", { email: email.trim(), password });
      const { data: me } = await api.get("/auth/me");
      setUser(me);
      toast.success("Selamat datang, Admin");
      navigate("/admin");
    } catch (err) {
      toast.error(apiError(err.response?.data?.detail));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-hair px-6 py-5">
        <button onClick={() => navigate("/")} data-testid="admin-back-home"><Logo /></button>
      </header>
      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2 font-mono text-[12px] uppercase tracking-[0.3em] text-amber-seal">
            <ShieldCheck size={16} weight="fill" /> Konsol Admin
          </div>
          <h1 className="mb-8 text-3xl font-medium tracking-tighter text-bone">Masuk Operator</h1>
          <form onSubmit={submit} className="space-y-5">
            <div>
              <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">Email</label>
              <input
                data-testid="admin-email-input"
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-ink px-4 py-3.5 font-mono text-sm text-bone border border-hair transition-colors duration-300 focus:border-emerald-seal"
              />
            </div>
            <div>
              <label className="mb-2 block font-mono text-[11px] uppercase tracking-widest text-bone/50">Kata Sandi</label>
              <input
                data-testid="admin-password-input"
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
              data-testid="admin-login-submit"
              className="flex w-full items-center justify-center gap-2 bg-emerald-seal px-6 py-3.5 font-mono text-[13px] font-medium uppercase tracking-widest text-ink transition-transform duration-300 hover:-translate-y-0.5 disabled:opacity-50"
            >
              {busy ? <CircleNotch size={16} className="animate-spin" /> : null} Masuk
            </button>
          </form>
          <button
            onClick={() => navigate("/login")}
            data-testid="admin-to-user-login"
            className="mt-8 flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest text-bone/40 transition-colors duration-300 hover:text-bone"
          >
            <ArrowLeft size={13} /> Masuk Pemohon / Penerbit
          </button>
        </div>
      </div>
      <footer className="border-t border-hair">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between px-6 py-4">
          <VersionBadge />
          <span className="font-mono text-[10px] uppercase tracking-widest text-bone/25">
            Verifikasi. Privat. Terbukti.
          </span>
        </div>
      </footer>
    </div>
  );
}
