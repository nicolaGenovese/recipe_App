"use client";

import { useCallback, useEffect, useState } from "react";
import { PERMISSIONS, canAssignLevel, normalizePermissions, type Permission, type ScopeType } from "@/lib/access/permissions";
import type { CompanyDirectory } from "@/lib/server/directory";
import type { AuditRow } from "@/lib/server/store/types";
import { useApp } from "@/state/AppProvider";

type Tab = "compare" | "people" | "sites" | "roles" | "audit";

async function call<T>(method: "GET" | "POST", url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) throw new Error(payload.error || "Operazione non riuscita.");
  return payload as T;
}

/** "company:<id>", "area:<id>" or "site:<id>": one value for the place pickers. */
const placeKey = (type: ScopeType, id: string) => type + ":" + id;
const splitPlace = (value: string) => { const [type, ...rest] = value.split(":"); return { scopeType: type as ScopeType, scopeId: rest.join(":") }; };

/** Company administration: people and invites, sites and areas, roles and permissions, activity log. */
export function CompanyView() {
  const { access, can, data, notify, reload, t, f } = useApp();
  const [tab, setTab] = useState<Tab>(can("reports.company") ? "compare" : can("users.manage") ? "people" : "sites");
  const [directory, setDirectory] = useState<CompanyDirectory | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setDirectory(await call<CompanyDirectory>("GET", "/api/company")); }
    catch (error) { notify(t(error instanceof Error ? error.message : "Operazione non riuscita."), true); }
  }, [notify, t]);
  useEffect(() => { void load(); }, [load, access?.company.id]);

  /** Sends one change; the answer is the updated directory. */
  const change = async (body: Record<string, unknown>, done?: string) => {
    setBusy(true);
    try {
      const next = await call<CompanyDirectory & { token?: string }>("POST", "/api/company", body);
      if (next.token) { await load(); setBusy(false); return next.token; }
      setDirectory(next);
      if (done) notify(t(done));
      // Names of sites and the company show in the sidebar too.
      if (["renameCompany", "saveSite", "deleteSite"].includes(String(body.action))) await reload();
    } catch (error) {
      notify(t(error instanceof Error ? error.message : "Operazione non riuscita."), true);
    }
    setBusy(false);
    return undefined;
  };

  if (!access) return <p className="company-empty">{t("La gestione della compagnia richiede il database e gli account.")}</p>;
  if (!directory) return <p className="company-empty">{t("Caricamento…")}</p>;

  const tabs: [Tab, string, boolean][] = [
    ["compare", t("Confronto sedi"), can("reports.company")],
    ["people", t("Persone"), can("users.manage")],
    ["sites", t("Sedi e aree"), true],
    ["roles", t("Ruoli e permessi"), true],
    ["audit", t("Registro attività"), can("audit.view")]
  ];
  const placeName = (type: ScopeType, id: string) => type === "company" ? t("Tutta la compagnia")
    : type === "area" ? t("Area") + " · " + (directory.areas.find((area) => area.id === id)?.name ?? "?")
      : directory.sites.find((site) => site.id === id)?.name ?? "?";

  return (
    <section className="company-view">
      <CompanyName name={directory.company.name} editable={can("company.manage")} busy={busy} onSave={(name) => change({ action: "renameCompany", name }, "Nome salvato.")} />
      <div className="editor-tabs stock-tabs company-tabs">
        {tabs.filter(([, , show]) => show).map(([key, label]) => (
          <button key={key} type="button" className={"editor-tab" + (tab === key ? " active" : "")} onClick={() => setTab(key)}>{label}</button>
        ))}
      </div>
      {tab === "compare" ? <Compare f={f} />
        : tab === "people" ? <People directory={directory} busy={busy} change={change} placeName={placeName} staff={data.settings.staff} />
        : tab === "sites" ? <Sites directory={directory} busy={busy} change={change} editable={can("company.manage")} />
          : tab === "roles" ? <Roles directory={directory} busy={busy} change={change} editable={can("company.manage")} />
            : <Audit placeName={(id) => (id ? directory.sites.find((site) => site.id === id)?.name ?? "" : t("Compagnia"))} f={f} />}
    </section>
  );
}

