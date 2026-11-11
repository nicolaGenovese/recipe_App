"use client";

import { CheckPill } from "@/components/ui/Field";
import { num } from "@/lib/num";
import { sortMenus } from "@/lib/menus/menus";
import { portionsOf } from "@/lib/recipes/math";
import { suggestedPortions } from "@/lib/performance/sales";
import type { PrepList, Recipe } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

interface Props {
  list: PrepList;
  dishes: Recipe[];
  includeMep: boolean;
  onIncludeMep: (value: boolean) => void;
  onChange: (change: Partial<PrepList>) => void;
  onRebuild: () => void;
  hasAuto: boolean;
}

/** Which menus the list is for, and how many portions of each dish are expected. */
export function PrepPlanPanel({ list, dishes, includeMep, onIncludeMep, onChange, onRebuild, hasAuto }: Props) {
  const { data, t, fmt, notify } = useApp();

  const toggleMenu = (id: string, on: boolean) => onChange({ menuIds: on ? [...list.menuIds, id] : list.menuIds.filter((other) => other !== id) });
  const setPortions = (dishId: string, value: string) => {
    const portions = { ...list.portions };
    if (value === "") delete portions[dishId];
    else portions[dishId] = Math.max(0, num(value));
    onChange({ portions });
  };

  const fromSales = () => {
    const portions = { ...list.portions };
    let found = 0;
    for (const dish of dishes) {
      const amount = suggestedPortions(data.salesWeeks, dish.id);
      if (amount > 0) { portions[dish.id] = amount; found += 1; }
    }
    onChange({ portions });
    return found;
  };

  return (
    <section className="prep-plan">
      <h4>{t("Menu e porzioni previste")}</h4>
      <div className="form-checks">
        {sortMenus(data.menus).map((menu) => (
          <CheckPill key={menu.id} checked={list.menuIds.includes(menu.id)} onChange={(on) => toggleMenu(menu.id, on)}>
            {menu.name}{menu.active ? "" : " · " + t("sospeso")}
          </CheckPill>
        ))}
        {data.menus.length ? null : <small className="field-hint">{t("Nessun menu: creane uno dalla pagina Menu.")}</small>}
      </div>
      {dishes.length ? (
        <div className="prep-portions">
          {dishes.map((dish) => (
            <label key={dish.id} className="prep-portion">
              <span>{dish.name}</span>
              <input type="number" min="0" step="1" value={list.portions[dish.id] ?? ""} placeholder={String(portionsOf(dish))}
                aria-label={t("Porzioni previste") + " · " + dish.name} onChange={(event) => setPortions(dish.id, event.target.value)} />
            </label>
          ))}
        </div>
      ) : null}
      <div className="prep-plan-actions">
        <CheckPill checked={includeMep} onChange={onIncludeMep}>{t("Includi le righe MEP dei piatti")}</CheckPill>
        {data.salesWeeks.length && dishes.length ? (
          <button className="button button-quiet button-small" type="button" title={t("Media giornaliera delle vendite delle ultime 4 settimane, arrotondata per eccesso.")}
            onClick={() => { const found = fromSales(); notify(found ? fmt(t("Porzioni previste dalle vendite per {0} piatti."), found) : t("Nessuna vendita registrata per questi piatti."), !found); }}>{t("Porzioni dalle vendite")}</button>
        ) : null}
        <button className="button button-secondary button-small" type="button" onClick={onRebuild}>{t(hasAuto ? "Aggiorna dai piatti" : "Genera dai piatti")}</button>
      </div>
      <p className="field-hint">{t("Le basi usate da più piatti diventano una sola preparazione, con le quantità sommate. Senza porzioni previste conta una resa della ricetta. Le righe aggiunte a mano restano.")}</p>
    </section>
  );
}
