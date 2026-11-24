"use client";

import { useState } from "react";
import { PeopleAccess, useCompanyDirectory, type InvitePreset } from "@/components/company/CompanySettings";
import type { SettingsPatch } from "@/components/settings/SettingsDialog";
import { StaffPane, type StaffAccount } from "@/components/settings/StaffPane";
import type { Settings } from "@/lib/types";
import { useApp } from "@/state/AppProvider";

/**
 * People in one place: the staff (rota, pay, sites), saved with the other settings, and who can open
 * the app (invites, roles, where they work), saved at once. Each part shows only to the roles that
 * can change it; a staff row shows that person's account or offers to invite them.
 */
export function PeoplePane({ draft, patch, editStaff }: { draft: Settings; patch: SettingsPatch; editStaff: boolean }) {
  const { access, can, t } = useApp();
  const manage = Boolean(access) && can("users.manage");
  const { directory, busy, change, placeName } = useCompanyDirectory(manage);
  const [preset, setPreset] = useState<InvitePreset | null>(null);

  const of = (staffId: string): StaffAccount | undefined => {
    const member = directory?.members.find((row) => row.staffId === staffId);
    if (!member) return undefined;
    return { name: member.name, email: member.email, role: directory?.roles.find((role) => role.id === member.roleId)?.name ?? "" };
  };

  return (
    <div className="people-pane">
      {editStaff ? (
        <StaffPane draft={draft} patch={patch} accounts={manage ? {
          of,
          onInvite: (member) => setPreset((old) => ({ staffId: member.id, siteId: member.siteIds?.length === 1 ? member.siteIds[0] : access?.site.id ?? null, request: (old?.request ?? 0) + 1 }))
        } : undefined} />
      ) : null}
      {manage ? (
        <section className="settings-pane active people-access">
          <h3>{t("Accesso all'app")}</h3>
          <p>{t("Chi entra nell'app con un proprio account, con quale ruolo e in quali sedi. Inviti e incarichi si salvano subito.")}</p>
          {directory
            ? <PeopleAccess directory={directory} busy={busy} change={change} placeName={placeName} staff={draft.staff} preset={preset} />
            : <p className="company-empty">{t("Caricamento…")}</p>}
        </section>
      ) : null}
    </div>
  );
}
