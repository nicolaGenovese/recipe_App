"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { dishKey, mapKey, matchesAny, resolveRecipe } from "@/lib/orders/orders";
import type { OrdersConfig, PosSetup, Station } from "@/lib/orders/types";
import { newId } from "@/lib/num";
import type { Recipe } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";

const splitWords = (value: string) => value.split(",").map((word) => word.trim()).filter(Boolean);

/** The recipe whose name shares most words with the till's name, when it is close enough to suggest. */
function suggestion(name: string, recipes: Recipe[]): Recipe | undefined {
  const words = new Set(dishKey(name).split(" ").filter((word) => word.length > 2));
  if (!words.size) return undefined;
  let best: { recipe: Recipe; score: number } | undefined;
  for (const recipe of recipes) {
    const own = dishKey(recipe.name).split(" ").filter((word) => word.length > 2);
    if (!own.length) continue;
    const shared = own.filter((word) => words.has(word) || Array.from(words).some((other) => other.startsWith(word) || word.startsWith(other))).length;
    const score = shared / Math.max(own.length, words.size);
    if (score > (best?.score ?? 0)) best = { recipe, score };
  }
  return best && best.score >= 0.5 ? best.recipe : undefined;
}

/**
 * Settings → Till and orders, for this site: the webhook address to paste in the till, the last
 * notices received (to check what the till sends), a test order, the stations of the kitchen
 * screens with the alarm times, and the matching of till dishes to recipes. Saved at once.
 */
