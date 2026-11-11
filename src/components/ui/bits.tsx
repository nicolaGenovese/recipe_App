"use client";

import type { ReactNode } from "react";
import { useApp } from "@/state/AppProvider";

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
        {Array.from({ length: pages }, (_, index) => (
          <button key={index} type="button" className={"page-button" + (index + 1 === page ? " active" : "")} onClick={() => onPage(index + 1)}>{index + 1}</button>
        ))}
      </div>
    </div>
  );
}

export function Toast() {
  const { toast } = useApp();
  return <div className={"toast" + (toast ? " show" : "") + (toast?.error ? " error" : "")} role="status" aria-live="polite">{toast?.message}</div>;
}
