"use client";

import type { ReactNode } from "react";
import { useWords } from "@/app/login/AccountForms";
import { BrandIcon } from "@/components/ui/icons";
import { storeLanguage } from "@/lib/i18n";

/** A moment in the kitchen's day: when it happens, what the app does then. */
const DAY: [string, string, string][] = [
  ["07:30", "Giro temperature", "Frigoriferi e congelatori, con la foto del termometro. Se un valore è fuori limite l'app chiede subito l'azione correttiva."],
  ["09:45", "Arriva la consegna", "Fotografi la fattura: righe, quantità e prezzi entrano in magazzino, e i costi dei piatti si aggiornano da soli."],
  ["11:00", "Prep list", "Generata dai piatti in menu e dalle porzioni previste, con le etichette di preparazione e scadenza."],
  ["19:00", "Servizio", "Le comande della cassa arrivano sugli schermi di ogni partita, con le allergie in rosso in cima."],
  ["23:15", "Chiusura|giornata", "Checklist firmata da chi l'ha fatta; vendite e GP della giornata pronti per domattina."]
];

const ROLES: [string, string[]][] = [
  ["In cucina", ["Modalità cucina su tablet e telefono, con pulsanti grandi", "Ricetta, metodo e allergeni a un tocco dalla comanda", "Registri HACCP compilati in pochi secondi"]],
  ["Chi gestisce il locale", ["GP teorico e reale, settimana per settimana", "Sprechi, costo del personale e prime cost", "Turni con il costo di ogni giornata"]],
  ["Head office", ["Più sedi, con ruoli e permessi per ognuno", "Libreria ricette condivisa, menu e prezzi per sede", "Confronto tra le sedi e registro delle attività"]]
];

/** Switches the language of the account pages and of the app on this device. */
function chooseLanguage(language: "it" | "en") {
  storeLanguage(language);
  window.location.reload();
}

/**
 * The public front of the app: what it does, shown with the things a kitchen actually handles (an
 * order ticket, a prep label, a dish cost), with sign in close at hand for the people who already
 * work with it. `signIn` is the sign-in card.
 */
