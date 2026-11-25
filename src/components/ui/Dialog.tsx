"use client";

import { createContext, useCallback, useContext, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/state/AppProvider";

const DialogContext = createContext<{ titleId: string; requestClose: () => void } | null>(null);

/** Fields whose typing is not an edit: searches and filters inside a dialog. */
const NOT_AN_EDIT = "[type=search], [data-not-an-edit]";

/**
 * The single modal dialog. It opens on mount with the keyboard focus on its first field, and gives
 * the focus back to the button that opened it when it closes. Escape, the × button and a click on
 * the backdrop all close it; with `warnOnClose` (the default, for forms) they first ask before
 * throwing away what was typed, and so does leaving the page.
 */
export function Dialog({ size = "normal", warnOnClose = true, children }: { size?: "narrow" | "normal" | "wide"; warnOnClose?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { closeDialog, t } = useApp();
  const titleId = useId();
  const edited = useRef(false);
  const warn = useRef(warnOnClose);
  warn.current = warnOnClose;
  // The control that opened the dialog, read before the dialog takes the focus.
  const [opener] = useState(() => (typeof document !== "undefined" && document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null));

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    if (dialog) {
      dialog.scrollTop = 0;
      // Typing can start at once: the first field of the form, otherwise the dialog's own first control.
      const first = dialog.querySelector<HTMLElement>(".dialog-content :is(input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]), select, textarea):not(:disabled)");
      first?.focus({ preventScroll: true });
    }
    const leave = (event: BeforeUnloadEvent) => {
      if (edited.current && warn.current) { event.preventDefault(); event.returnValue = ""; }
    };
    window.addEventListener("beforeunload", leave);
    return () => {
      window.removeEventListener("beforeunload", leave);
      // The opener may have gone (a deleted row): then the focus stays where the browser puts it.
      if (opener?.isConnected) opener.focus({ preventScroll: true });
    };
  }, [opener]);

  const requestClose = useCallback(() => {
    if (edited.current && warn.current && !window.confirm(t("Chiudere senza salvare? Le modifiche andranno perse."))) return;
    closeDialog();
  }, [closeDialog, t]);

  const markEdited = (event: { target: EventTarget | null }) => {
    if (!(event.target instanceof Element) || !event.target.closest(NOT_AN_EDIT)) edited.current = true;
  };

  const className = "app-dialog" + (size === "narrow" ? " dialog-narrow" : size === "wide" ? " dialog-wide" : "");
  return (
    <DialogContext.Provider value={{ titleId, requestClose }}>
      <dialog
        ref={ref}
        className={className}
        aria-labelledby={titleId}
        onCancel={(event) => { event.preventDefault(); requestClose(); }}
        // Some browsers close the dialog themselves on a second Escape: the app follows. A dialog
        // already taken off the page (replaced by the next one) must not close its successor.
        onClose={() => { if (ref.current?.isConnected) closeDialog(); }}
        onClick={(event) => { if (event.target === ref.current) requestClose(); }}
        onInputCapture={markEdited}
        onChangeCapture={markEdited}
        // Pressing the main button of the footer saves: what was typed is no longer at risk.
        onClickCapture={(event) => { if (event.target instanceof Element && event.target.closest(".dialog-footer .button-primary")) edited.current = false; }}
      >
        <div className="dialog-content">{children}</div>
      </dialog>
    </DialogContext.Provider>
  );
}

export function DialogHeader({ kicker, title, subtitle }: { kicker: string; title: string; subtitle?: string }) {
  const { closeDialog, t } = useApp();
  const context = useContext(DialogContext);
  return (
    <header className="dialog-header">
      <div>
        <div className="dialog-kicker">{kicker}</div>
        <h2 id={context?.titleId}>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      <button type="button" className="dialog-close" onClick={context?.requestClose ?? closeDialog} aria-label={t("Chiudi")}>×</button>
    </header>
  );
}
