import { normalizeOrdersConfig, sampleOrder } from "@/lib/orders/orders";
import type { PosSetup } from "@/lib/orders/types";
import { dishesOfMenus } from "@/lib/menus/menus";
import { type RequestContext, requireContext } from "@/lib/server/auth/context";
import { randomId } from "@/lib/server/db";
import { audit } from "@/lib/server/guards";
import { handle, json, readJson } from "@/lib/server/http";
import { receivePos } from "@/lib/server/pos/receive";
import { HttpError } from "@/lib/server/validation";

export const dynamic = "force-dynamic";

/** Matching till dishes to recipes is for whoever edits the menus; the rest for whoever connects the till. */
function allowed(context: RequestContext) {
  if (!context.can("orders.setup") && !context.can("menus.edit")) context.require("orders.setup");
}

async function setup(context: RequestContext): Promise<PosSetup> {
  const full = context.can("orders.setup");
  const [{ config, connection }, events, items] = await Promise.all([
    context.store.orders.config(),
    full ? context.store.orders.events(40) : Promise.resolve([]),
    context.store.orders.items(30)
  ]);
  return { config, token: full ? connection.token : null, signed: Boolean(connection.signingSecret), enabled: connection.enabled, events, items };
}

/** GET /api/orders/setup: till connection, recent notices, dishes seen at the till and screen settings. */
export const GET = handle(async (request: Request) => {
  const context = await requireContext(request);
  allowed(context);
  return json(await setup(context));
});

/**
 * POST /api/orders/setup { action, ... }: "config" (stations, alarm times, not food), "map" (till dish
 * → recipe), "connect" (new webhook address; the old one stops working), "disconnect", "pause",
 * "resume", "secret" (signing secret) and "test" (a sample order through the same path as the till).
 */
export const POST = handle(async (request: Request) => {
  const context = await requireContext(request);
  allowed(context);
  const body = (await readJson(request)) as Record<string, unknown>;
  const orders = context.store.orders;
  const { config, connection } = await orders.config();
  switch (body.action) {
    case "config": {
      context.require("orders.setup");
      const next = normalizeOrdersConfig({ ...body.config as object, dishMap: config.dishMap });
      await orders.saveConfig(next);
      break;
    }
    case "map": {
      context.require("menus.edit");
      const key = typeof body.key === "string" ? body.key : "";
      if (!/^(plu|name):./.test(key)) throw new HttpError(400, "Piatto della cassa non valido.");
      const dishMap = { ...config.dishMap };
      if (typeof body.recipeId === "string" && body.recipeId) dishMap[key.slice(0, 200)] = body.recipeId;
      else delete dishMap[key];
      await orders.saveConfig({ ...config, dishMap });
      break;
    }
    case "connect":
      context.require("orders.setup");
      await orders.saveConnection({ ...connection, token: randomId("pos", 24), enabled: true });
      await audit(context, "pos.connect", connection.token ? "Nuovo indirizzo della cassa" : "Cassa collegata");
      break;
    case "disconnect":
      context.require("orders.setup");
      await orders.saveConnection({ ...connection, token: null });
      await audit(context, "pos.disconnect", "Cassa scollegata");
      break;
    case "pause":
    case "resume":
      context.require("orders.setup");
      await orders.saveConnection({ ...connection, enabled: body.action === "resume" });
      await audit(context, "pos." + body.action, body.action === "resume" ? "Cassa riattivata" : "Cassa sospesa");
      break;
    case "secret": {
      context.require("orders.setup");
      const secret = typeof body.secret === "string" ? body.secret.trim().slice(0, 300) : "";
      await orders.saveConnection({ ...connection, signingSecret: secret });
      await audit(context, "pos.secret", secret ? "Segreto di firma impostato" : "Segreto di firma tolto");
      break;
    }
    case "test": {
      context.require("orders.setup");
      const state = await context.store.getState();
      const dishes = dishesOfMenus(state.menus, state.menus.filter((menu) => menu.active).map((menu) => menu.id), state.recipes);
      const sample = sampleOrder(dishes.length ? dishes : state.recipes.filter((recipe) => !recipe.archivedBatch), Math.floor(Math.random() * 90) + 10);
      const raw = JSON.stringify(sample);
      await receivePos(orders, raw, sample, { "x-event-id": "test-" + Date.now() + "-" + Math.random().toString(36).slice(2) }, true);
      break;
    }
    default:
      throw new HttpError(400, "Operazione non riconosciuta.");
  }
  return json(await setup(context));
});