export function Landing({ signIn }: { signIn: ReactNode }) {
  const t = useWords();
  return (
    <div className="landing">
      <a className="skip-link" href="#accedi">{t("Vai all'accesso")}</a>
      <header className="landing-head">
        <a className="landing-brand" href="/login" aria-label="Recipe Studio">
          <span className="landing-mark" aria-hidden="true"><BrandIcon /></span>
          <span>Recipe Studio</span>
        </a>
        <nav className="landing-nav" aria-label={t("Pagina")}>
          <span className="landing-lang">
            <button type="button" onClick={() => chooseLanguage("it")} lang="it">Italiano</button>
            <button type="button" onClick={() => chooseLanguage("en")} lang="en">English</button>
          </span>
          <a className="landing-link" href="#accedi">{t("Accedi")}</a>
          <a className="landing-cta" href="/registrati">{t("Crea la tua compagnia")}</a>
        </nav>
      </header>

      <main>
        <section className="landing-hero" aria-labelledby="landingTitle">
          <div className="landing-pitch">
            <h1 id="landingTitle">{t("Dal fornitore al pass, tutta la cucina in un posto solo.")}</h1>
            <p className="landing-lead">{t("Ricette con il costo vero, allergeni presi dalle etichette, registri HACCP, magazzino, turni e comande della cassa. Per un locale o per un gruppo con più sedi.")}</p>
            <p className="landing-actions">
              <a className="landing-cta big" href="/registrati">{t("Crea la tua compagnia")}</a>
              <a className="landing-link big" href="#giornata">{t("Vedi come funziona")}</a>
            </p>
          </div>

          <div className="landing-signin" id="accedi">{signIn}</div>

          {/* The kitchen's own paperwork, drawn: an order from the till and the label on a tub of sauce. */}
          <div className="landing-props" aria-hidden="true">
            <div className="ticket">
              <div className="ticket-head"><strong>{t("Tavolo {0}").replace("{0}", "12")}</strong><span>19:02</span></div>
              <div className="ticket-sub">{t("{0} coperti").replace("{0}", "4")}</div>
              <div className="ticket-allergy"><span>{t("ALLERGIE")}</span>{t("Glutine")}</div>
              <ul>
                <li><b>2×</b> Margherita<small>{t("Senza basilico")}</small></li>
                <li><b>1×</b> Tagliata<small>{t("Cottura media")}</small></li>
                <li className="held"><b>2×</b> Tiramisù<small>{t("Dolci in attesa")}</small></li>
              </ul>
            </div>
            <div className="prep-label">
              <strong>Ragù</strong>
              <span>{t("Preparato il")} 25/11</span>
              <span className="prep-use">{t("Usa entro")} 28/11</span>
              <span className="prep-allergens">{t("Sedano")}, {t("Latte")}</span>
            </div>
          </div>
        </section>

        <section className="landing-day" id="giornata" aria-labelledby="dayTitle">
          <h2 id="dayTitle">{t("Una giornata in cucina")}</h2>
          <ol>
            {DAY.map(([time, title, text]) => (
              <li key={time}>
                <time>{time}</time>
                <h3>{t(title)}</h3>
                <p>{t(text)}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="landing-cost" aria-labelledby="costTitle">
          <div className="landing-cost-text">
            <h2 id="costTitle">{t("Il costo vero di ogni piatto, sempre aggiornato.")}</h2>
            <p>{t("Gli ingredienti arrivano dal magazzino con il prezzo dell'ultima fattura. Quando un fornitore aumenta un prezzo, l'app ti dice quali piatti scendono sotto il margine che vuoi.")}</p>
          </div>
          <figure className="cost-sheet" aria-label={t("Esempio: il costo della Margherita")}>
            <figcaption>Margherita</figcaption>
            <dl>
              <div><dt>{t("Costo per porzione")}</dt><dd>£2.41</dd></div>
              <div><dt>{t("Prezzo")}</dt><dd>£11.00</dd></div>
              <div className="cost-gp"><dt>GP</dt><dd>73%</dd></div>
            </dl>
            <p className="cost-alert">{t("La mozzarella costa il 12% in più: 4 piatti da ricontrollare.")}</p>
          </figure>
        </section>

        <section className="landing-roles" aria-labelledby="rolesTitle">
          <h2 id="rolesTitle">{t("Ognuno vede quello che gli serve")}</h2>
          <div className="roles-grid">
            {ROLES.map(([role, points]) => (
              <div key={role} className="role">
                <h3>{t(role)}</h3>
                <ul>{points.map((point) => <li key={point}>{t(point)}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-inspect" aria-labelledby="inspectTitle">
          <h2 id="inspectTitle">{t("Pronto quando arriva l'ispettore")}</h2>
          <ul>
            <li><strong>{t("Allergeni")}</strong>{t("presi dalle etichette dei prodotti, confermati con nome e data, con la matrice dei 14 allergeni da stampare.")}</li>
            <li><strong>{t("Registri HACCP")}</strong>{t("temperature, cotture, abbattimenti, consegne e checklist, con le foto e le azioni correttive; nessuna registrazione si perde davvero.")}</li>
            <li><strong>{t("Tutto esportabile")}</strong>{t("registro stampabile per periodo e copia completa dei dati quando vuoi.")}</li>
          </ul>
        </section>

        <section className="landing-facts" aria-label={t("In breve")}>
          <ul>
            <li>{t("Computer, tablet e telefono")}</li>
            <li>{t("Dati separati per ogni compagnia")}</li>
            <li>{t("Collegabile a qualsiasi cassa con webhook")}</li>
            <li>{t("In italiano e in inglese")}</li>
          </ul>
        </section>

        <section className="landing-final" aria-labelledby="finalTitle">
          <h2 id="finalTitle">{t("Provala con la tua cucina.")}</h2>
          <p>{t("Due minuti: il tuo account, la compagnia e la prima sede. Il personale lo inviti dopo.")}</p>
          <a className="landing-cta big" href="/registrati">{t("Crea la tua compagnia")}</a>
        </section>
      </main>

      <footer className="landing-foot">
        <span>© 2026 Recipe Studio</span>
        <a href="#accedi">{t("Accedi")}</a>
      </footer>
    </div>
  );
}
