"use client";

import { useRef } from "react";
import { useApp } from "@/state/AppProvider";

/**
 * Opens the file picker (or the camera on phones) straight from the tap, then opens a new delivery
 * that reads the chosen photos or PDF. Picking first works everywhere, iPhone included, where a
 * picker opened later by code is ignored.
 */
export function ScanInvoiceButton({ className = "button button-secondary" }: { className?: string }) {
  const { openDialog, t } = useApp();
  const input = useRef<HTMLInputElement>(null);
  return (
    <>
      <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(event) => {
        const files = Array.from(event.target.files || []);
        event.target.value = "";
        if (files.length) openDialog({ kind: "stockDelivery", files });
      }} />
      <button className={className} type="button" onClick={() => input.current?.click()}>{t("📷 Scansiona fattura")}</button>
    </>
  );
}
