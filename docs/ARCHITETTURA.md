# Architettura

Il codice segue una regola semplice: **i calcoli non sanno nulla di React, React non sa nulla del database**. Ogni livello dipende solo da quelli sotto.

```
src/
├── app/                  Pagine e API di Next.js (solo collegamenti, niente logica)
│                         page.tsx (l'app), login/, registrati/, invito/[token]/, benvenuto/, api/
├── proxy.ts              Rimanda all'accesso chi non ha la sessione (o la password in locale)
├── components/           Interfaccia React, un componente per file
├── state/                Stato del browser e azioni (salva, elimina, genera…)
├── lib/                  Logica pura: tipi, calcoli, formati, traduzioni, permessi
│   └── server/           Solo lato server: archivio, account, compagnie, validazione, risposte HTTP
└── styles/               CSS diviso per area
```

## Come scorrono i dati

1. **Prima apertura.** `app/page.tsx` gira sul server: ricava chi è entrato e in quale sede (`resolveContext`), legge l'archivio della sede, toglie quello che il ruolo non può vedere (`redactState`) e passa tutto ad `AppProvider`. La pagina arriva già con i dati, senza schermata di caricamento. Senza sessione rimanda a `/login`, con un account senza compagnia a `/benvenuto`.
2. **Nel browser.** `state/AppProvider.tsx` tiene i dati in memoria e li mette a disposizione di ogni componente con `useApp()`, insieme a lingua (`t`), formati (`f`: valuta, quantità, date), regole GP, filtri della vista, finestra aperta, avvisi, chi è entrato (`access`), i permessi (`can("menus.edit")`) e il cambio di sede (`switchSite`).
3. **Una modifica.** Un componente chiama un'azione, per esempio `useStockActions().saveDelivery(…)`. L'azione chiama l'API (`state/api.ts`), aggiorna i dati in memoria con `update(…)` e mostra l'avviso.
4. **Sul server.** La route in `app/api/…` chiede il contesto (`lib/server/auth/context.ts`: chi è, in quale compagnia e sede, con quali permessi), legge il JSON, lo valida (`lib/server/validation.ts`), controlla il permesso e lo passa all'archivio della sede (`lib/server/store`), che è il file JSON locale oppure Neon.

5. **Dalla cassa.** Un avviso arriva a `app/api/pos/[token]` senza account: la route trova la sede dal token, controlla la firma se c'è e passa il corpo a `lib/server/pos/receive.ts`, che lo legge con `lib/orders/pos.ts`, aggiorna la comanda (`lib/orders/orders.ts`) e salva vendite e rimborsi. Gli schermi lo vedono al controllo successivo (`state/useOrdersFeed.ts`, ogni 3 secondi), le vendite alla prossima lettura dell'archivio.

`current()` restituisce sempre i dati più recenti, anche dentro un'azione lunga che fa più salvataggi di fila: usalo al posto di `data` nelle azioni.

## Cartelle in dettaglio

### `lib/` — logica pura

Funzioni senza effetti collaterali: dati in ingresso, risultato in uscita. Si testano da sole con `npm test`.

