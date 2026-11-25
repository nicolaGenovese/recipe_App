import type { PosEvent, PosEventKind, PosLine } from "@/lib/orders/types";

// Reads a till notice whatever the brand. Tills name the same things differently ("table_name",
// "tableName", "TableNumber", "table.name"), wrap the order in envelopes ("data.object.order",
// "payload", "order") and send lines under many names ("line_items", "items", "products"). This
// reader looks for the order and its lines by shape and by the common names, so most tills that send
// the whole order work without a dedicated connector. Tills that only send ids need a middleware
// (Zapier, Make, n8n…) that sends the format in docs/CASSA-E-COMANDE.md, which this reader also reads.

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => Boolean(value) && typeof value === "object" && !Array.isArray(value);
/** "table_name", "tableName" and "Table-Name" are the same key. */
const squash = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");
const present = (value: unknown) => value !== null && value !== undefined && value !== "";

/** The first of the names present in the object; "a.b" looks inside a nested object. */
function pick(object: Json, names: string[]): unknown {
  for (const name of names) {
    const [head, ...rest] = name.split(".");
    const wanted = squash(head);
    for (const [key, value] of Object.entries(object)) {
      if (squash(key) !== wanted || !present(value)) continue;
      if (!rest.length) return value;
      if (isObject(value)) {
        const inner = pick(value, [rest.join(".")]);
        if (present(inner)) return inner;
      }
    }
  }
  return undefined;
}

/** The key under which a value was found, to tell pence from pounds. */
function pickKey(object: Json, names: string[]): string | undefined {
  for (const name of names) {
    const wanted = squash(name);
    const key = Object.keys(object).find((candidate) => squash(candidate) === wanted && present(object[candidate]));
    if (key) return key;
  }
  return undefined;
}

/** Text of a value: strings and numbers as they are, objects by their name. */
function text(value: unknown, max = 160): string | undefined {
  if (typeof value === "string") return value.trim().slice(0, max) || undefined;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (isObject(value)) return text(pick(value, ["name", "display_name", "label", "title", "value", "number", "first_name"]), max);
  return undefined;
}

function number(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/[^\d,.-]/g, "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * A money amount in pounds or euros. Square-style objects ({ amount, currency } under a key ending in
 * "money") and keys ending in "cents", "pence" or "minor" are in hundredths.
 */
function money(object: Json, names: string[]): number | undefined {
  const key = pickKey(object, names);
  if (!key) return undefined;
  const value = object[key];
  const hundredths = /(cents|pence|minor)$/.test(squash(key));
  if (isObject(value)) {
    const amount = number(pick(value, ["amount", "value", "total"]));
    if (amount === undefined) return undefined;
    const minor = squash(key).endsWith("money") || hundredths || pick(value, ["precision"]) === 2;
    return minor && Number.isInteger(amount) ? amount / 100 : amount;
  }
  const amount = number(value);
  return amount === undefined ? undefined : hundredths ? amount / 100 : amount;
}

function truthy(value: unknown): boolean {
  if (typeof value === "string") return /^(true|yes|1|y|si|sì)$/i.test(value.trim());
  return value === true || value === 1;
}

/** A list of short texts from an array, an object or a string with commas. */
function words(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(words);
  if (isObject(value)) { const one = text(value); return one ? [one] : []; }
  if (typeof value === "string") return value.split(/[,;\n]/).map((part) => part.trim()).filter(Boolean);
  if (typeof value === "number") return [String(value)];
  return [];
}

const LINE_LISTS = ["lines", "line_items", "lineItems", "order_lines", "orderLines", "order_items", "orderItems", "items", "products", "entries",
  "articles", "positions", "ticket_items", "check_items", "menu_items", "sale_items", "transaction_items", "sale_lines", "receipt_lines", "bill_items",
  "order_products", "basket", "cart", "selections", "dishes"];
const NAME = ["name", "item_name", "product_name", "display_name", "title", "label", "article_name", "menu_item_name", "dish", "description", "text",
  "product.name", "item.name", "menu_item.name", "menuItem.name", "article.name", "catalog_item.name"];
const QUANTITY = ["quantity", "qty", "count", "units", "amount_ordered", "portions", "quantity_ordered"];
const LINE_ID = ["line_id", "line_uid", "line_uuid", "uid", "uuid", "guid", "line_number", "position", "entry_id", "selection_id", "id"];
const MODIFIERS = ["modifiers", "modifier", "applied_modifiers", "options", "selected_options", "option_list", "choices", "extras", "addons", "add_ons", "toppings",
  "sub_items", "children", "components", "customizations", "customisations", "variants", "modifier_groups"];
