import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { SignOut } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";
import { VersionBadge } from "@/components/VersionBadge";
import { useAuth } from "@/context/AuthContext";

export function Shell({ children, nav = [] }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-hair bg-ink/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3.5">
          <button onClick={() => navigate("/")} data-testid="nav-logo" className="transition-opacity duration-300 hover:opacity-80">
            <Logo />
          </button>
          <nav className="hidden items-center gap-1 md:flex">
            {nav.map((n) => {
              const active = loc.pathname === n.to;
              return (
                <button
                  key={n.to}
                  data-testid={`nav-${n.to.replace(/\//g, "-")}`}
                  onClick={() => navigate(n.to)}
                  className={`px-3.5 py-1.5 font-mono text-[12px] uppercase tracking-wider transition-colors duration-300 ${
                    active ? "text-emerald-seal" : "text-bone/55 hover:text-bone"
                  }`}
                >
                  {n.label}
                </button>
              );
            })}
          </nav>
          <div className="flex items-center gap-4">
            {user && (
              <span className="hidden font-mono text-[11px] text-bone/50 sm:inline" data-testid="nav-user-email">
                {user.email}
              </span>
            )}
            <button
              onClick={async () => {
                await logout();
                navigate("/login");
              }}
              data-testid="logout-button"
              className="flex items-center gap-1.5 border border-hair px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider text-bone/70 transition-colors duration-300 hover:border-rose-seal/60 hover:text-rose-seal"
            >
              <SignOut size={14} weight="bold" /> Keluar
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-10">{children}</main>
      <footer className="border-t border-hair">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-bone/25">
            Verifikasi. Privat. Terbukti.
          </span>
          <VersionBadge />
        </div>
      </footer>
    </div>
  );
}