| File | Contenuto |
| --- | --- |
| `types.ts` | Forma di ricette, prodotti, report, consegne e impostazioni. Combacia con il JSON salvato, quindi i vecchi archivi si leggono senza conversioni. |
| `num.ts` | Numeri sicuri (`num`), arrotondamenti, date `YYYY-MM-DD`, `upsert`. |
| `format.ts` | Valute disponibili e formattatori legati a lingua e valuta. |
| `settings.ts` | Completa le impostazioni mancanti negli archivi vecchi. |
| `seed.ts` | Impostazioni predefinite e dati di esempio per un archivio vuoto. |
| `i18n/` | `en.ts` contiene i testi inglesi; la chiave è il testo italiano. `index.ts` crea la funzione `t`. |
| `recipes/math.ts` | Costo, costo per porzione, allergeni e tracce, kcal, margine, prezzo suggerito, righe senza costo. |
| `recipes/allergens.ts` | Allergeni del piatto: da quali ingredienti arrivano, tracce ereditate e aggiunte, stato (confermato, da ricontrollare, da verificare), conferma, colonne della matrice. |
| `recipes/form.ts` | Conversione ricetta ↔ modulo dell'editor (i numeri restano testo mentre si scrive). |
| `recipes/catalog.ts` | Catalogo ingredienti: una riga di ricetta prende nome, fornitore, costo, allergeni, tracce e kcal dal prodotto o dalla ricetta base collegata; ricette da sincronizzare; ricette che usano un prodotto; prodotti con allergeni da controllare. |
| `recipes/filter.ts` | Filtri e ordinamento della libreria, compreso il filtro per menu. |
| `menus/menus.ts` | Piatti in menu, piatti di più menu, numeri del menu (costo medio, food cost, margine), assegnazione di un piatto ai menu, passaggio dal vecchio "menu attuale". |
| `menus/availability.ts` | Giorni e fasce orarie di un menu, anche oltre la mezzanotte; "disponibile ora". |
| `access/permissions.ts` | Permessi, ruoli predefiniti, permessi impliciti, livello dei ruoli, `AccessInfo` mandato al browser. |
| `access/redact.ts` | Toglie dall'archivio prezzi, paghe e turni che il ruolo non può vedere; tiene le paghe salvate quando le salva chi non le vede. |
| `invoices/` | Scansione fatture: forma del risultato (`scan.ts`), abbinamento a fornitori e prodotti (`match.ts`), foto ridotte prima dell'invio (`upload.ts`). |
| `kitchen/today.ts` | Modalità cucina: prep list di oggi, giro temperature, checklist, consegne senza controllo, apertura predefinita sui touch. |
| `orders/pos.ts` | Lettore degli avvisi della cassa, per qualsiasi marca: trova ordine e righe per forma e per i nomi comuni dei campi, capisce il tipo di avviso dalle parole della cassa, id dell'avviso per i doppioni. |
| `orders/orders.ts` | Cosa fa un avviso a una comanda (righe nuove, tolte, cambiate, portate «via», storni), partite di una riga, abbinamento piatto della cassa → ricetta, righe pronte, vendite e rimborsi da uno scontrino, comanda di prova. |
| `orders/sales.ts` | Settimane di vendite dagli scontrini della cassa, per piatto e per giorno, al posto delle settimane scritte a mano. |
| `orders/types.ts` | Forme di avvisi, comande, partite, impostazioni degli schermi e collegamento della cassa. |
| `safety/photos.ts` | Foto dei registri: quali usa un record, quali togliere, quali mancano. |
| `performance/compare.ts` | Confronto tra sedi delle ultime 4 settimane. |
| `images.ts`, `pages.ts` | Foto ridotte nel browser; numeri di pagina con i puntini. |
| `performance/waste.ts` | Costo di uno spreco (dal prodotto o dalla ricetta), totali per motivo e per voce. |
| `performance/sales.ts` | Incasso netto e costo teorico delle vendite, GP teorico, analisi del menu (star, cavallo da tiro, enigma, cane), lettura del CSV della cassa, porzioni suggerite per la prep list. |
| `performance/labour.ts` | Costo del personale dai Turni: ore × paga oraria del Personale più gli oneri, per persona, per giorno e per settimana. |
| `staff.ts` | Elenco del personale: pulizia, id stabili, primo elenco ricavato dai nomi nei turni. |
| `performance/summary.ts` | Riepilogo di una settimana: vendite, GP teorico e reale (dal report stock che copre più giorni della settimana), sprechi, personale, prime cost. |
| `safety/rules.ts` | Sicurezza alimentare: letture fuori limite, cottura e abbattimento, consegne, checklist, cosa manca oggi, data di scadenza delle etichette. |
| `safety/staff.ts` | Nomi per firmare una registrazione: prima il personale dei Turni di quella settimana, poi tutti gli altri. |
| `rota/shifts.ts` | Turni: ore di una fascia (anche oltre la mezzanotte), turni spezzati, riposo e ferie, totali per persona, giorno e settimana. |
| `rota/weeks.ts` | Lunedì di una data, le 4 settimane pianificabili, storico, nomi copiati nella settimana nuova. |
| `rota/format.ts` | Date ed ore dei turni nella lingua scelta. |
| `rota/pdf.ts` | PDF A4 orizzontale della settimana, scritto a mano senza librerie. |
| `prep/prep.ts` | Prep list: righe generate dalle basi e dalle righe MEP dei piatti, unione con le righe esistenti, quanto resta da fare. |
| `stock/units.ts` | Conversione tra unità (g, kg, ml, l, tsp, tbsp) e costo per unità di ricetta. |
| `stock/report.ts` | Valori delle righe, totali per fornitore, riepilogo con GP. |
| `stock/deliveries.ts` | Totali delle consegne, consegne chiuse, applicazione delle consegne a un report. |
| `stock/inventory.ts` | Giacenza attuale, riga di inventario, codici ING, porzioni producibili. |
| `stock/draft.ts` | Creazione e aggiornamento della bozza di report, controllo del periodo. |
| `stock/sources.ts` | Prodotti più basi come "fonti" di stock; costi collegati alle ricette. |
| `stock/inventory-sort.ts` | Colonne e ordinamento dell'inventario. |
| `stock/gp-text.ts` | Formula GP ed etichette scritte in base alle regole. |

