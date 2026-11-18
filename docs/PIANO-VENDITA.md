# Piano: vendere Recipe Studio a più ristoranti

Stato: **piano, non ancora iniziato** (18/11/2026). Descrive come passare dall'app di oggi, una cucina con una password condivisa, a un servizio in abbonamento con una sola installazione, registrazione e dati separati per ogni cliente.

La struttura di compagnie, sedi, ruoli e permessi è già descritta in [MULTI-AZIENDA.md](MULTI-AZIENDA.md). Questo piano non la ripete: dice in che ordine costruirla per poterla vendere, cosa serve oltre al codice e cosa rimandare.

## In breve

1. **Subito, senza codice:** sistemare i piani dei servizi e i documenti legali (fase 0).
2. **Primi 2–3 clienti:** un'installazione ciascuno, che l'app permette già oggi (fase 1).
3. **Prima di arrivare a circa 5 clienti:** una sola installazione con account e dati separati (fasi 2–4).
4. **Dopo:** più sedi per cliente, pagine head office e ruoli completi, come in MULTI-AZIENDA.md (fase 6).

## Fase 0 · Prerequisiti, prima di incassare

| Cosa | Perché | Costo indicativo |
| --- | --- | --- |
| **Vercel Pro** | Il piano Hobby vieta l'uso commerciale | circa $20 al mese |
| **Fatturazione su Google AI Studio** | Sul piano gratuito Google può usare i contenuti inviati (fatture dei clienti) per migliorare i suoi prodotti; la quota gratuita finisce dopo poche letture | pochi pence al mese per cucina |
| **Neon a pagamento** | Ripristino a una data precisa (backup) e più dei 0,5 GB gratuiti, che le foto delle temperature riempiono presto | da circa $19 al mese |
| **Dominio e nome commerciale** | Indirizzo stabile, email di sistema dal proprio dominio | circa £10 l'anno |
| **Registrazione ICO** (UK) | Obbligatoria per chi tratta dati personali per conto di aziende | circa £50 l'anno |
| **Documenti legali** | Privacy policy, termini di servizio, accordo sul trattamento dei dati (DPA) con ogni cliente. Nei dati ci sono nomi, paghe e turni del personale | una tantum, meglio con un consulente |

## Fase 1 · Clienti pilota, un'installazione ciascuno

L'app di oggi è già un'istanza autonoma per cucina: basta ripeterla.

