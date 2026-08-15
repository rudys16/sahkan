import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import { CircleNotch, Warning } from "@phosphor-icons/react";
import { API } from "@/lib/api";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";

// Renders a decrypted PDF (fetched with credentials) to canvases.
// Embedded JavaScript is NEVER executed — pdf.js only rasterizes page content.
export function PdfViewer({ docId }) {
  const containerRef = useRef(null);
  const [state, setState] = useState("loading"); // loading | ok | error
  const [pages, setPages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (container) container.innerHTML = "";

    async function render() {
      setState("loading");
      try {
        const res = await fetch(`${API}/authority/documents/${docId}/blob`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("blob");
        const buf = await res.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({
          data: buf,
          isEvalSupported: false,
          disableAutoFetch: true,
        }).promise;
        if (cancelled) return;
        setPages(pdf.numPages);
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.4 });
          const canvas = document.createElement("canvas");
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          canvas.className = "w-full border border-hair bg-white mb-4 shadow-lg";
          const ctx = canvas.getContext("2d");
          if (container && !cancelled) container.appendChild(canvas);
          await page.render({ canvasContext: ctx, viewport }).promise;
        }
        if (!cancelled) setState("ok");
      } catch (e) {
        if (!cancelled) setState("error");
      }
    }
    render();
    return () => {
      cancelled = true;
    };
  }, [docId]);

  return (
    <div className="relative">
      {state === "loading" && (
        <div className="flex h-72 items-center justify-center gap-3 font-mono text-sm text-bone/50">
          <CircleNotch size={18} className="animate-spin" /> Memuat pratinjau aman…
        </div>
      )}
      {state === "error" && (
        <div className="flex h-72 flex-col items-center justify-center gap-2 font-mono text-sm text-rose-seal/80">
          <Warning size={22} /> Gagal memuat pratinjau dokumen.
        </div>
      )}
      <div ref={containerRef} data-testid="pdf-canvas-container" />
      {state === "ok" && (
        <p className="mt-1 font-mono text-[11px] text-bone/40">
          {pages} halaman · JavaScript tertanam TIDAK dieksekusi
        </p>
      )}
    </div>
  );
}
