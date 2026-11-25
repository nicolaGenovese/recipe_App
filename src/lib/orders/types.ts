// Till (EPOS) orders and the kitchen order screen. See docs/CASSA-E-COMANDE.md.

/** What a till notice means for the kitchen and the sales. */
export type PosEventKind = "order" | "update" | "fire" | "paid" | "void" | "refund" | "unknown";

/** One line of an order as the till describes it. */
export interface PosLine {
  /** The till's line id, or one made from the position and the name when the till sends none. */
  id: string;
  name: string;
  quantity: number;
  /** Variants and options, already as text: "No onion", "2× Extra cheese". */
  modifiers: string[];
  note?: string;
  course?: string;
  /** The till's category or department ("Pizze", "Drinks"). */
  category?: string;
  /** PLU, SKU or product id: the steadiest key for matching a dish. */
  plu?: string;
  allergens?: string[];
  /** The course is waiting for the waiter to send it away. */
  held?: boolean;
  voided?: boolean;
  /** Takings of the line including VAT, when the till gives them. */
  total?: number | null;
}

/** A till notice, read into the fields the app uses. One request may hold several. */
export interface PosEvent {
  kind: PosEventKind;
  /** The till's own words for the event ("order.updated", "COMPLETED"), kept for the log. */
  label: string;
  orderId?: string;
  receiptId?: string;
  number?: string;
  table?: string;
  covers?: number;
  server?: string;
  channel?: string;
  note?: string;
  allergies: string[];
  at?: string;
  lines: PosLine[];
  /** Courses sent away by this notice; empty with a "fire" notice means every course on hold. */
  fired: string[];
  total?: number | null;
}

/** A line on the kitchen screen: the till line plus what happened to it after it arrived. */
export interface OrderLine extends PosLine {
  /** Added by the till after the order first reached the kitchen. */
  addedAt?: string;
  /** Removed or voided by the till after the order reached the kitchen: shown struck through. */
  voidedAt?: string;
  /** Quantity, variants or note changed after the order reached the kitchen. */
  changedAt?: string;
  /** Raised at each change, so a changed line has to be marked ready again. */
  rev?: number;
  /** When a held course was sent away. */
  firedAt?: string;
}

export type OrderStatus = "open" | "done" | "cancelled";

/** The till part of an order, written only by the till notices. */
export interface PosOrder {
  externalId: string;
  number?: string;
  table?: string;
  covers?: number;
  server?: string;
  channel?: string;
  note?: string;
  allergies: string[];
  receivedAt: string;
  /** Last change from the till after the order first arrived. */
  changedAt?: string;
  /** Courses the waiter has sent away. */
  fired: string[];
  paid?: boolean;
  /** Made with "Send a test order" in the settings: never counted as a sale. */
  test?: boolean;
  lines: OrderLine[];
}

export interface ReadyMark { at: string; by: string }

/** The kitchen part of an order, written only by the kitchen screens. */
export interface KitchenState {
  claimedBy?: string;
  claimedAt?: string;
  doneAt?: string;
  doneBy?: string;
  /** A cancelled order stays on screen until someone confirms they saw it. */
  seen?: boolean;
  /** Lines marked ready, by line key (id, plus the revision once the till changed it). */
  lines?: Record<string, ReadyMark>;
}

/** An order as stored: the two parts are kept apart so the till and the kitchen never overwrite each other. */
export interface StoredOrder {
  id: string;
  status: OrderStatus;
  pos: PosOrder;
  kitchen: KitchenState;
  version: number;
  updatedAt: string;
}

/** A kitchen station (grill, fryer, pastry…) and the dishes it gets. */
export interface Station {
  id: string;
  name: string;
  /** Recipe categories, till categories, courses, dish names or PLUs that go to this station. */
  match: string[];
  /** Also gets the lines no station matches. */
  fallback?: boolean;
}

/** Kitchen screen settings of one site. */
export interface OrdersConfig {
  stations: Station[];
  /** Minutes after which an order card turns amber, then red. */
  amberMinutes: number;
  redMinutes: number;
  /** Categories, names or PLUs that are not food (drinks, gift cards): not shown in the kitchen, not counted in food sales. */
  notFood: string[];
  /** Till dish → recipe id, by "plu:CODE" or "name:dish name". Saved when someone matches a dish by hand. */
  dishMap: Record<string, string>;
  /** The till sends prices in pence or cents as whole numbers (1250 for £12.50). */
  centsPrices?: boolean;
}

/** The till connection of one site. The token is the secret part of the webhook address. */
export interface PosConnection {
  token: string | null;
  /** Optional shared secret for tills that sign their notices (HMAC). */
  signingSecret: string;
  enabled: boolean;
}

/** One notice in the log shown in the settings, to check what the till sends. */
export interface PosEventRow {
  at: string;
  kind: string;
  ok: boolean | null;
  summary: string;
  body: string;
}

/** A dish the till sold or sent, with how often: used to match till names to recipes. */
export interface PosItem { name: string; plu: string; category: string; count: number }

/** A paid receipt (or a refund, with negative quantities) for the sales figures. */
export interface PosSale {
  receiptId: string;
  /** Kitchen day (YYYY-MM-DD). */
  day: string;
  lines: { name: string; plu?: string; category?: string; quantity: number; total: number | null }[];
}

/** Sales from the till added up by week (or day) and dish, before matching to recipes. */
export interface PosSalesRow {
  period: string; name: string; plu: string; category: string; quantity: number;
  /** Takings of the priced lines, and how many lines came without a price. */
  revenue: number; unpriced: number;
}

/** What GET /api/orders returns. */
export interface OrdersFeed {
  orders: KitchenOrder[];
  /** Pass it back as ?since= to get only what changed. */
  cursor: string;
  /** Server time, so the screens count waiting minutes with the server's clock. */
  now: string;
  config: OrdersConfig;
  connected: boolean;
}

/** An order as the kitchen screens see it: both parts joined. */
export interface KitchenOrder extends Omit<PosOrder, "lines"> {
  id: string;
  status: OrderStatus;
  version: number;
  updatedAt: string;
  claimedBy?: string;
  claimedAt?: string;
  doneAt?: string;
  doneBy?: string;
  seen?: boolean;
  lines: (OrderLine & { key: string; ready?: ReadyMark })[];
}

/** What the settings page gets about the till connection. */
export interface PosSetup {
  config: OrdersConfig;
  /** Secret part of the webhook address; only for whoever may connect the till. */
  token: string | null;
  signed: boolean;
  enabled: boolean;
  events: PosEventRow[];
  items: PosItem[];
}

export const DEFAULT_ORDERS_CONFIG: OrdersConfig = { stations: [], amberMinutes: 10, redMinutes: 15, notFood: [], dishMap: {} };
