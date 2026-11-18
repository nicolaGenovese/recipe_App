import { keepHiddenPay } from "@/lib/access/redact";
import { requireContext } from "@/lib/server/auth/context";
import { audit } from "@/lib/server/guards";
import { handle, json, readJson } from "@/lib/server/http";
import { parseSettings } from "@/lib/server/validation";

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * PUT /api/settings saves the settings. The company part (lists, currency, GP, staff) needs
 * "settings.company"; the site part (food safety) needs "settings.site". Only the changed parts
 * are written, and pay hidden from the user keeps its stored value.
 */
export const PUT = handle(async (request: Request) => {
  const context = await requireContext(request);
  const stored = (await context.store.getState()).settings;
  let settings = parseSettings(await readJson(request));
  if (!context.can("pay.view")) settings = keepHiddenPay(settings, stored);
  const { foodSafety: siteBefore, ...companyBefore } = stored;
  const { foodSafety: siteAfter, ...companyAfter } = settings;
  const parts = { company: !same(companyBefore, companyAfter), site: !same(siteBefore, siteAfter) };
  if (parts.company) context.require("settings.company");
  if (parts.site) context.require("settings.site");
  await context.store.saveSettings(settings, parts);
  const rates = new Map(stored.staff.map((member) => [member.id, member.hourlyRate]));
  const payChanges = settings.staff.filter((member) => rates.has(member.id) && rates.get(member.id) !== member.hourlyRate)
    .map((member) => ({ name: member.name, from: rates.get(member.id), to: member.hourlyRate }));
  if (payChanges.length) await audit(context, "pay", payChanges.map((change) => change.name).join(", "), payChanges, true);
  return json(settings);
});