### `lib/server/` — solo server

| File | Contenuto |
| --- | --- |
| `store/types.ts` | Le interfacce `Store` e `ScopedStore`: ai dati si arriva solo con `store.scoped({ companyId, siteId })`. |
| `store/local-store.ts` | Archivio su file JSON, una sola cucina (ignora la sede). Le scritture passano da un file temporaneo e sono in coda, quindi due salvataggi veloci non si sovrascrivono. |
| `store/neon-store.ts` | Archivio su Neon Postgres. Ogni chiamata è una transazione con il ruolo limitato `rs_tenant` e la compagnia impostata, quindi la row-level security non lascia vedere altre compagnie. Ricette e prodotti per compagnia, il resto per sede; la giacenza dei prodotti e le impostazioni di sicurezza per sede. |
| `store/index.ts` | `getStore()`: Neon se c'è `DATABASE_URL`, altrimenti il file. |
| `store/neon-orders.ts`, `store/local-orders.ts` | Comande, avvisi, scontrini e collegamento della cassa (`store.scoped(...).orders`), su Neon o in `recipes.orders.json` accanto all'archivio locale. La parte della cassa si scrive solo se la versione non è cambiata nel frattempo; le spunte della cucina con aggiornamenti mirati, così due schermi non si annullano. |
| `pos/receive.ts` | Percorso di un avviso: registro (doppioni scartati), aggiornamento della comanda, vendita o rimborso. Lo usano il webhook e la comanda di prova. |
| `pos/signature.ts` | Firme HMAC degli avvisi: Standard Webhooks, stile Stripe, Square, firma semplice del corpo. |
| `schema.ts` | Tabelle, migrazione una tantum (i dati di prima diventano `company_first` / `site_first`) e row-level security, sotto un lock. |
| `db.ts` | Connessione Neon e id casuali. |
| `directory.ts` | Compagnie, aree, sedi, ruoli, incarichi e inviti (come proprietario del database, quindi ogni funzione controlla la compagnia da sé). `buildAccess` calcola sedi raggiungibili e permessi. |
| `auth/auth.ts` | Better Auth (email e password) sullo stesso database; crea le sue tabelle una volta. |
| `auth/context.ts` | `requireContext(request, ...permessi)`: sessione, compagnia, sede (cookie `rs_site`), permessi e archivio della sede. In locale tutto permesso. |
| `auth/errors.ts`, `auth/cookies.ts` | Messaggi degli errori di Better Auth; nomi del cookie di sessione (usati dal proxy). |
| `invoices/readers.ts` | Lettori delle fatture (Gemini, demo): scelta dei modelli, tempi e messaggi d'errore. |
| `guards.ts` | Regole sulle scritture: ricette della libreria o della sede, conteggi e spunte, correzioni HACCP, registro attività. |
| `validation.ts` | Controlli sui dati in arrivo ed `HttpError`. |
| `http.ts` | Risposte JSON, limite di 5 MB sul corpo, gestione degli errori; `handleOpen` per il webhook della cassa, che non ha account. |

