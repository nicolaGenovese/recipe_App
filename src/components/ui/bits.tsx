"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useApp } from "@/state/AppProvider";
import { pageWindow } from "@/lib/pages";

export function MetricTile({ label, children, foot, id }: { label: string; children: ReactNode; foot?: ReactNode; id?: string }) {
  return (
    <div className="metric-tile">
      <span>{label}</span>
      <strong id={id}>{children}</strong>
      {foot}
    </div>
  );
}

export function Callout({ title, children }: { title: string; children: ReactNode }) {
  return <div className="inline-callout"><strong>{title}</strong><span>{children}</span></div>;
}

export function AllergenTags({ items, empty }: { items: string[]; empty: string }) {
  const { t } = useApp();
  return (
    <div className="allergen-tags">
      {items.length ? items.map((item) => <span key={item} className="allergen-tag">{t(item)}</span>) : <span className="field-hint">{empty}</span>}
    </div>
  );
}

/** Numbered page buttons; hidden when everything fits on one page. */
export function Pager({ pages, page, onPage }: { pages: number; page: number; onPage: (page: number) => void }) {
  if (pages <= 1) return null;
  return (
    <div className="pagination">
      <span />
      <div className="pagination-controls">
        {pageWindow(page, pages).map((number, index) => number === null
          ? <span key={"gap" + index} className="page-gap" aria-hidden="true">…</span>
          : <button key={number} type="button" className={"page-button" + (number === page ? " active" : "")} aria-current={number === page ? "page" : undefined} onClick={() => onPage(number)}>{number}</button>)}
      </div>
    </div>
  );
}

/**
 * The message at the bottom of the screen. Errors are read out at once and stay until closed; the
 * other messages are read when the screen reader is free and go away by themselves. It is shown as a
 * popover, so it stays on top of an open dialog instead of behind its dimmed backdrop.
 */
export function Toast() {
  const { toast, dismissToast, t } = useApp();
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = box.current;
    if (!element || typeof element.showPopover !== "function") return;
    try {
      // Shown again for each message, so it goes above a dialog opened in the meantime.
      if (element.matches(":popover-open")) element.hidePopover();
      if (toast) element.showPopover();
    } catch { /* Without popovers the message still shows, fixed at the bottom. */ }
  }, [toast]);
  return (
    <>
      <div className="visually-hidden" role="status" aria-live="polite">{toast && !toast.error ? toast.message : ""}</div>
      <div className="visually-hidden" role="alert" aria-live="assertive">{toast?.error ? toast.message : ""}</div>
      <div ref={box} popover="manual" className={"toast" + (toast ? " show" : "") + (toast?.error ? " error" : "")}>
        {toast?.error ? <strong className="toast-icon" aria-hidden="true">!</strong> : null}
        <span className="toast-text" aria-hidden="true">{toast?.message}</span>
        {toast ? <button type="button" className="toast-close" onClick={dismissToast} aria-label={t("Chiudi il messaggio")}>×</button> : null}
      </div>
    </>
  );
}