export function OrdersPane() {
  const { data, t, fmt, f, notify, can, access, setView } = useApp();
  const full = can("orders.setup");
  const mapping = can("menus.edit");
  const [setup, setSetup] = useState<PosSetup | null>(null);
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<OrdersConfig | null>(null);
  const [secret, setSecret] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(true);

  const load = useCallback(async () => {
    try { const next = await api.posSetup(); setSetup(next); setDraft(next.config); }
    catch (error) { notify(t(error instanceof Error ? error.message : String(error)), true); }
  }, [notify, t]);
  useEffect(() => { void load(); }, [load, access?.site.id]);

  const send = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true);
    try {
      const next = await api.posAction(body);
      setSetup(next);
      if (body.action !== "map") setDraft(next.config);
      else setDraft((old) => (old ? { ...old, dishMap: next.config.dishMap } : next.config));
      if (done) notify(t(done));
    } catch (error) {
      notify(t(error instanceof Error ? error.message : String(error)), true);
    }
    setBusy(false);
  };

  const origin = typeof window === "undefined" ? "" : window.location.origin;
  const url = setup?.token ? origin + "/api/pos/" + setup.token : "";
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); notify(t("Copiato.")); }
    catch { notify(t("Copia non riuscita: seleziona il testo e copialo a mano."), true); }
  };

  const recipes = useMemo(() => data.recipes.filter((recipe) => !recipe.archivedBatch).sort((a, b) => a.name.localeCompare(b.name)), [data.recipes]);
  const suggestions = useMemo(() => Array.from(new Set([
    ...data.settings.categories,
    ...(setup?.items ?? []).map((item) => item.category).filter(Boolean)
  ])).sort((a, b) => a.localeCompare(b)), [data.settings.categories, setup?.items]);

  /** The log line is written in Italian on the server: its words are translated here. */
  const summaryText = (summary: string) => summary.split(" | ").map((part) => part.split(" · ").map((piece, index) => {
    if (index === 0) return t(piece);
    const table = /^tavolo (.+)$/.exec(piece);
    if (table) return fmt(t("tavolo {0}"), table[1]);
    const lines = /^(\d+) (riga|righe)$/.exec(piece);
    if (lines) return fmt(t(lines[1] === "1" ? "{0} riga" : "{0} righe"), lines[1]);
    return piece;
  }).join(" · ")).join(" | ");

  if (!setup || !draft) return <section className="settings-pane active"><p>{t("Carico…")}</p></section>;

  const dirty = JSON.stringify({ ...draft, dishMap: {} }) !== JSON.stringify({ ...setup.config, dishMap: {} });
  const patchStation = (id: string, change: Partial<Station>) => setDraft({ ...draft, stations: draft.stations.map((row) => (row.id === id ? { ...row, ...change } : row)) });
  const items = setup.items.map((item) => {
    const auto = resolveRecipe(item, {}, data.recipes);
    const chosen = draft.dishMap[mapKey(item)] ?? (item.plu ? draft.dishMap["name:" + dishKey(item.name)] : undefined);
    const recipeId = resolveRecipe(item, draft.dishMap, data.recipes);
    return { ...item, auto, chosen, recipeId, notFood: matchesAny(draft.notFood, item) };
  });
  const shown = items.filter((item) => !onlyMissing || (!item.recipeId && !item.notFood));
  const missing = items.filter((item) => !item.recipeId && !item.notFood).length;

  return (
    <section className="settings-pane active pos-pane">
      <div>
        <h3>{t("Cassa e comande")}</h3>
        <p>{fmt(t("Collegamento alla cassa e schermi delle comande di {0}. Si salva subito."), access?.site.name ?? t("questa cucina"))}</p>
      </div>

      {full ? (
        <div className="pos-section">
          <h3>{t("Collegamento alla cassa")} {setup.token ? <span className={"pos-status " + (setup.enabled ? "on" : "off")}>{t(setup.enabled ? "Attivo" : "Sospeso")}</span> : null}</h3>
          <p>{t("Qualsiasi cassa che manda webhook (avvisi HTTP con gli ordini in JSON) può collegarsi: incolla l'indirizzo nel pannello della cassa, o in un servizio che la collega come Zapier, Make o n8n, per ordini mandati in cucina, modifiche, portate «via», scontrini pagati, storni e rimborsi.")}</p>
          {setup.token ? (
            <>
              <div className="pos-row">
                <input className="pos-url" readOnly value={url} aria-label={t("Indirizzo webhook")} onFocus={(event) => event.target.select()} />
                <button type="button" className="button button-primary button-small" onClick={() => void copy(url)}>{t("Copia")}</button>
              </div>
              <p className="pos-hint">{t("L'indirizzo contiene una chiave segreta: dallo solo al fornitore della cassa. Se finisce in mani sbagliate, crea un nuovo indirizzo: il vecchio smette di funzionare.")}</p>
              <div className="pos-row">
                <button type="button" className="button button-quiet button-small" disabled={busy} onClick={() => void send({ action: setup.enabled ? "pause" : "resume" }, setup.enabled ? "Cassa sospesa: gli avvisi vengono rifiutati." : "Cassa riattivata.")}>{t(setup.enabled ? "Sospendi" : "Riattiva")}</button>
                <button type="button" className="button button-quiet button-small" disabled={busy} onClick={() => { if (window.confirm(t("Creare un nuovo indirizzo? Quello di adesso smette subito di funzionare e va cambiato nella cassa."))) void send({ action: "connect" }, "Nuovo indirizzo creato."); }}>{t("Nuovo indirizzo")}</button>
                <button type="button" className="button button-quiet button-small" disabled={busy} onClick={() => { if (window.confirm(t("Scollegare la cassa? Gli avvisi verranno rifiutati finché non la ricolleghi."))) void send({ action: "disconnect" }, "Cassa scollegata."); }}>{t("Scollega")}</button>
              </div>
              <div className="pos-fields">
                <label className="pos-field wide">{t("Segreto di firma (facoltativo)")}
                  <input type="password" autoComplete="off" value={secret} placeholder={setup.signed ? t("Impostato: scrivi per cambiarlo") : t("Solo se la cassa firma gli avvisi")} onChange={(event) => setSecret(event.target.value)} />
                </label>
                <div className="pos-row" style={{ alignSelf: "end" }}>
                  <button type="button" className="button button-quiet button-small" disabled={busy || !secret.trim()} onClick={() => { void send({ action: "secret", secret }, "Segreto salvato."); setSecret(""); }}>{t("Salva segreto")}</button>
                  {setup.signed ? <button type="button" className="button button-quiet button-small" disabled={busy} onClick={() => void send({ action: "secret", secret: "" }, "Segreto tolto.")}>{t("Togli")}</button> : null}
                </div>
              </div>
              <p className="pos-hint">{t("Con il segreto, gli avvisi senza una firma valida (HMAC-SHA256: Standard Webhooks, Square, Stripe o firma semplice del corpo) vengono rifiutati.")}</p>
            </>
          ) : (
            <div className="pos-row">
              <button type="button" className="button button-primary button-small" disabled={busy} onClick={() => void send({ action: "connect" }, "Indirizzo creato: incollalo nella cassa.")}>{t("Crea l'indirizzo per la cassa")}</button>
            </div>
          )}
          <div className="pos-row">
            <button type="button" className="button button-quiet button-small" disabled={busy} onClick={() => void send({ action: "test" }, "Comanda di prova inviata: la trovi in modalità cucina → Comande.")}>{t("Invia una comanda di prova")}</button>
            <button type="button" className="button button-quiet button-small" onClick={() => setView({ filter: "kitchen" })}>{t("Apri la modalità cucina")}</button>
          </div>
        </div>
      ) : null}

      {full ? (
        <div className="pos-section">
          <div className="pos-row" style={{ justifyContent: "space-between" }}>
            <h3>{t("Ultimi avvisi ricevuti")}</h3>
            <button type="button" className="button button-quiet button-small" onClick={() => void load()}>{t("Aggiorna")}</button>
          </div>
          <p>{t("Per controllare che la cassa mandi quello che serve: apri un avviso per vedere il contenuto arrivato e come è stato letto.")}</p>
          {setup.events.length ? (
            <ul className="pos-events">
              {setup.events.map((event, index) => (
                <li key={index}>
                  <details>
                    <summary>
                      <time>{f.stockDate(event.at.slice(0, 10))} {new Date(event.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
                      <span className={event.ok === false ? "bad" : ""}>{event.summary ? summaryText(event.summary) : t("In lavorazione")}</span>
                    </summary>
                    <pre>{(() => { try { return JSON.stringify(JSON.parse(event.body), null, 2); } catch { return event.body; } })()}</pre>
                  </details>
                </li>
              ))}
            </ul>
          ) : <p className="pos-hint">{t("Ancora nessun avviso.")}</p>}
        </div>
      ) : null}

      {full ? (
        <div className="pos-section">
          <h3>{t("Partite e schermi")}</h3>
          <p>{t("Ogni partita riceve i piatti delle categorie (delle ricette o della cassa), delle portate o dei nomi indicati. Uno schermo per partita mostra solo le sue righe; «Tutte · pass» mostra le comande intere.")}</p>
          <div className="pos-stations">
            {draft.stations.map((station) => (
              <div key={station.id} className="pos-station">
                <input type="text" value={station.name} placeholder={t("Nome, es. Griglia")} aria-label={t("Nome della partita")} onChange={(event) => patchStation(station.id, { name: event.target.value })} />
                <input type="text" list="posMatchWords" value={station.match.join(", ")} placeholder={t("Categorie, portate o piatti, separati da virgole")} aria-label={fmt(t("Cosa riceve {0}"), station.name)}
                  onChange={(event) => patchStation(station.id, { match: event.target.value.split(",").map((word) => word.trimStart()) })} />
                <label className="pos-check"><input type="checkbox" checked={Boolean(station.fallback)} onChange={(event) => patchStation(station.id, { fallback: event.target.checked || undefined })} />{t("anche il resto")}</label>
                <button type="button" className="button button-quiet button-small" aria-label={fmt(t("Elimina {0}"), station.name)} onClick={() => setDraft({ ...draft, stations: draft.stations.filter((row) => row.id !== station.id) })}>×</button>
              </div>
            ))}
            <datalist id="posMatchWords">{suggestions.map((word) => <option key={word} value={word} />)}</datalist>
            <div><button type="button" className="button button-quiet button-small" onClick={() => setDraft({ ...draft, stations: [...draft.stations, { id: newId(), name: "", match: [] }] })}>{t("+ Aggiungi partita")}</button></div>
          </div>
          <div className="pos-fields">
            <label className="pos-field">{t("Ambra dopo (minuti)")}<input type="number" min="1" max="240" value={draft.amberMinutes} onChange={(event) => setDraft({ ...draft, amberMinutes: Number(event.target.value) })} /></label>
            <label className="pos-field">{t("Rosso dopo (minuti)")}<input type="number" min="2" max="240" value={draft.redMinutes} onChange={(event) => setDraft({ ...draft, redMinutes: Number(event.target.value) })} /></label>
            <label className="pos-field wide">{t("Non è cibo: non va in cucina né nelle vendite food")}
              <input type="text" list="posMatchWords" value={draft.notFood.join(", ")} placeholder={t("Es. Bevande, Vini, Gift card")} onChange={(event) => setDraft({ ...draft, notFood: event.target.value.split(",").map((word) => word.trimStart()) })} />
            </label>
          </div>
          <label className="pos-check"><input type="checkbox" checked={Boolean(draft.centsPrices)} onChange={(event) => setDraft({ ...draft, centsPrices: event.target.checked || undefined })} />{t("La cassa manda i prezzi in centesimi (1250 per 12,50)")}</label>
          <div className="pos-row">
            <button type="button" className="button button-primary button-small" disabled={busy || !dirty} onClick={() => void send({
              action: "config",
              config: { ...draft, stations: draft.stations.map((row) => ({ ...row, name: row.name.trim(), match: splitWords(row.match.join(",")) })).filter((row) => row.name), notFood: splitWords(draft.notFood.join(",")) }
            }, "Partite e tempi salvati.")}>{t(dirty ? "Salva partite e tempi" : "Salvato")}</button>
          </div>
          {setup.config.stations.length ? (
            <>
              <p className="pos-hint">{t("Per uno schermo fisso, apri su quel dispositivo l'indirizzo della sua partita: resta sulle comande anche dopo un riavvio.")}</p>
              <ul className="pos-screens">
                {[{ id: "", name: t("Tutte · pass") }, ...setup.config.stations].map((station) => {
                  const link = origin + "/?comande" + (station.id ? "&partita=" + encodeURIComponent(station.name) : "");
                  return <li key={station.id || "pass"}><strong>{station.name}</strong><code>{link}</code><button type="button" className="button button-quiet button-small" onClick={() => void copy(link)}>{t("Copia")}</button></li>;
                })}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}

      {mapping || full ? (
        <div className="pos-section">
          <div className="pos-row" style={{ justifyContent: "space-between" }}>
            <h3>{t("Piatti della cassa e ricette")} {missing ? <span className="pos-status off">{fmt(t("{0} da abbinare"), missing)}</span> : null}</h3>
            <label className="pos-check"><input type="checkbox" checked={onlyMissing} onChange={(event) => setOnlyMissing(event.target.checked)} />{t("Solo da abbinare")}</label>
          </div>
          <p>{t("Un piatto con lo stesso nome della ricetta si abbina da solo. Per gli altri («BURGER CHK» → Chicken Burger) scegli la ricetta: l'abbinamento resta e serve per vendite, GP, partite e ricetta sullo schermo.")}</p>
          {shown.length ? (
            <table className="pos-dishes">
              <thead><tr><th>{t("Nella cassa")}</th><th>{t("Ricetta")}</th></tr></thead>
              <tbody>
                {shown.map((item) => {
                  const hint = !item.recipeId && !item.notFood ? suggestion(item.name, recipes) : undefined;
                  return (
                    <tr key={item.plu + "|" + item.name}>
                      <td>{item.name}<small>{[item.plu ? "PLU " + item.plu : "", item.category, fmt(t("{0} volte in 30 giorni"), item.count)].filter(Boolean).join(" · ")}</small></td>
                      <td>
                        {item.notFood ? <small>{t("Non è cibo")}</small> : (
                          <>
                            <select value={item.chosen ?? ""} disabled={!mapping || busy} aria-label={fmt(t("Ricetta per {0}"), item.name)}
                              onChange={(event) => void send({ action: "map", key: mapKey(item), recipeId: event.target.value || null })}>
                              <option value="">{item.auto ? fmt(t("Stesso nome: {0}"), data.recipes.find((recipe) => recipe.id === item.auto)?.name ?? "") : t("— da abbinare —")}</option>
                              {recipes.map((recipe) => <option key={recipe.id} value={recipe.id}>{recipe.name}</option>)}
                            </select>
                            {hint && mapping ? <small><button type="button" className="link-button" onClick={() => void send({ action: "map", key: mapKey(item), recipeId: hint.id })}>{fmt(t("Forse: {0}"), hint.name)}</button></small> : null}
                            {!item.recipeId ? <small className="pos-missing">{t("Senza ricetta: niente costo, GP e partita per categoria")}</small> : item.chosen ? null : <small className="pos-auto">{t("Abbinato per nome")}</small>}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : <p className="pos-hint">{t(items.length ? "Tutti i piatti arrivati dalla cassa sono abbinati." : "I piatti compariranno qui quando la cassa manda le prime comande o i primi scontrini.")}</p>}
        </div>
      ) : null}
    </section>
  );
}