La struttura del database (tabelle, colonne, collegamenti) è disegnata in [schema-database.pdf](schema-database.pdf), A4 orizzontale da stampare. Il PDF è del 25/11/2026 (schema 2, con la pagina delle tabelle della cassa): se le tabelle cambiano va rifatto. C'è anche il diagramma generato da DBeaver, [neondb - public.png](neondb%20-%20public.png), con i collegamenti dichiarati nel database; è precedente alle tabelle della cassa.

Permessi e ruoli predefiniti stanno in `lib/access/permissions.ts` (condiviso con il browser); `lib/access/redact.ts` toglie dai dati quello che un ruolo non può vedere.

`store/index.ts` importa `server-only`: se per sbaglio un componente del browser lo importa, la build si ferma invece di esporre il database.

### `state/` — stato del browser

| File | Contenuto |
| --- | --- |
| `AppProvider.tsx` | Contesto dell'app e hook `useApp()`, con `access`, `can`, `switchSite` e `logout`. |
| `useRights.ts` | Cosa può fare il ruolo con le ricette (creare, modificare, menu): i pulsanti che non può usare non compaiono. |
| `api.ts` | Chiamate alle API. |
| `useOrdersFeed.ts` | Comande della sede aggiornate ogni 3 secondi (solo quello che è cambiato), modifiche mostrate subito e poi confermate dal server, suono delle comande nuove e modificate. |
| `dialogs.ts` | Elenco delle finestre e dei dati che ricevono. |
| `view.ts` | Pagina e filtri attivi: libreria (con `menuId` per un solo menu), Menu, Prep list, Food Stock. |
| `actions/useRecipeActions.ts` | Salva, duplica, elimina, menu, basi, allineamento dei costi. |
| `actions/useStockActions.ts` | Report, prodotti, inventario, consegne. |
| `actions/useSettingsActions.ts` | Salvataggio delle impostazioni. |
| `actions/useArchiveActions.ts` | Esportazione JSON/CSV e importazione. |
| `actions/useGuard.ts` | Trasforma un errore in un avviso, così un pulsante non fallisce in silenzio. |

### `components/`

| Cartella | Contenuto |
| --- | --- |
| `shell/` | Pagina: barra laterale (con il selettore di sede `SitePicker`), barra in alto con il campanello (`StockAlerts`), intestazione, `DialogHost` che mostra la finestra aperta. |
| `company/` | Gestione della compagnia dentro Impostazioni: persone e inviti, sedi e aree, ruoli e permessi, registro attività; confronto tra sedi per Andamento. |
| `kitchen/` | Modalità cucina: una scheda per prep list, temperature, cotture, consegne e checklist; `KitchenOrders` è lo schermo delle comande (pass o partita). `KitchenMode` su telefono e tablet (`(max-width: 1100px), (pointer: coarse)`) mostra una pagina di pulsanti a icone e apre le sezioni sopra, con una voce nella cronologia per il tasto Indietro; sul computer mostra le schede. |
| `ui/` | Pezzi riutilizzabili: `Dialog`, campi dei moduli, riquadri, paginazione, avvisi, icone. |
| `recipes/` | Libreria, scheda, menu azioni, riepilogo. `editor/` ha un file per ogni scheda dell'editor. |
| `print/` | Finestra di stampa e anteprima. |
| `settings/` | Impostazioni: una scheda per file; `PeoplePane` unisce il personale e l'accesso all'app; `OrdersPane` è Cassa e comande. |
| `stock/` | Food Stock: `reports/`, `deliveries/`, `inventory/`, `picker/`. |
| `menus/` | Pagina Menu (`MenusView`, `MenuCard`), editor del menu e scelta dei menu di un piatto. |
| `performance/` | Pagina Andamento: riepilogo, vendite, sprechi e analisi del menu; finestra dello spreco. |
| `safety/` | Pagina Sicurezza alimentare (`SafetyView`, `SafetyTables`), una finestra per ogni tipo di controllo, le impostazioni (apparecchi, limiti, checklist) e il pulsante delle foto (`PhotoButton`). |
| `rota/` | Pagina Turni (`RotaView`), griglia (`RotaTable`, `ShiftCell`), stampa ed esportazioni PDF ed Excel. |
| `prep/` | Pagina Prep list, finestra della lista (`PrepPlanPanel` per menu e porzioni, `PrepTaskRow` per ogni riga) e foglio di stampa. |

