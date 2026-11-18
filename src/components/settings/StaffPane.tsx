"use client";

import type { SettingsPatch } from "@/components/settings/SettingsDialog";
import { num } from "@/lib/num";
import { staffId } from "@/lib/staff";
import type { Settings, StaffMember } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

/** The kitchen team: who is on the rota and what each person earns per hour. */
export function StaffPane({ draft, patch }: { draft: Settings; patch: SettingsPatch }) {
  const { data, f, t, fmt, access } = useApp();
  // People can work at several sites of the company; none ticked means every site.
  const sites = access ? access.sites.filter((site) => site.companyId === access.company.id) : [];
  const toggleSite = (index: number, siteId: string, on: boolean) => {
    const current = draft.staff[index].siteIds ?? [];
    const next = on ? [...current, siteId] : current.filter((id) => id !== siteId);
    setMember(index, { siteIds: next.length ? next : undefined });
  };
  const setMember = (index: number, change: Partial<StaffMember>) => patch({ staff: draft.staff.map((member, at) => (at === index ? { ...member, ...change } : member)) });
  const onRota = (name: string) => data.rotaWeeks.some((week) => week.rows.some((row) => row.name.trim().toLocaleLowerCase() === name.trim().toLocaleLowerCase() && row.shifts.some(Boolean)));

  function remove(index: number) {
    const member = draft.staff[index];
    // Someone with shifts on the rota is better kept as inactive, so old weeks still show their pay.
    if (member.name.trim() && onRota(member.name) && !window.confirm(fmt(t("{0} ha dei turni salvati: conviene togliere la spunta \"In organico\". Eliminarlo comunque?"), member.name))) return;
    patch({ staff: draft.staff.filter((_, at) => at !== index) });
  }

  return (
    <section className="settings-pane active">
      <h3>{t("Personale")}</h3>
      <p>{t("Chi compare nei Turni e quanto guadagna all'ora. Togli la spunta \"In organico\" a chi non lavora più: resta nello storico ma non nelle settimane nuove.")}</p>
      <div className="stock-table-wrap">
        <table className="stock-table staff-table">
          <thead><tr><th>{t("Nome")}</th><th>{t("Ruolo")}</th><th>{f.withCurrency(t("€/ora"))}</th><th>{t("In organico")}</th>{sites.length > 1 ? <th>{t("Sedi")}</th> : null}<th /></tr></thead>
          <tbody>
            {draft.staff.map((member, index) => (
              <tr key={member.id} className={member.active ? "" : "staff-inactive"}>
                <td><input value={member.name} aria-label={t("Nome")} placeholder={t("Nome e cognome")} onChange={(event) => setMember(index, { name: event.target.value })} /></td>
                <td><input value={member.role ?? ""} aria-label={t("Ruolo")} placeholder={t("Es. Chef, KP")} onChange={(event) => setMember(index, { role: event.target.value })} /></td>
                <td><input type="number" min="0" step="0.01" value={member.hourlyRate || ""} aria-label={f.withCurrency(t("€/ora"))} onChange={(event) => setMember(index, { hourlyRate: Math.max(0, num(event.target.value)) })} /></td>
                <td><input type="checkbox" checked={member.active} aria-label={t("In organico")} onChange={(event) => setMember(index, { active: event.target.checked })} /></td>
                {sites.length > 1 ? (
                  <td className="staff-sites" title={t("Nessuna spunta: lavora in tutte le sedi.")}>
                    {sites.map((site) => (
                      <label key={site.id}><input type="checkbox" checked={Boolean(member.siteIds?.includes(site.id))} onChange={(event) => toggleSite(index, site.id, event.target.checked)} />{site.name}</label>
                    ))}
                  </td>
                ) : null}
                <td><button className="card-action" type="button" aria-label={t("Rimuovi")} onClick={() => remove(index)}>×</button></td>
              </tr>
            ))}
            {draft.staff.length ? null : <tr><td colSpan={sites.length > 1 ? 6 : 5} className="safety-empty">{t("Nessuna persona. Aggiungi chi lavora in cucina.")}</td></tr>}
          </tbody>
        </table>
      </div>
      <button className="button button-secondary button-small stock-add-line" type="button"
        onClick={() => patch({ staff: [...draft.staff, { id: staffId("new-" + Date.now()), name: "", role: "", hourlyRate: 0, active: true }] })}>{t("Aggiungi persona")}</button>
      <label className="settings-inline">
        <span>{t("Contributi e oneri del datore di lavoro (%)")}</span>
        <input type="number" min="0" step="0.5" value={draft.labour.onCostPercent} onChange={(event) => patch({ labour: { ...draft.labour, onCostPercent: Math.max(0, num(event.target.value)) } })} />
      </label>
      {sites.length > 1 ? <p className="field-hint">{t("Sedi: dove lavora la persona. Senza spunte compare nei turni di tutte le sedi; chi lavora in più sedi vede i turni delle altre sedi accanto ai propri.")}</p> : null}
      <p className="field-hint">{t("Il costo di una persona è ore × paga oraria più questa percentuale. I turni sono legati al nome: se cambi un nome, i turni già scritti restano sotto quello vecchio.")}</p>
    </section>
  );
}