function CompanyName({ name, editable, busy, onSave }: { name: string; editable: boolean; busy: boolean; onSave: (name: string) => void }) {
  const { t } = useApp();
  const [value, setValue] = useState(name);
  useEffect(() => setValue(name), [name]);
  if (!editable) return <h2 className="company-name">{name}</h2>;
  return (
    <form className="company-name-form" onSubmit={(event) => { event.preventDefault(); if (value.trim() && value.trim() !== name) onSave(value.trim()); }}>
      <label htmlFor="companyName">{t("Nome della compagnia")}</label>
      <input id="companyName" value={value} onChange={(event) => setValue(event.target.value)} />
      <button className="button button-secondary button-small" type="submit" disabled={busy || !value.trim() || value.trim() === name}>{t("Salva")}</button>
    </form>
  );
}

type Change = (body: Record<string, unknown>, done?: string) => Promise<string | undefined>;

/** Places the signed-in user may assign: the whole company and areas only for company-wide people. */
function usePlaces(directory: CompanyDirectory) {
  const { access, t } = useApp();
  const mine = new Set(access?.sites.filter((site) => site.companyId === directory.company.id).map((site) => site.id) ?? []);
  const wide = directory.sites.every((site) => mine.has(site.id)) && (access?.level ?? 9) <= 2;
  const places: [string, string][] = [
    ...(wide ? [[placeKey("company", directory.company.id), t("Tutta la compagnia")] as [string, string]] : []),
    ...directory.areas.filter((area) => directory.sites.filter((site) => site.areaId === area.id).every((site) => mine.has(site.id)))
      .map((area) => [placeKey("area", area.id), t("Area") + " · " + area.name] as [string, string]),
    ...directory.sites.filter((site) => mine.has(site.id)).map((site) => [placeKey("site", site.id), site.name] as [string, string])
  ];
  return places;
}