### `styles/`

Il CSS dell'app originale, diviso per area e importato in ordine da `app/globals.css`. Gli ultimi due sovrascrivono gli altri: `responsive.css` per schermi piccoli e stampa, poi `mobile.css` per i telefoni (barra in basso, finestre a tutto schermo, campi a 16 px). `kitchen.css` è la modalità cucina, `orders.css` lo schermo delle comande e Impostazioni → Cassa e comande.

## Esempi: aggiungere una funzione

**Una nuova regola di calcolo** (per esempio uno sconto sulle fatture):

1. Aggiungi il campo in `GpRules` (`lib/types.ts`) e il valore predefinito in `DEFAULT_SETTINGS.gp` (`lib/seed.ts`).
2. Usalo in `summarizeReport` (`lib/stock/report.ts`) e aggiungi un test in `report.test.ts`.
3. Aggiungi il controllo in `components/settings/GpPane.tsx` e la traduzione in `lib/i18n/en.ts`.

**Un nuovo campo del prodotto:**

1. Aggiungilo a `StockItem` in `lib/types.ts`.
2. Aggiungilo al modulo in `lib/stock/productForm.ts` (`productForm` e `productFromForm`) e il campo in `components/stock/inventory/ProductFields.tsx`, che serve sia alla scheda prodotto sia al prodotto creato dalla ricetta.
3. Se deve comparire in tabella, aggiungi una colonna in `lib/stock/inventory-sort.ts` e una cella in `InventoryTableRow.tsx`.
4. Se il valore cambia da sede a sede (come la giacenza), aggiungilo a `SITE_STOCK_FIELDS` in `lib/server/store/neon-store.ts`.

Non servono modifiche al database: ogni record è salvato come JSON intero.

**Un nuovo permesso:**

1. Aggiungilo a `PERMISSIONS` in `lib/access/permissions.ts` (con gruppo ed etichetta, che compaiono nella tabella dei ruoli) e ai ruoli predefiniti che lo devono avere; se ne include altri, scrivilo in `IMPLIES`.
2. Controllalo nella route con `requireContext(request, "nuovo.permesso")` o `context.require(...)`.
3. Nascondi i pulsanti con `can("nuovo.permesso")` da `useApp()`, e aggiungi la traduzione dell'etichetta.

Le compagnie esistenti tengono i loro ruoli: il permesso nuovo va dato dalla tabella dei ruoli in Impostazioni, oppure ai ruoli predefiniti con una migrazione in `schema.ts`, come `MIGRATE_V2` per i permessi delle comande.

**Una nuova finestra:**

1. Aggiungi il tipo in `state/dialogs.ts`.
2. Crea il componente usando `Dialog` e `DialogHeader` da `components/ui/Dialog.tsx`.
3. Aggiungi il caso in `components/shell/DialogHost.tsx` e aprila con `openDialog({ kind: "…" })`.

## Accessibilità

Obiettivo: WCAG 2.2 livello AA. Regole da seguire per ogni pagina nuova:

