"use client";

import { useRef, useState } from "react";
import { photoUrl, shrinkImage } from "@/lib/images";
import { newId } from "@/lib/num";
import { photoIdsOf } from "@/lib/safety/photos";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

/** Large enough to read a thermometer display, small enough for a year of daily photos. */
const MAX_SIDE = 1280;
const QUALITY = 0.72;

interface Props {
  value?: string;
  onChange: (id: string | undefined) => void;
  /** What the photo is of, for screen readers and messages ("Frigo 1"). */
  label: string;
  /** A temperature is written and the settings require a photo, but there is none yet. */
  needed?: boolean;
  /** Kitchen mode: large touch target. */
  big?: boolean;
}

/**
 * Takes a photo of a thermometer with the camera and stores it at once, so saving the record stays
 * quick. Shows the photo once taken; it can be opened full size, taken again or removed.
 */
export function PhotoButton({ value, onChange, label, needed, big }: Props) {
  const { data, notify, t } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  /** A photo taken here but not saved in any record yet is deleted when it is replaced or removed. */
  const forget = (id: string | undefined) => {
    if (!id || data.safetyLogs.some((log) => photoIdsOf(log).includes(id))) return;
    api.deletePhoto(id).catch(() => undefined);
  };

  async function take(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const image = await shrinkImage(file, MAX_SIDE, QUALITY);
      const id = newId();
      await api.savePhoto(id, image.mimeType, image.data);
      forget(value);
      onChange(id);
    } catch (error) {
      notify(t(error instanceof Error && error.message !== "photo" ? error.message : "Foto non salvata: riprova."), true);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const className = "photo-button" + (big ? " big" : "") + (needed ? " needed" : "") + (value ? " has-photo" : "");
  return (
    <span className={className}>
      <input ref={input} type="file" accept="image/*" capture="environment" hidden onChange={(event) => void take(event.target.files?.[0])} />
      {value ? (
        <>
          <a href={photoUrl(value)} target="_blank" rel="noopener noreferrer" className="photo-thumb" aria-label={t("Apri la foto") + " · " + label}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl(value)} alt="" />
          </a>
          <button type="button" className="photo-action" disabled={busy} onClick={() => input.current?.click()} aria-label={t("Rifai la foto") + " · " + label} title={t("Rifai la foto")}>↻</button>
          <button type="button" className="photo-action" disabled={busy} onClick={() => { forget(value); onChange(undefined); }} aria-label={t("Togli la foto") + " · " + label} title={t("Togli la foto")}>×</button>
        </>
      ) : (
        <button type="button" className="photo-take" disabled={busy} onClick={() => input.current?.click()} aria-label={t("Foto") + " · " + label}>
          {busy ? "…" : "📷"}{big ? <span>{busy ? t("Invio…") : t("Foto")}</span> : null}
        </button>
      )}
    </span>
  );
}

/** A camera icon in the registers that opens the photo, without opening the record. */
export function PhotoLink({ id }: { id?: string }) {
  const { t } = useApp();
  if (!id) return null;
  return <a className="photo-link" href={photoUrl(id)} target="_blank" rel="noopener noreferrer" onClick={(event) => event.stopPropagation()} aria-label={t("Apri la foto")} title={t("Apri la foto")}>📷</a>;
}
