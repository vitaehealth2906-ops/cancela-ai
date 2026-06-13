"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Em produção isso vai pro log da Vercel; aqui só evita engolir o erro.
    console.error(error);
  }, [error]);

  function recomeçar() {
    try {
      localStorage.removeItem("cancelaia.insights");
      localStorage.removeItem("cancelaia.persona");
    } catch {
      /* ignore */
    }
    reset();
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-5">
      <div className="w-full max-w-md rounded-card border border-stone-200 bg-surface p-7 text-center shadow-md">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-icon bg-danger-bg text-danger-fg">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-semibold text-ink">Algo travou aqui</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-stone-500">
          Tivemos um problema inesperado ao carregar esta tela. Você pode tentar de
          novo — seus dados de público continuam salvos.
        </p>
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            onClick={reset}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <RotateCcw className="h-4 w-4" /> Tentar de novo
          </button>
          <button
            onClick={recomeçar}
            className="w-full rounded-xl px-5 py-2.5 text-sm font-medium text-stone-500 transition hover:text-brand-700"
          >
            Recomeçar do zero
          </button>
        </div>
      </div>
    </div>
  );
}