- **Colori** (`styles/tokens.css`): testo almeno 4,5:1 sullo sfondo (3:1 sopra i 24 px, o 18,7 px in grassetto). Per il testo verde si usa `--green-text`, non `--green`, che sui fondi chiari si ferma a 4,2:1. I bordi dei campi usano `--field-border` (almeno 3:1 su bianco e sulla carta); `--line` resta per i divisori.
- **Focus da tastiera**: un anello blu `--focus` su ogni controllo, definito una volta in `tokens.css` con `:focus-visible`. Non scrivere `outline: 0`; se un campo non può mostrarlo, lo mostra il riquadro intorno con `:focus-within`, come la ricerca in alto.
- **Testo**: almeno 12 px a schermo (le stampe possono scendere). Anche `<small>` ha il minimo di 12 px.
- **Bersagli**: pulsanti e link alti almeno 24 px (28 per i filtri e le voci aggiunte); in modalità cucina molto di più.
- **Stato**: un pulsante che si comporta da scheda o filtro ha `aria-pressed`, una voce di navigazione della pagina aperta ha `aria-current="page"`. Il colore da solo non basta.
- **Finestre** (`components/ui/Dialog.tsx`): il titolo è collegato alla finestra (`aria-labelledby`), il focus va sul primo campo e torna al pulsante che l'ha aperta. Esc, la × e il clic fuori chiedono prima di perdere quello che è stato scritto; per le finestre che non sono moduli (stampa, scheda ricetta, azioni) si passa `warnOnClose={false}`. I campi di ricerca (`type="search"` o `data-not-an-edit`) non contano come modifiche. Il pulsante principale del piè di pagina azzera l'avviso, perché salva.
- **Messaggi** (`Toast` in `components/ui/bits.tsx`): gli errori vengono letti subito (`role="alert"`) e restano finché non si chiudono; gli altri si leggono con calma (`role="status"`) e spariscono da soli. Il messaggio è un popover, quindi resta sopra una finestra aperta.
- **Struttura**: «Vai al contenuto» è il primo elemento raggiungibile con Tab; ogni pagina ha un solo `h1` e i livelli dei titoli non saltano; i campi file nascosti dietro un pulsante hanno `tabIndex={-1}`.
- **Movimento**: con «riduci movimento» nel sistema animazioni e transizioni si spengono.
- **Controllo**: in fondo a una modifica conviene passare la pagina con la tastiera (Tab, Invio, Esc) e controllare i contrasti dei colori nuovi.

## Traduzioni

Il testo italiano è la chiave: scrivi `t("Salva bozza")` e aggiungi `"Salva bozza": "Save draft"` in `lib/i18n/en.ts`. Una chiave mancante mostra il testo italiano anche in inglese. Per i testi con valori usa `fmt(t("Stock {0}"), numero)`. Per i simboli di valuta scrivi "€" nel testo e passa da `f.withCurrency(…)`.

## Cose da sapere