function People({ directory, busy, change, placeName, staff }: { directory: CompanyDirectory; busy: boolean; change: Change; placeName: (type: ScopeType, id: string) => string; staff: { id: string; name: string; active: boolean }[] }) {
  const { access, t, f, notify } = useApp();
  const own = access?.level ?? 1;
  const roles = directory.roles.filter((role) => canAssignLevel(own, role.level));
  const places = usePlaces(directory);
  const [roleId, setRoleId] = useState(roles[roles.length - 1]?.id ?? "");
  const [place, setPlace] = useState(places.find(([key]) => key.startsWith("site:"))?.[0] ?? places[0]?.[0] ?? "");
  const [staffId, setStaffId] = useState("");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState("");
  const roleName = (id: string) => t(directory.roles.find((role) => role.id === id)?.name ?? "?");
  const linkOf = (token: string) => window.location.origin + "/invito/" + token;
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); notify(t("Link copiato: mandalo alla persona (WhatsApp, email…).")); }
    catch { window.prompt(t("Copia il link:"), text); }
  };
  const invite = async () => {
    const token = await change({ action: "invite", roleId, ...splitPlace(place), staffId, email }, undefined);
    if (token) { setLink(linkOf(token)); setEmail(""); void copy(linkOf(token)); }
  };
  const staffName = (id: string | null) => staff.find((member) => member.id === id)?.name;

  return (
    <div className="company-people">
      <section className="company-card">
        <h3>{t("Invita una persona")}</h3>
        <p className="company-hint">{t("Crea un link d'invito e mandalo alla persona: con il link crea il suo account ed entra con il ruolo scelto. Vale 14 giorni e una sola volta.")}</p>
        <div className="company-form">
          <label>{t("Ruolo")}<select value={roleId} onChange={(event) => setRoleId(event.target.value)}>{roles.map((role) => <option key={role.id} value={role.id}>{t(role.name)}</option>)}</select></label>
          <label>{t("Dove")}<select value={place} onChange={(event) => setPlace(event.target.value)}>{places.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label>{t("Persona in organico")}<select value={staffId} onChange={(event) => setStaffId(event.target.value)}>
            <option value="">{t("Nessuna")}</option>{staff.filter((member) => member.active).map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
          </select></label>
          <label>{t("Email (facoltativa)")}<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder={t("Solo questa email potrà usarlo")} /></label>
          <button className="button button-primary" type="button" disabled={busy || !roleId || !place} onClick={() => void invite()}>{t("Crea link d'invito")}</button>
        </div>
        {link ? <p className="company-link"><code>{link}</code> <button type="button" className="button button-secondary button-small" onClick={() => void copy(link)}>{t("Copia")}</button></p> : null}
      </section>

      <div className="stock-table-wrap">
        <table className="stock-table company-table">
          <thead><tr><th>{t("Persona")}</th><th>{t("Ruolo")}</th><th>{t("Dove")}</th><th>{t("In organico")}</th><th /></tr></thead>
          <tbody>
            {directory.members.map((member) => {
              const role = directory.roles.find((row) => row.id === member.roleId);
              const self = member.userId === access?.user.id;
              const editable = self || (role ? canAssignLevel(own, role.level) && own !== role.level : false);
              const memberPlace = placeKey(member.scopeType, member.scopeId);
              return (
                <tr key={member.id}>
                  <td><strong>{member.name}</strong>{self ? <span className="category-tag">{t("tu")}</span> : null}<small className="company-sub">{member.email}</small></td>
                  <td>{editable && !self ? (
                    <select value={member.roleId} disabled={busy} onChange={(event) => void change({ action: "updateMember", id: member.id, roleId: event.target.value }, "Incarico aggiornato.")}>
                      {directory.roles.filter((row) => row.id === member.roleId || canAssignLevel(own, row.level)).map((row) => <option key={row.id} value={row.id}>{t(row.name)}</option>)}
                    </select>) : roleName(member.roleId)}</td>
                  <td>{editable && !self ? (
                    <select value={memberPlace} disabled={busy} onChange={(event) => void change({ action: "updateMember", id: member.id, ...splitPlace(event.target.value) }, "Incarico aggiornato.")}>
                      {places.some(([key]) => key === memberPlace) ? null : <option value={memberPlace}>{placeName(member.scopeType, member.scopeId)}</option>}
                      {places.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    </select>) : placeName(member.scopeType, member.scopeId)}</td>
                  <td>{editable ? (
                    <select value={member.staffId ?? ""} disabled={busy} onChange={(event) => void change({ action: "updateMember", id: member.id, staffId: event.target.value }, "Collegamento salvato.")}>
                      <option value="">{t("Nessuna")}</option>
                      {staff.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}
                    </select>) : staffName(member.staffId) ?? "—"}</td>
                  <td>{editable && !self ? <button type="button" className="button-quiet danger" disabled={busy} onClick={() => { if (window.confirm(t("Togliere l'accesso a questa persona?"))) void change({ action: "removeMember", id: member.id }, "Accesso tolto."); }}>{t("Togli")}</button> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {directory.invites.length ? (
        <section>
          <h3 className="company-subtitle">{t("Inviti in attesa")}</h3>
          <ul className="company-invites">
            {directory.invites.map((row) => (
              <li key={row.token}>
                <span><strong>{roleName(row.roleId)}</strong> · {placeName(row.scopeType, row.scopeId)}{row.email ? " · " + row.email : ""}{row.staffId && staffName(row.staffId) ? " · " + staffName(row.staffId) : ""}<small>{t("scade")} {f.dateLabel(row.expiresAt.slice(0, 10))}</small></span>
                <button type="button" className="button button-secondary button-small" onClick={() => void copy(linkOf(row.token))}>{t("Copia link")}</button>
                <button type="button" className="button-quiet danger" disabled={busy} onClick={() => void change({ action: "revokeInvite", token: row.token }, "Invito annullato.")}>{t("Annulla")}</button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function Sites({ directory, busy, change, editable }: { directory: CompanyDirectory; busy: boolean; change: Change; editable: boolean }) {
  const { t } = useApp();
  const [areaName, setAreaName] = useState("");
  const [siteName, setSiteName] = useState("");
  const [siteArea, setSiteArea] = useState("");
  const rename = (label: string, current: string) => { const value = window.prompt(label, current)?.trim(); return value && value !== current ? value : null; };
  return (
    <div className="company-sites">
      <section className="company-card">
        <h3>{t("Sedi")}</h3>
        <ul className="company-list">
          {directory.sites.map((site) => (
            <li key={site.id}>
              <strong>{site.name}</strong>
              {editable ? (
                <>
                  <select aria-label={t("Area")} value={site.areaId ?? ""} disabled={busy} onChange={(event) => void change({ action: "saveSite", id: site.id, name: site.name, kind: site.kind, areaId: event.target.value }, "Sede salvata.")}>
                    <option value="">{t("Nessuna area")}</option>
                    {directory.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}
                  </select>
                  <button type="button" className="button-quiet" disabled={busy} onClick={() => { const name = rename(t("Nome della sede"), site.name); if (name) void change({ action: "saveSite", id: site.id, name, kind: site.kind, areaId: site.areaId ?? "" }, "Sede salvata."); }}>{t("Rinomina")}</button>
                  <button type="button" className="button-quiet danger" disabled={busy || directory.sites.length === 1} onClick={() => { if (window.confirm(t("Eliminare questa sede? Si può solo se non ha ancora dati."))) void change({ action: "deleteSite", id: site.id }, "Sede eliminata."); }}>{t("Elimina")}</button>
                </>
              ) : <span className="company-sub">{directory.areas.find((area) => area.id === site.areaId)?.name ?? ""}</span>}
            </li>
          ))}
        </ul>
        {editable ? (
          <form className="company-form inline" onSubmit={(event) => { event.preventDefault(); void change({ action: "saveSite", name: siteName, areaId: siteArea }, "Sede aggiunta.").then(() => setSiteName("")); }}>
            <label>{t("Nuova sede")}<input value={siteName} onChange={(event) => setSiteName(event.target.value)} placeholder={t("Es. Battersea Kitchen")} /></label>
            <label>{t("Area")}<select value={siteArea} onChange={(event) => setSiteArea(event.target.value)}><option value="">{t("Nessuna area")}</option>{directory.areas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
            <button className="button button-primary" type="submit" disabled={busy || !siteName.trim()}>{t("Aggiungi sede")}</button>
          </form>
        ) : null}
        <p className="company-hint">{t("Le ricette della libreria e i prodotti sono di tutta la compagnia; menu, magazzino, prep list, turni e registri sono di ogni sede.")}</p>
      </section>
      <section className="company-card">
        <h3>{t("Aree")}</h3>
        <p className="company-hint">{t("Facoltative: raggruppano le sedi (es. \"Londra Sud\") per gli area manager.")}</p>
        <ul className="company-list">
          {directory.areas.map((area) => (
            <li key={area.id}>
              <strong>{area.name}</strong><span className="company-sub">{directory.sites.filter((site) => site.areaId === area.id).map((site) => site.name).join(", ") || t("nessuna sede")}</span>
              {editable ? (
                <>
                  <button type="button" className="button-quiet" disabled={busy} onClick={() => { const name = rename(t("Nome dell'area"), area.name); if (name) void change({ action: "saveArea", id: area.id, name }, "Area salvata."); }}>{t("Rinomina")}</button>
                  <button type="button" className="button-quiet danger" disabled={busy} onClick={() => void change({ action: "deleteArea", id: area.id }, "Area eliminata.")}>{t("Elimina")}</button>
                </>
              ) : null}
            </li>
          ))}
        </ul>
        {editable ? (
          <form className="company-form inline" onSubmit={(event) => { event.preventDefault(); void change({ action: "saveArea", name: areaName }, "Area aggiunta.").then(() => setAreaName("")); }}>
            <label>{t("Nuova area")}<input value={areaName} onChange={(event) => setAreaName(event.target.value)} placeholder={t("Es. Londra Sud")} /></label>
            <button className="button button-secondary" type="submit" disabled={busy || !areaName.trim()}>{t("Aggiungi area")}</button>
          </form>
        ) : null}
      </section>
    </div>
  );
}

const SCOPE_LABELS: Record<ScopeType, string> = { company: "Compagnia", area: "Area", site: "Sede" };

function Roles({ directory, busy, change, editable }: { directory: CompanyDirectory; busy: boolean; change: Change; editable: boolean }) {
  const { access, t } = useApp();
  const own = access?.level ?? 1;
  const [name, setName] = useState("");
  const [level, setLevel] = useState(String(Math.max(own + 1, 5)));
  const [scope, setScope] = useState<ScopeType>("site");
  const groups = Array.from(new Set(PERMISSIONS.map((row) => row.group)));
  const can = (role: CompanyDirectory["roles"][number]) => editable && role.template !== "owner" && canAssignLevel(own, role.level) && own !== role.level;
  const toggle = (role: CompanyDirectory["roles"][number], permission: Permission, on: boolean) => {
    const next = on ? [...role.permissions, permission] : role.permissions.filter((row) => row !== permission);
    // Removing a permission also removes the ones that depend on it.
    const cleaned = on ? normalizePermissions(next) : normalizePermissions(next).filter((row) => next.includes(row));
    void change({ action: "saveRole", id: role.id, name: role.name, level: role.level, scope: role.scope, permissions: cleaned });
  };
  const edit = (role: CompanyDirectory["roles"][number]) => {
    const newName = window.prompt(t("Nome del ruolo"), role.name)?.trim();
    if (!newName) return;
    const newLevel = role.template === "owner" ? 1 : Number(window.prompt(t("Livello (1 = il più alto). Puoi assegnare solo ruoli con livello più basso del tuo."), String(role.level)) || role.level);
    void change({ action: "saveRole", id: role.id, name: newName, level: newLevel, scope: role.scope, permissions: role.permissions }, "Ruolo salvato.");
  };
  return (
    <div className="company-roles">
      <p className="company-hint">{t("Ogni ruolo è un pacchetto di permessi. Spunta o togli un permesso per cambiarlo in tutta la compagnia; chi ha quel ruolo lo vede alla prossima apertura. Alcuni permessi ne includono altri (chi modifica ricette o magazzino vede anche i costi).")}</p>
      <div className="stock-table-wrap">
        <table className="stock-table role-matrix">
          <thead>
            <tr>
              <th>{t("Permesso")}</th>
              {directory.roles.map((role) => (
                <th key={role.id}>
                  <span className="role-head">{t(role.name)}<small>{t("liv.")} {role.level} · {t(SCOPE_LABELS[role.scope])} · {role.members} {t(role.members === 1 ? "persona" : "persone")}</small></span>
                  {editable && (role.template === "owner" ? own === 1 : can(role)) ? <button type="button" className="link-button" onClick={() => edit(role)}>{t("Modifica")}</button> : null}
                  {editable && can(role) && !role.members ? <button type="button" className="link-button danger" onClick={() => { if (window.confirm(t("Eliminare questo ruolo?"))) void change({ action: "deleteRole", id: role.id }, "Ruolo eliminato."); }}>{t("Elimina")}</button> : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => [
              <tr key={group} className="role-group"><td colSpan={directory.roles.length + 1}>{t(group)}</td></tr>,
              ...PERMISSIONS.filter((row) => row.group === group).map((permission) => (
                <tr key={permission.key}>
                  <td>{t(permission.label)}</td>
                  {directory.roles.map((role) => {
                    const on = role.permissions.includes(permission.key);
                    return (
                      <td key={role.id} className="role-cell">
                        <input type="checkbox" checked={on} disabled={busy || !can(role)} aria-label={role.name + " · " + t(permission.label)} onChange={(event) => toggle(role, permission.key, event.target.checked)} />
                      </td>
                    );
                  })}
                </tr>
              ))
            ])}
          </tbody>
        </table>
      </div>
      {editable ? (
        <form className="company-form inline" onSubmit={(event) => { event.preventDefault(); void change({ action: "saveRole", name, level: Number(level), scope, permissions: [] }, "Ruolo creato: scegli i suoi permessi nella tabella.").then(() => setName("")); }}>
          <label>{t("Nuovo ruolo")}<input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("Es. Pastry chef")} /></label>
          <label>{t("Livello")}<input type="number" min={own === 1 ? 2 : own + 1} max={20} value={level} onChange={(event) => setLevel(event.target.value)} /></label>
          <label>{t("Ambito tipico")}<select value={scope} onChange={(event) => setScope(event.target.value as ScopeType)}>{(Object.keys(SCOPE_LABELS) as ScopeType[]).map((key) => <option key={key} value={key}>{t(SCOPE_LABELS[key])}</option>)}</select></label>
          <button className="button button-primary" type="submit" disabled={busy || !name.trim()}>{t("Crea ruolo")}</button>
        </form>
      ) : null}
    </div>
  );
}

const ACTIONS: Record<string, string> = {
  price: "Prezzo cambiato", pay: "Paga cambiata", rota: "Turni salvati", role: "Ruolo o permessi cambiati", "role-deleted": "Ruolo eliminato",
  member: "Incarico cambiato", "member-removed": "Accesso tolto", invite: "Invito creato", site: "Sede salvata", "site-deleted": "Sede eliminata",
  area: "Area salvata", "area-deleted": "Area eliminata", company: "Compagnia rinominata"
};

function Audit({ placeName, f }: { placeName: (siteId: string | null) => string; f: ReturnType<typeof useApp>["f"] }) {
  const { t, notify } = useApp();
  const [rows, setRows] = useState<AuditRow[] | null>(null);
  useEffect(() => {
    call<AuditRow[]>("GET", "/api/company?audit=1").then(setRows).catch((error) => notify(t(error instanceof Error ? error.message : "Operazione non riuscita."), true));
  }, [notify, t]);
  const detail = (row: AuditRow) => {
    const value = row.detail as Record<string, unknown> | null;
    if (row.action === "price" && value) return f.money(Number(value.from)) + " → " + f.money(Number(value.to));
    if (row.action === "pay" && Array.isArray(value)) return value.map((change: Record<string, unknown>) => change.name + " " + f.money(Number(change.from)) + " → " + f.money(Number(change.to))).join(", ");
    return "";
  };
  if (!rows) return <p className="company-empty">{t("Caricamento…")}</p>;
  if (!rows.length) return <p className="company-empty">{t("Ancora nessuna attività registrata.")}</p>;
  return (
    <div className="stock-table-wrap">
      <table className="stock-table company-table">
        <thead><tr><th>{t("Quando")}</th><th>{t("Chi")}</th><th>{t("Cosa")}</th><th>{t("Dove")}</th></tr></thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={index}>
              <td>{f.dateLabel(row.at.slice(0, 10))} {new Date(row.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</td>
              <td>{row.userName || "—"}</td>
              <td><strong>{t(ACTIONS[row.action] ?? row.action)}</strong> · {row.target}<small className="company-sub">{detail(row)}</small></td>
              <td>{placeName(row.siteId)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface SiteFigures {
  siteId: string; siteName: string; weeks: number; netSales: number; theoreticalGp: number | null; actualGp: number | null;
  waste: number; wastePercent: number | null; labour: number; labourPercent: number | null; primePercent: number | null; safetyIssues: number; missingToday: number;
}

/** Head office view: the last four complete weeks of every site side by side. */
function Compare({ f }: { f: ReturnType<typeof useApp>["f"] }) {
  const { t, notify, switchSite } = useApp();
  const [rows, setRows] = useState<SiteFigures[] | null>(null);
  useEffect(() => {
    call<SiteFigures[]>("GET", "/api/company?compare=1").then(setRows).catch((error) => notify(t(error instanceof Error ? error.message : "Operazione non riuscita."), true));
  }, [notify, t]);
  if (!rows) return <p className="company-empty">{t("Caricamento…")}</p>;
  const pct = (value: number | null) => (value === null ? "—" : value.toFixed(1) + "%");
  const total = rows.reduce((sum, row) => ({ sales: sum.sales + row.netSales, waste: sum.waste + row.waste, labour: sum.labour + row.labour }), { sales: 0, waste: 0, labour: 0 });
  return (
    <div className="company-compare">
      <p className="company-hint">{t("Ultime 4 settimane complete. Vendite e GP teorico vengono dalle vendite inserite in Andamento, il GP reale dall'ultimo report stock inviato, il costo del personale dai turni.")}</p>
      <div className="stock-table-wrap">
        <table className="stock-table company-table compare-table">
          <thead><tr>
            <th>{t("Sede")}</th><th>{t("Vendite nette")}</th><th>{t("GP teorico")}</th><th>{t("GP reale")}</th><th>{t("Sprechi")}</th>
            <th>{t("Personale")}</th><th>{t("Prime cost")}</th><th>{t("Anomalie HACCP")}</th><th>{t("Da fare oggi")}</th><th />
          </tr></thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.siteId}>
                <td><strong>{row.siteName}</strong></td>
                <td>{f.money(row.netSales)}</td>
                <td>{pct(row.theoreticalGp)}</td>
                <td>{pct(row.actualGp)}</td>
                <td>{f.money(row.waste)}<small className="company-sub">{pct(row.wastePercent)}</small></td>
                <td>{f.money(row.labour)}<small className="company-sub">{pct(row.labourPercent)}</small></td>
                <td>{pct(row.primePercent)}</td>
                <td className={row.safetyIssues ? "compare-bad" : ""}>{row.safetyIssues}</td>
                <td className={row.missingToday ? "compare-bad" : ""}>{row.missingToday}</td>
                <td><button type="button" className="link-button" onClick={() => void switchSite(row.siteId)}>{t("Apri")}</button></td>
              </tr>
            ))}
          </tbody>
          {rows.length > 1 ? (
            <tfoot><tr>
              <th>{t("Totale")}</th><td>{f.money(total.sales)}</td><td /><td />
              <td>{f.money(total.waste)}</td><td>{f.money(total.labour)}</td><td colSpan={4} />
            </tr></tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}
