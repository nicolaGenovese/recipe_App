"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { allReady, dishKey, matchesAny, resolveRecipe, stationsOf } from "@/lib/orders/orders";
import type { KitchenOrder } from "@/lib/orders/types";
import { allergens as recipeAllergens } from "@/lib/recipes/math";
import type { Recipe } from "@/lib/types";
import { api } from "@/state/api";
import { useApp } from "@/state/AppProvider";
import type { OrdersFeedValue } from "@/state/useOrdersFeed";

type Line = KitchenOrder["lines"][number];

interface Props {
  feed: OrdersFeedValue;
  by: string;
  /** Station shown on this screen; "" is the pass, with every line. */
  station: string;
  onStation: (id: string) => void;
  sound: boolean;
  onSound: (on: boolean) => void;
  ordersOnly: boolean;
  onOrdersOnly: (on: boolean) => void;
  /** "Who is working", shown here when the kitchen header is hidden. */
  who?: ReactNode;
}

/** A change from the till stays highlighted this long. */
const RECENT = 3 * 60000;

const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
/** "12" and "4B" are table numbers; "Bar 3" or "Rossi" are names and show as they are. */
const isTableNumber = (table: string) => /^[0-9]{1,4}[a-z]?$/i.test(table.trim());

/**
 * The order screen: one card per order, oldest first, with lines by course, variants, allergies in
 * red at the top and the changes from the till marked. Each screen can show one station (only its
 * lines) or the pass (whole orders). Cards turn amber and red as they wait.
 */
