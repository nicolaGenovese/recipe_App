# Recipe Studio (Next.js)

Gestione di ricette, costi, Food Stock e GP per la cucina, con Next.js e TypeScript. Il 10/11/2026 ha sostituito la prima versione (un server Node con un'unica pagina JavaScript): stesse funzioni e stessi dati, ma il codice è diviso in moduli.

- Come è organizzato il codice e come aggiungere una funzione: [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md)
- API e formato dei dati: [docs/API.md](docs/API.md)
- Regole di calcolo (costi, Food Stock, GP): [docs/CALCOLI.md](docs/CALCOLI.md)
- Funzioni fatte, da fare e limiti noti: [docs/FUNZIONI.md](docs/FUNZIONI.md)
- Proposta per più compagnie, sedi, account e permessi: [docs/MULTI-AZIENDA.md](docs/MULTI-AZIENDA.md)

## Avvio rapido

Richiede Node.js 20.9 o successivo.

```bash
npm install
npm run dev
```

Apri <http://localhost:3000>.

Per l'uso quotidiano conviene la versione di produzione, più veloce:

```bash
npm run build
npm start
```

## Dove finiscono i dati

| Configurazione | Archivio |
| --- | --- |
| Nessuna variabile | `data/recipes.json` (creato al primo salvataggio, con ricette di esempio) |
| `DATA_FILE=percorso/file.json` | Il file indicato. Un percorso relativo parte dalla cartella del progetto. |
| `DATABASE_URL=postgresql://…` | Neon Postgres. Le tabelle vengono create al primo avvio. |

Le variabili vanno in `.env.local` (non viene salvato nel controllo versione). Parti da [.env.example](.env.example).

`data/recipes.json` contiene l'archivio portato dalla prima versione; in `data/backups/` ci sono le copie fatte prima delle importazioni del 10/11/2026. I file in `data/` sono esclusi dal controllo versione, quindi fai backup con l'esportazione JSON dell'app.

### Neon

1. In Neon Console apri il progetto e scegli **Connect** per copiare la stringa di connessione.
2. Mettila in `.env.local` come `DATABASE_URL=…`.
3. Riavvia l'app. La barra laterale mostra "Neon Postgres" quando la connessione funziona.

La password resta sul server: il browser parla solo con le API dell'app. Per portare i dati dal file locale a Neon, esporta il JSON dall'app (icona di download in alto) prima di cambiare archivio e reimportalo dopo con **Importa**.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Server di sviluppo su <http://localhost:3000>, si aggiorna a ogni modifica. |
| `npm run build` | Build di produzione, con controllo dei tipi. |
| `npm start` | Avvia la build di produzione sulla porta 3000. |
| `npm test` | Test dei calcoli (Vitest). |
| `npm run lint` | Controllo dei tipi TypeScript senza build. |

## Funzioni

- **Ricette**: catalogo con ricerca su nomi, descrizioni, ingredienti, fornitori e allergeni; categorie, ordinamento, pagine, vista a schede o elenco. Creazione, modifica, duplicazione ed eliminazione; basi/preparazioni.
- **Menu**: più menu nella stessa cucina (per esempio menu principale, pizze, Sunday roast). Ogni menu ha nome, descrizione, stato attivo o sospeso e i suoi piatti in ordine; lo stesso piatto può stare in più menu. Per ogni menu: numero di piatti, costo e prezzo medi, food cost e margine medio. Ogni menu attivo ha una scorciatoia nella barra laterale che mostra i suoi piatti.
- **Prep list**: per una data e uno o più menu. "Genera dai piatti" crea le preparazioni dalle basi e dalle righe MEP dei piatti, con le quantità scalate sulle porzioni previste; ogni preparazione indica i piatti a cui serve. Righe a mano, quantità da fare (serve − pronto), note, spunta fatto anche dalla pagina, duplicazione e stampa.
- **Andamento**: per ogni settimana vendite nette, GP teorico (dalle ricette) e GP reale (dal report stock), sprechi e costo del personale in valore e in percentuale, prime cost. Vendite inserite a mano o importate da un CSV della cassa; registro degli sprechi con motivo e costo; analisi del menu che indica quali piatti vendono e quali rendono. Personale, ruoli e paga oraria in Impostazioni → Personale, con il costo del personale per persona e per giorno nei Turni; porzioni della prep list suggerite dalle vendite.
- **Sicurezza alimentare**: temperature di frigoriferi e congelatori (mattina e sera), cottura, abbattimento, rigenerazione e mantenimento a caldo collegati alla ricetta, controllo della merce in arrivo agganciato alle consegne, checklist di apertura, chiusura e pulizie firmate dal personale dei Turni. Avviso di quello che manca oggi, azione correttiva obbligatoria quando un controllo è fuori limite, registro stampabile per periodo. Etichette con data di preparazione e scadenza stampate dalla prep list.
- **Turni del personale**: settimana corrente più le tre successive, con le settimane passate in sola lettura. Un turno per persona e giorno (`09:00-17:00`, anche oltre la mezzanotte o spezzato con la virgola), riposo e ferie, ore per persona, per giorno e totali. Salvataggio automatico, copia e incolla di una settimana, svuota, PDF, Excel e stampa.
- **Scheda ricetta**: ingredienti (prodotto, base o esterno) con fornitore, quantità, unità, costo, allergeni e kcal; foto, metodo, MEP, impiattamento, note nutrizionali, controlli di sicurezza e attrezzature.
- **Costi**: costo totale e per porzione, margine teorico, prezzo suggerito. Gli ingredienti collegati a un prodotto seguono il suo prezzo.
- **Stampe ed esportazione**: per un menu o per tutti i menu attivi: ricette, allergeni, matrice allergeni, schede cucina e prezzi; CSV delle ricette; backup e importazione JSON di tutto l'archivio.
- **Food Stock → Report**: report per periodo con apertura, fatture, consegnato, chiusura e valore per prodotto, totali per fornitore e GP. Bozza modificabile, invio, riapertura dell'ultimo report.
- **Food Stock → Consegne**: ogni fattura con numero, data, fornitore e righe. Le quantità si sommano al report del periodo e alla giacenza; il prezzo del prodotto si aggiorna con quello della fattura più recente.
- **Food Stock → Inventario**: codice, livello minimo, giacenza, da riordinare, stato, costo e valore; colonne ordinabili; livello minimo e giacenza si modificano in tabella.
- **Ricetta dal magazzino**: scegli prodotti e quantità, vedi costo e porzioni producibili, poi apri l'editor già compilato.
- **Impostazioni**: valuta, lingua (italiano o inglese), regole del calcolo GP e liste personalizzabili (categorie, tecniche, allergeni, controlli, preparazione).

## Sicurezza

L'app non ha ancora utenti né login: chiunque raggiunga il server può modificare tutto. Usala sul tuo computer o in una rete fidata. Prima di metterla online va aggiunto l'accesso con utenti e ruoli.