const NOTE = ["note", "notes", "comment", "comments", "special_instructions", "instructions", "kitchen_note", "kitchen_notes", "remark", "remarks", "memo"];
const COURSE = ["course", "course_name", "course_number", "course.name", "service_course", "fire_group", "coursing", "sequence_name"];
const CATEGORY = ["category", "category_name", "category.name", "group", "group_name", "department", "department_name", "menu_group", "menu_category",
  "family", "section", "product_group", "reporting_category", "product.category", "item.category", "product.category.name"];
const PLU = ["plu", "plu_code", "sku", "product_code", "item_code", "article_number", "code", "barcode", "ean", "catalog_object_id", "product_id",
  "item_id", "menu_item_id", "article_id", "product.id", "item.id", "menu_item.id"];
const ALLERGENS = ["allergens", "allergies", "allergy", "allergen_info", "allergy_info", "dietary", "dietary_requirements"];
const LINE_TOTAL = ["total", "total_price", "line_total", "gross", "gross_total", "total_amount", "total_money", "price_total", "total_with_tax",
  "gross_amount", "line_amount", "amount", "total_cents", "total_price_cents"];
const UNIT_PRICE = ["unit_price", "price", "base_price", "base_price_money", "price_money", "unit_price_money", "gross_unit_price", "price_each",
  "unit_price_cents", "price_cents"];

const ORDER_ID = ["order_id", "order_uuid", "order_guid", "channel_order_id", "external_order_id", "check_id", "check_guid", "ticket_id", "bill_id", "tab_id",
  "sale_id", "transaction_id", "order_reference", "order.id"];
const RECEIPT_ID = ["receipt_id", "receipt_number", "invoice_id", "payment_id", "transaction_id", "refund_id", "sale_id", "bill_id"];
const ORDER_NUMBER = ["order_number", "number", "display_id", "check_number", "ticket_number", "receipt_number", "short_id", "order_no", "reference", "ref"];
const TABLE = ["table", "table_name", "table_number", "table_no", "table_label", "table.name", "table.number", "tab_name", "ticket_name", "tab", "location_label"];
const COVERS = ["covers", "cover_count", "guests", "guest_count", "number_of_guests", "pax", "party_size", "people", "seat_count"];
const SERVER = ["server", "server_name", "waiter", "waiter_name", "employee", "employee_name", "staff", "staff_name", "operator", "cashier",
  "created_by", "user_name", "server.name", "employee.name", "employee.first_name"];
const CHANNEL = ["channel", "order_type", "dining_option", "service_type", "fulfillment_type", "fulfilment_type", "sales_channel", "order_source",
  "source_name", "platform", "source", "dining_option.name"];
const ALLERGIES = ["allergies", "allergens", "allergy", "allergy_notes", "allergen_notes", "dietary_requirements", "dietary"];
const AT = ["created_at", "sent_at", "opened_at", "ordered_at", "placed_at", "timestamp", "time", "date", "created", "datetime"];
const FIRED = ["fired_courses", "courses_fired", "fired", "course", "courses", "course_name", "course_number"];
const ORDER_TOTAL = ["total", "total_amount", "grand_total", "total_money", "amount", "total_with_tax", "net_total", "total_price", "amount_money", "total_cents"];
const STATUS = ["status", "state", "order_status", "order_state", "event_status"];
const EVENT_WORDS = ["type", "event", "event_type", "event_name", "topic", "action", "trigger", "kind", "webhook_type", "notification_type", "operation"];
const EVENT_ID = ["event_id", "notification_id", "webhook_id", "delivery_id", "message_id"];
/** Header names tills use for the event type or the event id. */
const EVENT_HEADERS = ["x-event-type", "x-event-name", "x-topic", "x-webhook-topic", "x-webhook-event", "x-shopify-topic", "x-github-event", "event-type"];
export const EVENT_ID_HEADERS = ["webhook-id", "svix-id", "x-event-id", "x-webhook-id", "x-delivery-id", "x-request-id", "idempotency-key", "x-idempotency-key", "x-message-id"];

