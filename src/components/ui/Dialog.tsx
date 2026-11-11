"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useApp } from "@/state/AppProvider";

/** The single modal dialog. It opens on mount; Escape, the × button and a backdrop click all close it. */
export function Dialog({ size = "normal", children }: { size?: "narrow" | "normal" | "wide"; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { closeDialog } = useApp();

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    if (dialog) dialog.scrollTop = 0;
  }, []);

  const className = "app-dialog" + (size === "narrow" ? " dialog-narrow" : size === "wide" ? " dialog-wide" : "");
  return (
    <dialog
      ref={ref}
      className={className}
      onCancel={(event) => { event.preventDefault(); closeDialog(); }}
      onClick={(event) => { if (event.target === ref.current) closeDialog(); }}
    >
      <div className="dialog-content">{children}</div>
    </dialog>
  );
}

export function DialogHeader({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  const { closeDialog, t } = useApp();
  return (
    <header className="dialog-header">
      <div>
        <div className="dialog-kicker">{kicker}</div>
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <button type="button" className="dialog-close" onClick={closeDialog} aria-label={t("Chiudi")}>×</button>
    </header>
  );
}