export function KitchenOrders({ feed, by, station, onStation, sound, onSound, ordersOnly, onOrdersOnly, who }: Props) {
  const { data, t, fmt, openDialog, notify, can } = useApp();
  const { orders, config, connected, state, serverNow, act, refresh } = feed;
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 10_000);
    return () => window.clearInterval(timer);
  }, []);
  const now = serverNow();

  const recipes = useMemo(() => new Map(data.recipes.map((recipe) => [recipe.id, recipe])), [data.recipes]);
  /** Recipe and stations of each till dish, worked out once per name. */
  const route = useMemo(() => {
    const cache = new Map<string, { recipe?: Recipe; stations: string[]; food: boolean }>();
    return (line: Line) => {
      const key = [line.name, line.plu, line.category, line.course].join("|");
      let found = cache.get(key);
      if (!found) {
        const id = resolveRecipe(line, config.dishMap, data.recipes);
        const recipe = id ? recipes.get(id) : undefined;
        found = { recipe, stations: stationsOf(line, recipe, config.stations), food: !matchesAny(config.notFood, line, recipe) };
        cache.set(key, found);
      }
      return found;
    };
  }, [config, data.recipes, recipes]);

  const current = config.stations.find((row) => row.id === station);
  const onThisScreen = (line: Line) => route(line).food && (!current || route(line).stations.includes(current.id));
  const toMake = (line: Line) => !line.voided && !line.ready && onThisScreen(line);

  const showsHere = (order: KitchenOrder) => {
    const lines = order.lines.filter(onThisScreen);
    if (!lines.length) return false;
    if (order.status === "cancelled") return !order.seen;
    if (order.status !== "open") return false;
    return current ? lines.some((line) => !line.voided && !line.ready) : true;
  };
  const cards = orders.filter(showsHere);
  const countFor = (id: string) => orders.filter((order) => {
    const lines = order.lines.filter((line) => route(line).food && (!id || route(line).stations.includes(id)));
    return lines.length && (order.status === "open" ? (!id || lines.some((line) => !line.voided && !line.ready)) : order.status === "cancelled" && !order.seen);
  }).length;
  const lastDone = orders.filter((order) => order.status === "done").sort((a, b) => (b.doneAt ?? "").localeCompare(a.doneAt ?? ""))[0];

  const needBy = () => { if (!by) notify(t("Scegli prima chi sta lavorando."), true); return Boolean(by); };
  const markLines = (order: KitchenOrder, keys: string[], ready: boolean) => {
    if (!keys.length || !needBy()) return;
    const mark = { at: new Date(now).toISOString(), by };
    void act(order, { action: "lines", keys, ready, by }, (old) => ({ ...old, lines: old.lines.map((line) => (keys.includes(line.key) ? { ...line, ready: ready ? mark : undefined } : line)) }));
  };
  const claim = (order: KitchenOrder) => {
    if (order.claimedBy) { void act(order, { action: "unclaim" }, (old) => ({ ...old, claimedBy: undefined, claimedAt: undefined })); return; }
    if (needBy()) void act(order, { action: "claim", by }, (old) => ({ ...old, claimedBy: by, claimedAt: new Date(now).toISOString() }));
  };
  const bump = (order: KitchenOrder) => void act(order, { action: "bump", by }, (old) => ({ ...old, status: "done", doneAt: new Date(now).toISOString(), doneBy: by }));
  const recall = (order: KitchenOrder) => void act(order, { action: "recall" }, (old) => ({ ...old, status: "open", doneAt: undefined, doneBy: undefined }));
  const seen = (order: KitchenOrder) => void act(order, { action: "seen" }, (old) => ({ ...old, seen: true }));
  const [testing, setTesting] = useState(false);
  const sendTest = async () => {
    setTesting(true);
    try { await api.posAction({ action: "test" }); refresh(); }
    catch (error) { notify(t(error instanceof Error ? error.message : String(error)), true); }
    setTesting(false);
  };

  const fullscreen = (on: boolean) => {
    onOrdersOnly(on);
    try {
      if (on && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => undefined);
      if (!on && document.fullscreenElement) void document.exitFullscreen?.().catch(() => undefined);
    } catch { /* Full screen is a nicety: the page works without it. */ }
  };

  const courseLabel = (course: string) => (/^\d+$/.test(course) ? fmt(t("Portata {0}"), course) : course);

  function card(order: KitchenOrder) {
    const minutes = Math.max(0, Math.floor((now - Date.parse(order.receivedAt)) / 60000));
    const tone = minutes >= config.redMinutes ? "late" : minutes >= config.amberMinutes ? "warn" : "ok";
    const lines = order.lines.filter(onThisScreen);
    const others = current ? order.lines.filter((line) => route(line).food && !line.voided && !line.ready && !route(line).stations.includes(current.id)).length : 0;
    const cancelled = order.status === "cancelled";
    const complete = !current && allReady(order, config.notFood);
    const changed = Boolean(order.changedAt) && now - Date.parse(order.changedAt as string) < RECENT;
    // Allergies from the till, for the order and for single lines, and notes that mention them.
    const lineAllergies = lines.filter((line) => !line.voided && (line.allergens?.length || /allerg/i.test(line.note ?? "")))
      .map((line) => line.name + ": " + [...(line.allergens ?? []), ...(/allerg/i.test(line.note ?? "") ? [line.note as string] : [])].join(", "));
    // The order's allergies apply to every dish; a line's own allergies only to that dish.
    const warnedFor = (line: Line) => [...order.allergies, ...(line.allergens ?? [])].map(dishKey);
    const groups: { course: string; lines: Line[] }[] = [];
    for (const line of lines) {
      const course = line.course ?? "";
      const group = groups.find((row) => row.course === course) ?? groups[groups.push({ course, lines: [] }) - 1];
      group.lines.push(line);
    }
    const left = lines.filter((line) => toMake(line) && !line.held).map((line) => line.key);
    const title = order.table ? (isTableNumber(order.table) ? fmt(t("Tavolo {0}"), order.table) : order.table) : order.number ? "#" + order.number : order.channel || t("Comanda");

    return (
      <article key={order.id} className={"orders-card tone-" + tone + (complete ? " complete" : "") + (cancelled ? " cancelled" : "") + (changed ? " changed" : "")}>
        <header className="orders-card-head">
          <div className="orders-card-title">
            <strong>{title}</strong>
            <span>{[order.covers ? fmt(t(order.covers === 1 ? "{0} coperto" : "{0} coperti"), order.covers) : "", order.table && order.number ? "#" + order.number : "", order.channel, order.server].filter(Boolean).join(" · ")}</span>
          </div>
          <div className="orders-card-time">
            <strong>{minutes}′</strong>
            <span>{clock(order.receivedAt)}</span>
          </div>
        </header>
        {order.test ? <div className="orders-flag test">{t("Comanda di prova")}</div> : null}
        {cancelled ? <div className="orders-flag cancelled">{t("ANNULLATA dalla cassa")}</div> : null}
        {changed && !cancelled ? <div className="orders-flag changed">{fmt(t("MODIFICATA alle {0}"), clock(order.changedAt as string))}</div> : null}
        {order.allergies.length || lineAllergies.length ? (
          <div className="orders-allergies" role="alert">
            <strong>{t("ALLERGIE")}</strong>
            {order.allergies.length ? <span>{order.allergies.join(", ")}</span> : null}
            {lineAllergies.map((text) => <span key={text}>{text}</span>)}
          </div>
        ) : null}
        {order.note ? <p className="orders-note">{order.note}</p> : null}
        {order.claimedBy ? <p className="orders-claimed">{fmt(t("Preso da {0}"), order.claimedBy)}</p> : null}

        {groups.map((group) => {
          const waiting = group.lines.every((line) => line.held || line.voided) && group.lines.some((line) => line.held);
          return (
            <section key={group.course || "_"} className={"orders-course" + (waiting ? " waiting" : "")}>
              {group.course || waiting ? <h4>{group.course ? courseLabel(group.course) : t("Senza portata")}{waiting ? " · " + t("in attesa") : ""}</h4> : null}
              <ul>
                {group.lines.map((line) => {
                  const { recipe, stations } = route(line);
                  const conflicts = recipe ? recipeAllergens(recipe).filter((name) => warnedFor(line).includes(dishKey(name))) : [];
                  const fired = line.firedAt && now - Date.parse(line.firedAt) < RECENT;
                  return (
                    <li key={line.key} className={"orders-line" + (line.ready ? " ready" : "") + (line.voided ? " voided" : "") + (line.held ? " held" : "") + (conflicts.length ? " conflict" : "")}>
                      <button type="button" className="orders-line-main" disabled={cancelled || line.voided || line.held}
                        aria-pressed={Boolean(line.ready)} aria-label={(line.ready ? t("Pronto") + ": " : "") + line.quantity + "× " + line.name}
                        onClick={() => markLines(order, [line.key], !line.ready)}>
                        <span className="orders-check" aria-hidden="true">{line.ready ? "✓" : ""}</span>
                        <span className="orders-line-text">
                          <span className="orders-line-name"><b>{line.quantity}×</b> {line.name}
                            {line.voided ? <em className="orders-tag removed">{t("TOLTO")}</em> : line.addedAt ? <em className="orders-tag added">{t("+ NUOVO")}</em> : line.changedAt ? <em className="orders-tag changed">{t("CAMBIATO")}</em> : null}
                            {fired ? <em className="orders-tag fired">{t("VIA")}</em> : null}
                          </span>
                          {line.modifiers.map((modifier, index) => <span key={index} className="orders-modifier">{modifier}</span>)}
                          {line.note ? <span className="orders-line-note">«{line.note}»</span> : null}
                          {conflicts.length ? <span className="orders-conflict">⚠ {fmt(t("contiene {0}"), conflicts.map(t).join(", "))}</span> : null}
                          {!current && config.stations.length ? <span className="orders-stations">{stations.map((id) => config.stations.find((row) => row.id === id)?.name).filter(Boolean).join(" · ") || t("nessuna partita")}</span> : null}
                        </span>
                      </button>
                      {recipe ? <button type="button" className="orders-recipe" aria-label={fmt(t("Apri la ricetta di {0}"), recipe.name)} title={t("Ricetta")} onClick={() => openDialog({ kind: "recipeDetail", id: recipe.id })}>i</button> : null}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
        {others ? <p className="orders-others">{fmt(t(others === 1 ? "+{0} riga di altre partite" : "+{0} righe di altre partite"), others)}</p> : null}

        <footer className="orders-card-foot">
          {cancelled ? (
            <button type="button" className="orders-button primary" onClick={() => seen(order)}>{t("Visto")}</button>
          ) : (
            <>
              <button type="button" className={"orders-button" + (order.claimedBy ? " claimed" : "")} onClick={() => claim(order)}>
                {order.claimedBy ? fmt(t("Lascia ({0})"), order.claimedBy) : t("Prendo io")}
              </button>
              {current ? (
                <button type="button" className="orders-button primary" disabled={!left.length} onClick={() => markLines(order, left, true)}>{t("Pronto")} ✓</button>
              ) : (
                <button type="button" className={"orders-button primary" + (complete ? " complete" : "")} onClick={() => bump(order)}>{complete ? t("Servita") + " ✓" : t("Pronto") + " ✓"}</button>
              )}
            </>
          )}
        </footer>
      </article>
    );
  }

  return (
    <div className={"orders" + (ordersOnly ? " only" : "")}>
      <div className="orders-bar">
        <div className="orders-stations-picker" role="tablist" aria-label={t("Partite")}>
          <button type="button" role="tab" aria-selected={!current} className={!current ? "active" : ""} onClick={() => onStation("")}>
            {t("Tutte · pass")} <span>{countFor("")}</span>
          </button>
          {config.stations.map((row) => (
            <button key={row.id} type="button" role="tab" aria-selected={current?.id === row.id} className={current?.id === row.id ? "active" : ""} onClick={() => onStation(row.id)}>
              {row.name} <span>{countFor(row.id)}</span>
            </button>
          ))}
        </div>
        <div className="orders-tools">
          {who}
          <span className={"orders-live " + state} title={state === "offline" ? t("Connessione persa") : t("In diretta")}>
            <i aria-hidden="true" />{state === "offline" ? t("Non collegato") : state === "loading" ? t("Carico…") : t("In diretta")}
          </span>
          <button type="button" className={"orders-tool" + (sound ? " on" : "")} aria-pressed={sound} onClick={() => onSound(!sound)}>{sound ? "🔔 " + t("Suono attivo") : "🔕 " + t("Suono spento")}</button>
          <button type="button" className="orders-tool" onClick={() => fullscreen(!ordersOnly)}>{ordersOnly ? t("Esci da solo comande") : t("Solo comande")}</button>
        </div>
      </div>

      {state === "offline" ? (
        <div className="orders-offline" role="alert">
          <strong>{t("Connessione persa")}</strong>
          <span>{t("Le comande nuove non arrivano finché la connessione non torna: usa la stampante delle comande.")}</span>
          <button type="button" className="orders-button" onClick={refresh}>{t("Riprova")}</button>
        </div>
      ) : null}

      {cards.length ? <div className="orders-grid">{cards.map(card)}</div> : state === "loading" ? null : (
        <div className="kitchen-empty">
          {connected || orders.length ? (
            <p>{current ? fmt(t("Niente da preparare per {0}."), current.name) : t("Nessuna comanda aperta.")}</p>
          ) : (
            <>
              <p>{t("Nessuna cassa collegata a questa sede. Si collega da Impostazioni → Cassa e comande.")}</p>
              {can("orders.setup") ? <button type="button" className="kitchen-button" disabled={testing} onClick={() => void sendTest()}>{t("Invia una comanda di prova")}</button> : null}
            </>
          )}
        </div>
      )}

      {lastDone ? (
        <div className="orders-recall">
          <button type="button" className="orders-button" onClick={() => recall(lastDone)}>
            ↶ {fmt(t("Richiama: {0}"), lastDone.table ? (isTableNumber(lastDone.table) ? fmt(t("Tavolo {0}"), lastDone.table) : lastDone.table) : "#" + (lastDone.number ?? lastDone.id.slice(-4)))}
          </button>
        </div>
      ) : null}
    </div>
  );
}