/** What the till's words mean. Refunds and voids are checked first: "order.updated" with "CANCELLED" is a void. */
export function kindOf(label: string): PosEventKind {
  const value = label.toLowerCase();
  if (/refund|rimbors|reso\b/.test(value)) return "refund";
  // A payment cancelled or failed is not the order cancelled: the kitchen keeps cooking.
  if (/void|cancel|delet|storn|annull|reject|fail/.test(value)) return /payment|pagament/.test(value) ? "unknown" : "void";
  if (/fire|fired|away|course[ ._-]?(sent|called|released|started)|\bvia\b|release|marcia|call[ ._-]?course|send[ ._-]?course/.test(value)) return "fire";
  if (/paid|payment|pagat|closed|close\b|complet|settl|receipt|scontrin|checkout|finali|tender|invoice|\bsale\b/.test(value)) return "paid";
  if (/updat|modif|chang|edit|amend|added|item[ ._-]?add/.test(value)) return "update";
  if (/creat|new|nuov|placed|sent|send|submit|open|kitchen|ticket|order|ordin|comand|accept/.test(value)) return "order";
  return "unknown";
}

/** "2× Extra cheese" for a modifier object, with its own options after a dash. */
function modifierText(value: unknown): string[] {
  if (typeof value === "string") return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(modifierText);
  if (!isObject(value)) return [];
  if (truthy(pick(value, ["voided", "deleted", "removed"]))) return [];
  const name = text(pick(value, NAME));
  const inner = modifierText(pick(value, MODIFIERS));
  if (!name) return inner;
  const quantity = number(pick(value, QUANTITY)) ?? 1;
  return [(quantity > 1 ? quantity + "× " : "") + name, ...inner.map((part) => "– " + part)];
}

const VARIATION = ["variation_name", "variant_name", "size", "portion_size", "variation.name"];
const PLAIN_VARIATION = /^(regular|default|standard|normale|standard size|one size)$/i;

function readLine(raw: unknown, index: number, context: { course?: string }): PosLine[] {
  if (typeof raw === "string") return raw.trim() ? [{ id: "", name: raw.trim(), quantity: 1, modifiers: [], ...(context.course ? { course: context.course } : {}) }] : [];
  if (!isObject(raw)) return [];
  const name = text(pick(raw, NAME));
  const nested = LINE_LISTS.map((key) => pick(raw, [key])).find(Array.isArray) as unknown[] | undefined;
  // A group (course, seat, round) holds lines of its own: its name is their course.
  if (nested && (!name || number(pick(raw, QUANTITY)) === undefined)) {
    const course = text(pick(raw, COURSE)) ?? name ?? context.course;
    return nested.flatMap((line, inner) => readLine(line, index * 100 + inner, { course }));
  }
  if (!name) return [];
  let quantity = number(pick(raw, QUANTITY)) ?? 1;
  const status = String(text(pick(raw, STATUS)) ?? "").toLowerCase();
  let voided = truthy(pick(raw, ["voided", "void", "is_void", "is_voided", "cancelled", "canceled", "deleted", "removed", "is_deleted"])) || /void|cancel|delet|storn|annull/.test(status);
  if (quantity < 0) { voided = true; quantity = -quantity; }
  const variation = text(pick(raw, VARIATION));
  // A line with parts of its own (a set menu: burger, fries, drink) shows them like variants.
  const modifiers = [...(variation && !PLAIN_VARIATION.test(variation) && variation.toLowerCase() !== name.toLowerCase() ? [variation] : []), ...modifierText(pick(raw, MODIFIERS)),
    ...(nested ? modifierText(nested) : [])];
  const held = truthy(pick(raw, ["held", "hold", "on_hold", "is_held", "waiting"])) || /hold|held|attesa/.test(status) || pick(raw, ["fired", "sent", "is_fired"]) === false;
  const course = text(pick(raw, COURSE)) ?? context.course;
  const category = text(pick(raw, CATEGORY));
  const plu = text(pick(raw, PLU), 80);
  const note = text(pick(raw, NOTE), 300);
  const allergens = words(pick(raw, ALLERGENS)).slice(0, 20);
  const lineTotal = money(raw, LINE_TOTAL);
  const unit = lineTotal === undefined ? money(raw, UNIT_PRICE) : undefined;
  const total = lineTotal !== undefined ? Math.abs(lineTotal) : unit !== undefined ? Math.round(Math.abs(unit) * quantity * 100) / 100 : null;
  const id = text(pick(raw, LINE_ID), 120) ?? "";
  return [{
    id, name, quantity, modifiers,
    ...(note ? { note } : {}), ...(course ? { course } : {}), ...(category ? { category } : {}), ...(plu ? { plu } : {}),
    ...(allergens.length ? { allergens } : {}), ...(held ? { held: true } : {}), ...(voided ? { voided: true } : {}),
    total
  }];
}

