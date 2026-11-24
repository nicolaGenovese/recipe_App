# Recipe Studio (Next.js)

Gestione di ricette, costi, Food Stock, turni, sicurezza alimentare e GP per una o più cucine, con Next.js e TypeScript. Con il database ogni persona ha il suo account e più compagnie, ognuna con più sedi, usano la stessa installazione con i dati separati.

## Documenti

| Documento | Contenuto |
| --- | --- |
| [docs/FUNZIONI.md](docs/FUNZIONI.md) | Cosa fa l'app oggi, cosa resta da fare, dati da inserire e limiti noti |
| [docs/ARCHITETTURA.md](docs/ARCHITETTURA.md) | Come è organizzato il codice e come aggiungere una funzione |
| [docs/API.md](docs/API.md) | API, permessi richiesti e formato dei dati |
| [docs/CALCOLI.md](docs/CALCOLI.md) | Regole di calcolo: costi, allergeni, Food Stock, GP |
| [docs/schema-database.pdf](docs/schema-database.pdf) | Struttura del database da stampare (A4 orizzontale) |
| [docs/neondb - public.png](docs/neondb%20-%20public.png) | Diagramma del database generato da DBeaver |
| [docs/MULTI-AZIENDA.md](docs/MULTI-AZIENDA.md) | Compagnie, sedi, account, ruoli e permessi: proposta e cosa è stato fatto |
| [docs/PIANO-VENDITA.md](docs/PIANO-VENDITA.md) | Piano per vendere l'app ad altri ristoranti |
| [docs/CASSA-E-COMANDE.md](docs/CASSA-E-COMANDE.md) | Proposta: collegamento alla cassa e comande in cucina |
| [docs/AVVISI.md](docs/AVVISI.md) | Proposta: più avvisi nel campanello |
| [docs/esempi/README.md](docs/esempi/README.md) | Esempio completo da importare: una Margherita in tutte le pagine |

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

| Configurazione | Archivio | Accesso |
| --- | --- | --- |
| Nessuna variabile | `data/recipes.json`, creato vuoto al primo salvataggio | Una sola cucina, aperta (o con `APP_PASSWORD`) |
| `DATA_FILE=percorso/file.json` | Il file indicato; un percorso relativo parte dalla cartella del progetto | Come sopra |
| `DATABASE_URL=postgresql://…` | Neon Postgres: tabelle e migrazioni si creano da sole al primo avvio | Account con email e password, compagnie, sedi e ruoli |

Le variabili vanno in `.env.local`, che non viene salvato nel controllo versione. Parti da [.env.example](.env.example). I file in `data/` sono esclusi dal controllo versione.

### Neon

1. In Neon Console apri il progetto e scegli **Connect** per copiare la stringa di connessione.
2. Mettila in `.env.local` come `DATABASE_URL=…`.
3. Riavvia l'app e apri `/login`:
   - con un database nuovo si crea la prima compagnia con «Crea una nuova compagnia»;
   - con dati della versione a cucina singola compare «Primo accesso»: il primo account li prende con la vecchia `APP_PASSWORD` e ne diventa proprietario.

La password del database resta sul server: il browser parla solo con le API dell'app. Per portare i dati dal file locale a Neon, esporta il JSON dall'app (icona di download in alto) prima di cambiare archivio, e dopo il primo accesso reimportalo con **Importa** nella sede scelta.

## Online: Vercel e Neon

L'app online gira su Vercel (<https://recipe-app-delta-ten.vercel.app>, progetto `recipe-app`) con il database Neon `recipe-studio-db` (regione London).

- **Aggiornamenti:** ogni `git push` sul ramo `main` di GitHub (`nicolaGenovese/recipe_App`) pubblica una nuova versione su Vercel. Gli altri rami creano un'anteprima con un indirizzo a parte. Le versioni vecchie restano raggiungibili al loro indirizzo, protette dall'accesso Vercel.
- **Variabili su Vercel** (Project → Settings → Environment Variables):
  - `DATABASE_URL`: impostata dall'integrazione Neon (Project → Storage).
  - `BETTER_AUTH_SECRET` (consigliata): una stringa casuale lunga che firma le sessioni. Senza, ne viene ricavata una da `DATABASE_URL`. Cambiarla scollega tutti.
  - `APP_PASSWORD`: con il database serve solo al primo accesso, per prendere i dati della versione a cucina singola.
  - `GEMINI_API_KEY` (facoltativa): attiva la scansione delle fatture. Si crea su [Google AI Studio](https://aistudio.google.com). `GEMINI_MODEL` forza un modello; `INVOICE_READER` sceglie il servizio (`gemini`, oppure `demo` per provare in locale una fattura di esempio). Per un altro servizio basta aggiungere un lettore in `src/lib/server/invoices/readers.ts`.
- **Database:** tabelle, migrazioni e row-level security si creano da sole alla prima visita dopo un aggiornamento. Prima di un aggiornamento che cambia i dati conviene un branch di backup in Neon.

## Comandi

| Comando | Cosa fa |
| --- | --- |
| `npm run dev` | Server di sviluppo su <http://localhost:3000>, si aggiorna a ogni modifica. |
| `npm run build` | Build di produzione, con controllo dei tipi. |
| `npm start` | Avvia la build di produzione sulla porta 3000. |
| `npm test` | Test di calcoli, permessi e regole (Vitest). |
| `npm run lint` | Controllo dei tipi TypeScript senza build. |

## Funzioni in breve

L'elenco completo è in [docs/FUNZIONI.md](docs/FUNZIONI.md).

- **Ricette e basi**, con costi dal magazzino, allergeni e tracce che arrivano solo dai prodotti, conferma degli allergeni con nome e data.
- **Menu** per sede, con giorni e orari di disponibilità, matrice allergeni e stampe.
- **Prep list** generate dai piatti, con etichette di preparazione e scadenza.
- **Food Stock**: report, consegne con scansione AI delle fatture, inventario con giacenza per sede.
- **Turni** con costo del personale, anche per chi lavora in più sedi.
- **Sicurezza alimentare**: temperature con foto, cotture, abbattimenti, consegne, checklist, registro stampabile.
- **Andamento**: vendite, GP teorico e reale, sprechi, personale, analisi del menu, confronto tra sedi.
- **Modalità cucina** per tablet e telefono, con pulsanti grandi.
- **Compagnie, sedi, account, ruoli e permessi**, inviti con link e registro delle attività.

## Sicurezza

- **Con il database:** ognuno entra con il proprio account (Better Auth, sessione di 30 giorni). Ogni API controlla la sessione e il permesso del ruolo nella sede scelta, e quello che un ruolo non può vedere (prezzi, paghe, turni degli altri) non lascia il server.
- **Separazione tra compagnie su due livelli:** il codice filtra ogni lettura, e Postgres applica la row-level security con il ruolo limitato `rs_tenant`, quindi un errore nel codice non mostra i dati di un'altra compagnia.
- **Senza database:** una sola cucina, aperta sul proprio computer oppure protetta dalla password condivisa `APP_PASSWORD`.
- **Segreti:** chiavi e password stanno solo nelle variabili d'ambiente, mai nel repository, che è pubblico.