**Per ogni cliente:**
1. Un nuovo progetto Neon (database vuoto: l'app crea le tabelle da sola).
2. Un nuovo progetto Vercel collegato **allo stesso repository**.
3. Le variabili `DATABASE_URL`, `APP_PASSWORD` e `GEMINI_API_KEY`.
4. Un sottodominio, per esempio `nometavola.recipestudio.co.uk`.

Ogni progetto Vercel collegato al repository si ripubblica a ogni push su `main`. Gli aggiornamenti arrivano quindi a tutti i clienti insieme, senza lavoro in più.

**Limiti, per cui questa fase non deve durare:**
- Ogni cliente ha una sola password per tutto lo staff: non si sa chi ha fatto cosa, a parte la firma nei registri.
- Nuovi clienti e abbonamenti sono a mano.
- Costi e configurazioni crescono con ogni cliente.

**Da preparare già ora:** l'esportazione dell'archivio deve includere le foto, così i dati dei pilota si potranno spostare nell'installazione unica (fase 2).

## Fase 2 · Un'installazione unica con dati separati

È la fase più grande. Si fa con un backup completo e una prova su una copia dei dati.

### 2.1 Dati: aggiungere il proprietario alle tabelle di oggi

MULTI-AZIENDA.md propone di riscrivere tutto in tabelle relazionali. **Per vendere non serve subito.** Basta aggiungere il proprietario alle tabelle attuali, quelle con id e contenuto JSON, che è molto meno lavoro e meno rischioso:

- Ogni tabella `recipe_studio_*` riceve `company_id`; i dati operativi (stock, consegne, prep list, turni, sicurezza alimentare, sprechi, vendite, menu) ricevono anche `site_id`.
- La chiave primaria diventa la coppia (proprietario, `id`).
- Le impostazioni, oggi una riga unica (`id = 1`), diventano una riga per compagnia e una per sede.
- Anche le foto (`recipe_studio_photos`) ricevono il proprietario.
- **Isolamento su due livelli:**
  - il codice filtra sempre per proprietario;
  - Postgres applica il row-level security, impostando la sede a ogni transazione.

  Un errore nel codice non deve mai mostrare i dati di un altro cliente.
- Le tabelle relazionali vere si fanno più avanti, solo dove servono: per esempio per i report tra sedi della fase 6.

Nel codice tutto passa già da un unico punto, l'interfaccia `Store` (`src/lib/server/store/types.ts`):
- `getStore()` diventa `getStore(contesto)`, legata a compagnia e sede;
- nessuna API può leggere senza contesto;
- il file JSON locale resta solo per lo sviluppo, con un'unica cucina.

**Migrazione:** i dati di oggi diventano la prima compagnia e la prima sede. Ogni pilota si importa nella sua compagnia dal suo archivio esportato.

### 2.2 Account e accesso

- **Better Auth**, come proposto in MULTI-AZIENDA.md: gira dentro l'app, salva gli utenti nello stesso Postgres e ha già organizzazioni, inviti e ruoli.
- Email e password, con verifica dell'email e recupero della password. Serve un servizio di invio email, per esempio Resend, che ha un piano gratuito.
- Il login sostituisce `APP_PASSWORD`: `src/proxy.ts` controlla la sessione invece del cookie della password.
- **Tre ruoli per iniziare:**

  | Ruolo | Cosa può fare |
  | --- | --- |
  | Titolare | Tutto, compresi abbonamento e utenti |
  | Chef / manager | Tutto tranne abbonamento e utenti |
  | Staff | Solo la modalità cucina |

  Gli otto ruoli di MULTI-AZIENDA.md arrivano dopo, sopra lo stesso modulo dei permessi.

- **Tablet di cucina:** il titolare collega un dispositivo alla sede e quel dispositivo resta in modalità cucina. Chi lavora sceglie il proprio nome, con un PIN facoltativo, e la firma dei registri resta come oggi. Nessuno deve fare login con email in cucina.

### 2.3 API e interfaccia

- `handle()` (`src/lib/server/http.ts`) ricava dalla sessione utente, compagnia, sede e ruolo, e li passa a tutte le 24 API.
- Ogni scrittura controlla il permesso sul server; l'interfaccia nasconde solo i pulsanti non permessi.
- Le foto (`/api/photos/[id]`) controllano il proprietario prima di essere servite. La cache del browser è già privata e può restare così.
- Le chiavi salvate nel browser (`recipe-studio:kitchen`, `recipe-studio:kitchen-by`…) includono la sede, così un tablet passato a un'altra sede non si confonde.

### 2.4 Test di isolamento

Prima di aprire le registrazioni serve un test automatico per ogni API: un utente della compagnia A prova a leggere, modificare e cancellare dati della compagnia B, e deve sempre ricevere un rifiuto.

## Fase 3 · Registrazione e primi passi

- **Pagina di registrazione:** crea utente, compagnia e prima sede in un passaggio.
- **Primi passi guidati:**
  - fornitori e prodotti, con l'importazione da Excel che esiste già;
  - prime ricette e un menu;
  - apparecchi da controllare per la sicurezza alimentare.
- **Dati di esempio** facoltativi, cancellabili con un clic.
- **Inviti:** il titolare invita lo staff per email e sceglie il ruolo.
- **Sito pubblico** con prezzi, funzioni e link a privacy e termini.

## Fase 4 · Abbonamenti

- **Stripe:** pagamento dalla pagina di Stripe (Checkout) e gestione dal portale clienti (carta, fatture, disdetta). Lo stato dell'abbonamento arriva all'app dai webhook di Stripe.
- **Prezzo per sede al mese**, con prova gratuita (per esempio 14 o 30 giorni).
- **A fine abbonamento l'app va in sola lettura, mai bloccata del tutto.** I registri di sicurezza alimentare vanno conservati e mostrati agli ispettori: si devono sempre poter vedere ed esportare.
- **Limite di scansioni fatture per sede**, per esempio 200 al mese, così il costo Gemini resta prevedibile; se un cliente lo supera, scrive a mano o passa a un piano superiore.

## Fase 5 · Gestione del servizio

- **Errori:** un servizio di segnalazione (per esempio Sentry, piano gratuito) per sapere dei problemi prima dei clienti.
- **Backup:** il ripristino a una data precisa di Neon, più un'esportazione settimanale fuori da Neon.
- **Dati del cliente:**
  - esportazione completa, foto comprese;
  - cancellazione definitiva della compagnia su richiesta, dovuta per il GDPR.
- **Assistenza:** un indirizzo email dedicato. Una pagina di amministrazione solo per te, con elenco dei clienti, stato dell'abbonamento e scansioni usate; mai i loro dati operativi senza permesso.
- **Limiti di frequenza** su login e scansioni, contro abusi e costi imprevisti.

## Fase 6 · Dopo il lancio

Seguono i punti 3–6 dell'ordine di lavoro di MULTI-AZIENDA.md:
- più sedi per cliente con il selettore di sede;
- libreria ricette condivisa a livello di compagnia;
- pagine head office e area manager;
- gli otto ruoli e i ruoli personalizzati;
- il registro delle attività.

## Rischi principali

| Rischio | Come si evita |
| --- | --- |
| Dati di un cliente visibili a un altro | Filtro nel codice, row-level security in Postgres e test di isolamento su ogni API (2.1, 2.4) |
| Migrazione che rovina i dati di oggi | Backup completo, prova su una copia, confronto dei conteggi prima e dopo |
| Costi AI fuori controllo | Fatturazione attiva con avviso di spesa su Google e limite di scansioni per sede |
| Database pieno di foto | Piano Neon a pagamento; più avanti, foto in uno storage di file separato (per esempio Vercel Blob) |
| Cliente che perde i registri HACCP a fine abbonamento | Sola lettura ed esportazione sempre disponibili |

## Da decidere

- **Prezzo:** quanto per sede al mese, e se le scansioni fatture sono incluse o un extra.
- **Nome e dominio** del servizio.
- **Prova gratuita:** 14 o 30 giorni, con o senza carta.
- **Tablet di cucina:** PIN personale obbligatorio o solo scelta del nome.
- **Clienti pilota:** quali, e a che prezzo, in cambio del loro riscontro.
- **Login:** Better Auth (consigliato) o Clerk; vedi MULTI-AZIENDA.md.