/**
 * Lines without an id of their own get one from the dish and its variants, numbered when repeated, so
 * a till that resends the whole order keeps the same ids even if a line is added in the middle.
 * Repeated ids (a product id used as line id) are numbered too.
 */
function fillIds(lines: PosLine[]): PosLine[] {
  const seen = new Map<string, number>();
  return lines.map((line) => {
    const base = line.id || "auto:" + line.name.toLowerCase() + (line.modifiers.length ? "|" + line.modifiers.join("|").toLowerCase() : "");
    const count = (seen.get(base) ?? 0) + 1;
    seen.set(base, count);
    return { ...line, id: (count > 1 ? base + "#" + count : base).slice(0, 200) };
  });
}

/** Does this array look like order lines: objects (or strings) with a dish name? */
function looksLikeLines(value: unknown): value is unknown[] {
  return Array.isArray(value) && value.some((row) => typeof row === "string" || (isObject(row) && (present(pick(row, NAME)) || LINE_LISTS.some((key) => Array.isArray(pick(row, [key]))))));
}

/** Lists of groups (courses, seats, rounds) that hold the lines inside; plain strings there are course names, not dishes. */
const GROUP_LISTS = ["courses", "seats", "rounds", "groups", "guests"];
const isGroupList = (value: unknown): value is unknown[] => Array.isArray(value) && value.some((row) => isObject(row) && LINE_LISTS.some((key) => looksLikeLines(pick(row, [key]))));

/** The order's lines, directly or inside courses or seats. */
function lineListOf(object: Json): unknown[] | undefined {
  return (LINE_LISTS.map((key) => pick(object, [key])).find(looksLikeLines) ?? GROUP_LISTS.map((key) => pick(object, [key])).find(isGroupList)) as unknown[] | undefined;
}

interface Found { order: Json; path: Json[]; /** Found inside a list (a check or bill of the order), not the order itself. */ part?: boolean }

/** The shallowest object holding a list of lines, with the envelopes around it. */
function findOrder(root: Json): Found | null {
  const queue: Found[] = [{ order: root, path: [] }];
  for (let depth = 0; queue.length && depth < 400; depth++) {
    const current = queue.shift() as Found;
    if (lineListOf(current.order)) return current;
    if (current.path.length >= 5) continue;
    for (const value of Object.values(current.order)) {
      if (isObject(value)) queue.push({ order: value, path: [...current.path, current.order] });
      // Orders split in checks or bills: the first one with lines.
      else if (Array.isArray(value)) for (const item of value.slice(0, 5)) if (isObject(item)) queue.push({ order: item, path: [...current.path, current.order], part: true });
    }
  }
  return null;
}

/** For notices without lines: the innermost object that names an order ("data.object.order_updated"). */
function findHeader(root: Json): Found {
  let best: Found = { order: root, path: [] };
  const walk = (object: Json, path: Json[]) => {
    if (path.length > 5) return;
    if (present(pick(object, ORDER_ID)) || present(pick(object, [...STATUS, ...TABLE]))) best = { order: object, path };
    for (const value of Object.values(object)) if (isObject(value)) walk(value, [...path, object]);
  };
  walk(root, []);
  return best;
}

