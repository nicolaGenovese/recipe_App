import { fmt, type Translate } from "@/lib/i18n";
import { num } from "@/lib/num";
import type { ReportSummary } from "@/lib/stock/report";

/** The GP formula in words, matching the rules the report is calculated with. */
export function gpFormula(rules: ReportSummary["rules"], t: Translate): string {
  const cost = rules.includeTransfers ? t("apertura + fatture + trasferimenti − chiusura") : t("apertura + fatture − chiusura");
  const vat = rules.salesIncludeVat ? " " + fmt(t("Vendite nette = vendite ÷ (1 + {0}% IVA)."), num(rules.salesVatRate)) : "";
  return t("GP = (vendite nette − costo del venduto) ÷ vendite nette.") + " " + fmt(t("Costo del venduto = {0}."), cost) + vat;
}

export function salesLabel(rules: ReportSummary["rules"], t: Translate): string {
  return t(rules.salesIncludeVat ? "Vendite food (IVA inclusa)" : "Vendite food nette");
}

/** CSS class for the GP figure: green on target, red below, plain without a target. */
export function gpClass(summary: Pick<ReportSummary, "onTarget">): string {
  return "stock-gp" + (summary.onTarget === null ? "" : summary.onTarget ? " stock-gp-ok" : " stock-gp-low");
}
