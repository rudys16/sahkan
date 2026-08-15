import React from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "@phosphor-icons/react";
import { Logo } from "@/components/Logo";

const steps = [
  { n: "01", t: "Ajukan", d: "Unggah dokumen Anda dalam hitungan detik. Sejak awal, berkas langsung diamankan dan hanya dapat diakses oleh institusi tujuan — privasi Anda terjaga sepenuhnya." },
  { n: "02", t: "Review", d: "Institusi resmi meninjau dokumen Anda di ruang yang aman dan tenang. Setiap detail diperiksa dengan saksama sebelum keputusan diambil." },
  { n: "03", t: "Terverifikasi", d: "Terima keputusan resmi bersegel yang tak dapat dipalsukan. Bukti keasliannya melekat selamanya, sementara berkas asli Anda dihapus demi keamanan." },
];

export default function Landing() {
  const navigate = useNavigate();
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -right-24 top-0 opacity-[0.06]">
        <img src="/sahkan-logo-transparent.png" alt="" className="w-[560px]" />
      </div>

      <header className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-6">
        <Logo />
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/verifikasi")}
            data-testid="landing-verify-top"
            className="hidden font-mono text-[12px] uppercase tracking-widest text-bone/60 transition-colors duration-300 hover:text-bone sm:inline"
          >
            Verifikasi Dokumen
          </button>
          <button
            onClick={() => navigate("/login")}
            data-testid="landing-login-top"
            className="flex items-center gap-2 border border-hair px-4 py-2 font-mono text-[12px] uppercase tracking-widest text-bone/80 transition-colors duration-300 hover:border-emerald-seal hover:text-emerald-seal"
          >
            Masuk <ArrowRight size={14} weight="bold" />
          </button>
        </div>
      </header>

      <section className="mx-auto grid max-w-[1400px] grid-cols-1 gap-10 px-6 pb-24 pt-16 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8 font-mono text-[12px] uppercase tracking-[0.4em] text-emerald-seal"
          >
            Platform Verifikasi Dokumen Institusional
          </motion.p>
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="text-5xl font-medium leading-[1.02] tracking-tighter text-bone sm:text-6xl lg:text-[5.4rem]"
          >
            Verifikasi.
            <br />
            <span className="text-bone/50">Privat.</span>
            <br />
            <span className="text-emerald-seal">Terbukti.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-8 max-w-xl text-base leading-relaxed text-bone/60"
          >
            Sahkan memverifikasi keaslian dokumen antar-institusi tanpa pernah menyimpan
            berkas Anda. Setiap keputusan ditandatangani secara kriptografis dan dapat diaudit selamanya.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <button
              onClick={() => navigate("/login")}
              data-testid="landing-cta-masuk"
              className="group flex items-center gap-2 bg-emerald-seal px-6 py-3 font-mono text-[13px] font-medium uppercase tracking-widest text-ink transition-transform duration-300 hover:-translate-y-0.5"
            >
              Masuk
              <ArrowUpRight size={16} weight="bold" className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </button>
            <button
              onClick={() => navigate("/verifikasi")}
              data-testid="landing-cta-verify"
              className="font-mono text-[12px] uppercase tracking-widest text-emerald-seal/80 underline-offset-4 transition-colors duration-300 hover:text-emerald-seal hover:underline"
            >
              Verifikasi dokumen
            </button>
            <button
              onClick={() => navigate("/admin/login")}
              data-testid="landing-admin-login"
              className="font-mono text-[12px] uppercase tracking-widest text-bone/40 underline-offset-4 transition-colors duration-300 hover:text-bone hover:underline"
            >
              Masuk sebagai Admin
            </button>
          </motion.div>
        </div>

        <div className="flex items-center justify-center lg:col-span-4">
          <img
            src="/sahkan-logo-transparent.png"
            alt="Sahkan — Verifikasi. Privat. Terbukti."
            data-testid="landing-hero-logo"
            className="w-full max-w-[360px] animate-fade-up"
          />
        </div>
      </section>

      <section className="border-t border-hair">
        <div className="mx-auto grid max-w-[1400px] grid-cols-1 md:grid-cols-3">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`grain relative overflow-hidden px-8 py-12 ${i < 2 ? "md:border-r border-hair" : ""} border-b border-hair md:border-b-0`}
            >
              <div className="mb-6 font-mono text-[13px] tracking-widest text-emerald-seal">{s.n}</div>
              <h3 className="mb-3 text-2xl font-medium tracking-tight text-bone">{s.t}</h3>
              <p className="text-sm leading-relaxed text-bone/55">{s.d}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-[1400px] px-6 py-10">
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-bone/30">
          Sahkan · Keaslian yang terbukti, privasi yang selalu terjaga
        </p>
      </footer>
    </div>
  );
}
