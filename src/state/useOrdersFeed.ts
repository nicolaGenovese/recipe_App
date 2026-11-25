"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_ORDERS_CONFIG, type KitchenOrder, type OrdersConfig, type OrdersFeed } from "@/lib/orders/types";
import { api } from "@/state/api";

export type FeedState = "loading" | "live" | "offline";

export interface OrdersFeedValue {
  orders: KitchenOrder[];
  config: OrdersConfig;
  /** A till is connected to this site. */
  connected: boolean;
  state: FeedState;
  /** Now, by the server's clock: waiting minutes are the same on every screen. */
  serverNow: () => number;
  /** Changes an order at once on this screen, then on the server; the server's answer wins. */
  act: (order: KitchenOrder, body: { action: string; by?: string; keys?: string[]; ready?: boolean }, preview: (order: KitchenOrder) => KitchenOrder) => Promise<void>;
  refresh: () => void;
}

const FAST = 3000;
const SLOW = 15000;
/** No till connected and nothing open (only test orders can arrive): ask rarely, so the database can rest. */
const IDLE = 60000;
/** Every minute the whole list is read again, so orders closed on another screen disappear everywhere. */
const FULL_EVERY = 60000;
/** Closed and cancelled orders stay this long, for "recall" and to show the cancellation. */
const KEEP_CLOSED = 60 * 60000;

/**
 * Keeps the kitchen orders of the site up to date: asks the server every few seconds for what changed
 * (Vercel cannot hold a connection open, and a short poll is enough for a kitchen screen). Calls
 * `onAlert` when a new order arrives or the till changes or cancels one, so the screen can ring.
 */
export function useOrdersFeed(enabled: boolean, onAlert: (kind: "new" | "change") => void, onError: (message: string) => void): OrdersFeedValue {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [config, setConfig] = useState<OrdersConfig>(DEFAULT_ORDERS_CONFIG);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<FeedState>("loading");
  const known = useRef(new Map<string, KitchenOrder>());
  const cursor = useRef<string | null>(null);
  const lastFull = useRef(0);
  const offset = useRef(0);
  const started = useRef(false);
  const alert = useRef(onAlert);
  alert.current = onAlert;
  const wakeRef = useRef<() => void>(() => undefined);
  const busy = useRef(false);

  const publish = useCallback(() => {
    const now = Date.now() + offset.current;
    for (const [id, order] of known.current) {
      if (order.status !== "open" && now - Date.parse(order.doneAt ?? order.updatedAt) > KEEP_CLOSED) known.current.delete(id);
    }
    setOrders(Array.from(known.current.values()).sort((a, b) => a.receivedAt.localeCompare(b.receivedAt)));
  }, []);

  const apply = useCallback((feed: OrdersFeed, full: boolean) => {
    const next = full ? new Map<string, KitchenOrder>() : new Map(known.current);
    let fresh = 0;
    let changed = 0;
    for (const order of feed.orders) {
      const before = known.current.get(order.id);
      if (!before && started.current && order.status === "open") fresh++;
      if (before && ((order.changedAt && order.changedAt !== before.changedAt) || (before.status !== "cancelled" && order.status === "cancelled"))) changed++;
      // A slower answer must not bring back an older copy.
      next.set(order.id, before && before.updatedAt > order.updatedAt ? before : order);
    }
    known.current = next;
    started.current = true;
    busy.current = feed.connected || Array.from(next.values()).some((order) => order.status === "open");
    setConfig(feed.config);
    setConnected(feed.connected);
    publish();
    if (fresh) alert.current("new");
    else if (changed) alert.current("change");
  }, [publish]);

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const poll = async () => {
      if (running || stopped) return;
      running = true;
      clearTimeout(timer);
      try {
        const full = !cursor.current || Date.now() - lastFull.current > FULL_EVERY;
        const feed = await api.orders(full ? null : cursor.current);
        offset.current = Date.parse(feed.now) - Date.now();
        cursor.current = feed.cursor;
        if (full) lastFull.current = Date.now();
        if (!stopped) { apply(feed, full); setState("live"); }
      } catch {
        if (!stopped) setState("offline");
      }
      running = false;
      if (!stopped) timer = setTimeout(poll, !busy.current ? IDLE : document.visibilityState === "hidden" ? SLOW : FAST);
    };
    wakeRef.current = () => { void poll(); };
    void poll();
    const wake = () => { if (document.visibilityState === "visible") void poll(); };
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("online", wake);
    return () => { stopped = true; clearTimeout(timer); document.removeEventListener("visibilitychange", wake); window.removeEventListener("online", wake); };
  }, [enabled, apply]);

  const act = useCallback<OrdersFeedValue["act"]>(async (order, body, preview) => {
    // Stamped now, so a poll answer already on its way with the old copy does not undo it.
    known.current.set(order.id, { ...preview(order), updatedAt: new Date(Date.now() + offset.current).toISOString() });
    publish();
    try {
      const saved = await api.orderAction(order.id, body);
      known.current.set(saved.id, saved);
      publish();
    } catch (error) {
      known.current.set(order.id, order);
      publish();
      onError(error instanceof Error ? error.message : String(error));
    }
  }, [publish, onError]);

  return {
    orders, config, connected, state, act,
    serverNow: useCallback(() => Date.now() + offset.current, []),
    refresh: useCallback(() => { lastFull.current = 0; wakeRef.current(); }, [])
  };
}

/** Short tones made in the browser, no sound files: two for a new order, three for a change or a cancellation. */
export function makeChime() {
  let context: AudioContext | null = null;
  const ensure = () => {
    const Audio = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Audio) return null;
    context ??= new Audio();
    if (context.state === "suspended") void context.resume().catch(() => undefined);
    return context;
  };
  const tone = (audio: AudioContext, frequency: number, start: number, length = 0.16) => {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, audio.currentTime + start);
    gain.gain.exponentialRampToValueAtTime(0.35, audio.currentTime + start + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + start + length);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(audio.currentTime + start);
    oscillator.stop(audio.currentTime + start + length + 0.05);
  };
  return {
    /** Browsers only play sound after a tap: call this from one. */
    unlock: () => { ensure(); },
    play: (kind: "new" | "change") => {
      const audio = ensure();
      if (!audio || audio.state !== "running") return;
      if (kind === "new") { tone(audio, 880, 0); tone(audio, 1175, 0.2, 0.24); }
      else { tone(audio, 660, 0); tone(audio, 660, 0.2); tone(audio, 523, 0.4, 0.26); }
    }
  };
}