- **Una finestra alla volta.** `DialogHost` usa una chiave per ogni finestra: aprirne un'altra azzera il modulo precedente.
- **Menu.** I piatti di un menu stanno in `Menu.recipeIds`, non sulla ricetta. `onMenu` in `useApp()` è l'insieme dei piatti nei menu attivi. Nell'editor della ricetta la scelta dei menu salva solo i menu che cambiano (`useMenuActions().setRecipeMenus`). Eliminare una ricetta la toglie da tutti i menu.
- **Prep list.** "Genera dai piatti" crea una riga per ogni base (ingrediente di tipo Base / preparazione o collegato a una ricetta base) e, se scelto, per ogni riga del MEP. La stessa base usata da più piatti è una riga sola con le quantità sommate e tutti i piatti collegati. "Aggiorna dai piatti" ricalcola quelle righe tenendo nome, fatto, pronto e note; le righe scritte a mano non vengono toccate.
- **Andamento.** Il GP teorico usa le vendite inserite e il costo per porzione delle ricette; il GP reale arriva dal report stock inviato che copre più giorni della settimana, quindi con report mensili è un'approssimazione. Gli sprechi del periodo compaiono anche nel riepilogo del report stock. Personale e paghe si gestiscono in Impostazioni → Persone; nei Turni si scrivono solo i turni.
- **Sicurezza alimentare.** Ogni controllo è una registrazione in `safetyLogs`. L'esito (`ok`) viene calcolato nel browser e ricalcolato dal server con i limiti in `settings.foodSafety`. Un controllo fuori limite non si salva senza l'azione correttiva. Il controllo all'arrivo si apre anche dalla consegna in Food Stock, la temperatura al cuore anche dalla scheda ricetta, le etichette dalla prep list.
- **Turni.** Si possono modificare la settimana corrente e le tre successive; le settimane prima sono storico in sola lettura. Le modifiche si salvano da sole 0,7 secondi dopo l'ultima battuta, una alla volta in coda (`useRotaActions`). L'esportazione Excel carica `public/vendor/xlsx.full.min.js` (SheetJS, preso dalla vecchia app) solo al primo clic. La stampa crea il foglio fuori da `.app-shell`, che le regole di stampa nascondono.
- **Report inviati.** All'invio il report salva le regole GP in `gpRules` e da lì in poi usa quelle. Riaprirlo le toglie.
- **Celle dell'inventario.** Si salvano all'uscita dalla cella o con Invio, una alla volta in coda.
- **Catalogo ingredienti.** Il magazzino è l'unica fonte dei dati di un ingrediente. All'avvio e dopo ogni modifica a prodotti, consegne o ricette base, le ricette vengono riallineate al catalogo (`useRecipeActions().syncRecipeCosts`, `lib/recipes/catalog.ts`) e risalvate se qualcosa è cambiato: costo, ma anche nome, fornitore, allergeni, tracce e kcal. Lo fa solo chi può modificare quelle ricette. Il confronto usa `sameData`, che non guarda l'ordine delle chiavi: Postgres (jsonb) le rimette in un ordine suo, e un confronto del testo JSON faceva risalvare tutte le ricette a ogni apertura.
- **Connessione degli account.** Better Auth usa un gruppo di connessioni WebSocket a Neon (`lib/server/auth/auth.ts`). Se la lettura della sessione fallisce, `resetAuth()` lo ricrea e la lettura si riprova una volta, così un database che si risveglia o una rete che cade per un attimo non fanno uscire nessuno.
- **Archivio irraggiungibile all'apertura.** Se la pagina arriva senza dati, l'app mostra «Carico i dati della cucina…» e, se anche il secondo tentativo fallisce, una schermata con «Riprova» (`loadError` in `AppProvider`), mai una cucina vuota.
- **Permessi.** La protezione vera è sul server: ogni route chiede il contesto e il permesso. Il browser nasconde solo i pulsanti e le cifre (`body.no-costs`, `body.no-pay`) che il ruolo non può usare; i dati nascosti arrivano già a zero da `redactState`.
- **Compagnie e sedi.** Le funzioni di `lib/server/directory.ts` leggono come proprietario del database, quindi ognuna controlla da sé la compagnia. I dati invece passano sempre da `store.scoped(...)`, che usa il ruolo limitato `rs_tenant` e la row-level security.
- **Cassa e comande.** Il webhook `/api/pos/:token` è l'unica API senza account: `findPosSite` cerca il token come proprietario del database, poi tutto passa da `store.scoped(...)` della sede trovata. Le comande non sono in `/api/state` (crescono ogni sera): gli schermi le chiedono a `/api/orders`. Le vendite della cassa invece sì, già sommate per settimana in `salesWeeks`.
- **Account.** Le pagine `/login`, `/registrati`, `/invito/…` e le API `/api/auth`, `/api/account`, `/api/invites`, `/api/pos` sono aperte; tutto il resto passa dal proxy, che controlla solo che il cookie di sessione ci sia: la sessione vera la verifica ogni API.
- **Rispetto alla prima versione.** Le funzioni sono le stesse; sono sparite solo le cose che React rende inutili: niente `innerHTML`, niente aggiornamenti manuali della pagina, niente escape a mano dei testi.