function readOne(root: Json, headers: Record<string, string>): PosEvent {
  const found = findOrder(root) ?? findHeader(root);
  const { order, path, part } = found;
  const around = [...path].reverse();
  // Event words come from the envelopes and the headers; the order's status adds to them.
  const labelParts = [
    ...EVENT_HEADERS.map((name) => headers[name]).filter(Boolean),
    ...[root, ...path.slice(1), order].map((object) => text(pick(object, EVENT_WORDS))).filter(Boolean),
    text(pick(order, STATUS))
  ].filter((part): part is string => Boolean(part));
  const label = Array.from(new Set(labelParts)).join(" ").slice(0, 160);
  const lineList = lineListOf(order);
  const lines = fillIds((lineList ?? []).flatMap((line, index) => readLine(line, index, {}))).slice(0, 300);

  const fromOrder = (names: string[]) => pick(order, names) ?? around.map((object) => pick(object, names)).find(present);
  // The order's own "id" counts as its id, except on an outer envelope without lines, where "id" is the notice's.
  const ownId = order === root && !lineList && present(pick(root, EVENT_WORDS)) ? undefined : pick(order, ["id", "uuid", "guid"]);
  // Otherwise the nearest envelope's id: an order split in checks keeps its id outside the check.
  const envelopeId = around.map((object) => pick(object, ORDER_ID) ?? (object === root && present(pick(root, EVENT_WORDS)) ? undefined : pick(object, ["id", "uuid", "guid"]))).find(present);
  const orderId = text(pick(order, ORDER_ID) ?? (part ? envelopeId ?? ownId : ownId ?? envelopeId), 120);
  let kind = kindOf(label);
  if (kind === "unknown" && lines.length) kind = "order";
  const fired = kind === "fire" ? words(pick(order, FIRED) ?? around.map((object) => pick(object, FIRED)).find(present)).filter((course) => !/^(true|false)$/i.test(course)) : [];
  const covers = number(fromOrder(COVERS));
  const at = text(fromOrder(AT), 40);
  return {
    kind, label, lines, fired,
    ...(orderId ? { orderId } : {}),
    ...(text(fromOrder(RECEIPT_ID), 120) ? { receiptId: text(fromOrder(RECEIPT_ID), 120) } : {}),
    ...(text(fromOrder(ORDER_NUMBER), 40) ? { number: text(fromOrder(ORDER_NUMBER), 40) } : {}),
    ...(text(fromOrder(TABLE), 60) ? { table: text(fromOrder(TABLE), 60) } : {}),
    ...(covers !== undefined && covers > 0 && covers < 1000 ? { covers: Math.round(covers) } : {}),
    ...(text(fromOrder(SERVER), 60) ? { server: text(fromOrder(SERVER), 60) } : {}),
    ...(text(fromOrder(CHANNEL), 60) ? { channel: text(fromOrder(CHANNEL), 60) } : {}),
    ...(text(pick(order, NOTE), 300) ? { note: text(pick(order, NOTE), 300) } : {}),
    allergies: words(pick(order, ALLERGIES)).slice(0, 20),
    ...(at && !Number.isNaN(Date.parse(at)) ? { at: new Date(at).toISOString() } : {}),
    total: money(order, ORDER_TOTAL) ?? null
  };
}

/**
 * Reads a till notice into events. A body may be one event, a list of events, or an envelope with
 * a list under "events" / "notifications"; headers are lower-case.
 */
export function readPosPayload(body: unknown, headers: Record<string, string> = {}): PosEvent[] {
  if (Array.isArray(body)) return body.filter(isObject).slice(0, 50).flatMap((item) => readPosPayload(item, headers));
  if (!isObject(body)) return [];
  const batch = pick(body, ["events", "notifications", "webhooks", "messages"]);
  if (Array.isArray(batch) && batch.some(isObject) && !lineListOf(body)) {
    return batch.filter(isObject).slice(0, 50).flatMap((item) => readPosPayload(item, headers));
  }
  return [readOne(body, headers)];
}

/** The id the till gives the notice, from the headers or the body, so a notice sent twice counts once. */
export function eventIdOf(body: unknown, headers: Record<string, string>): string | undefined {
  for (const name of EVENT_ID_HEADERS) if (headers[name]?.trim()) return headers[name].trim().slice(0, 200);
  if (!isObject(body)) return undefined;
  const explicit = text(pick(body, EVENT_ID), 200);
  if (explicit) return explicit;
  // An outer envelope with an event type and an id: the id is the notice's.
  if (present(pick(body, EVENT_WORDS)) && !lineListOf(body)) return text(pick(body, ["id"]), 200);
  return undefined;
}

/** One line for the log: "Order · table 4 · 3 lines". Italian; the browser translates the words it knows. */
export function summaryOf(event: PosEvent): string {
  const kind: Record<PosEventKind, string> = { order: "Nuova comanda", update: "Comanda modificata", fire: "Portata via", paid: "Scontrino pagato", void: "Storno", refund: "Rimborso", unknown: "Non riconosciuto" };
  const parts = [kind[event.kind]];
  if (event.table) parts.push("tavolo " + event.table);
  else if (event.number) parts.push("n. " + event.number);
  if (event.lines.length) parts.push(event.lines.length + (event.lines.length === 1 ? " riga" : " righe"));
  if (event.fired.length) parts.push(event.fired.join(", "));
  return parts.join(" · ");
}
