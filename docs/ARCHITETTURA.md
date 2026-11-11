# Architettura

Il codice segue una regola semplice: **i calcoli non sanno nulla di React, React non sa nulla del database**. Ogni livello dipende solo da quelli sotto.

```
src/
├── app/                  Pagine e API di Next.js (solo collegamenti, niente logica)
├── components/           Interfaccia React, un componente per file
├── state/                Stato del browser e azioni (salva, elimina, genera…)
├── lib/                  Logica pura: tipi, calcoli, formati, traduzioni
│   └── server/           Solo lato server: archivio, validazione, risposte HTTP
└── styles/               CSS diviso per area
```

## Come scorrono i dati

1. **Prima apertura.** `app/page.tsx` gira sul server, legge l'archivio con `getStore().getState()` e passa tutto ad `AppProvider`. La pagina arriva già con i dati, senza schermata di caricamento.
2. **Nel browser.** `state/AppProvider.tsx` tiene i dati in memoria e li mette a disposizione di ogni componente con `useApp()`, insieme a lingua (`t`), formati (`f`: valuta, quantità, date), regole GP, filtri della vista, finestra aperta e avvisi.
3. **Una modifica.** Un componente chiama un'azione, per esempio `useStockActions().saveDelivery(…)`. L'azione chiama l'API (`state/api.ts`), aggiorna i dati in memoria con `update(…)` e mostra l'avviso.
4. **Sul server.** La route in `app/api/…` legge il JSON, lo valida (`lib/server/validation.ts`) e lo passa all'archivio (`lib/server/store`), che è il file JSON locale oppure Neon.

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
| `recipes/math.ts` | Costo, costo per porzione, allergeni, kcal, margine, prezzo suggerito, righe senza costo. |
| `recipes/form.ts` | Conversione ricetta ↔ modulo dell'editor (i numeri restano testo mentre si scrive). |
| `recipes/filter.ts` | Filtri e ordinamento della libreria, compreso il filtro per menu. |
| `menus/menus.ts` | Piatti in menu, piatti di più menu, numeri del menu (costo medio, food cost, margine), assegnazione di un piatto ai menu, passaggio dal vecchio "menu attuale". |
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
| `store/types.ts` | L'interfaccia `Store`: tutto quello che le API chiedono all'archivio. |
| `store/local-store.ts` | Archivio su file JSON. Le scritture passano da un file temporaneo e sono in coda, quindi due salvataggi veloci non si sovrascrivono. |
| `store/neon-store.ts` | Archivio su Neon Postgres. Crea le tabelle al primo uso. |
| `store/index.ts` | `getStore()`: Neon se c'è `DATABASE_URL`, altrimenti il file. |
| `validation.ts` | Controlli sui dati in arrivo ed `HttpError`. |
| `http.ts` | Risposte JSON, limite di 5 MB sul corpo, gestione degli errori. |

`store/index.ts` importa `server-only`: se per sbaglio un componente del browser lo importa, la build si ferma invece di esporre il database.

### `state/` — stato del browser

| File | Contenuto |
| --- | --- |
| `AppProvider.tsx` | Contesto dell'app e hook `useApp()`. |
| `api.ts` | Chiamate alle API. |
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
| `shell/` | Pagina: barra laterale, barra in alto, intestazione, `DialogHost` che mostra la finestra aperta. |
| `ui/` | Pezzi riutilizzabili: `Dialog`, campi dei moduli, riquadri, paginazione, avvisi, icone. |
| `recipes/` | Libreria, scheda, menu azioni, riepilogo. `editor/` ha un file per ogni scheda dell'editor. |
| `print/` | Finestra di stampa e anteprima. |
| `settings/` | Impostazioni: una scheda per file. |
| `stock/` | Food Stock: `reports/`, `deliveries/`, `inventory/`, `picker/`. |
| `menus/` | Pagina Menu (`MenusView`, `MenuCard`), editor del menu e scelta dei menu di un piatto. |
| `performance/` | Pagina Andamento: riepilogo, vendite, sprechi e analisi del menu; finestra dello spreco. |
| `safety/` | Pagina Sicurezza alimentare (`SafetyView`, `SafetyTables`), una finestra per ogni tipo di controllo e le impostazioni (apparecchi, limiti, checklist). |
| `rota/` | Pagina Turni (`RotaView`), griglia (`RotaTable`, `ShiftCell`), stampa ed esportazioni PDF ed Excel. |
| `prep/` | Pagina Prep list, finestra della lista (`PrepPlanPanel` per menu e porzioni, `PrepTaskRow` per ogni riga) e foglio di stampa. |

### `styles/`

Il CSS dell'app originale, diviso per area e importato in ordine da `app/globals.css`. `responsive.css` è l'ultimo perché sovrascrive gli altri su schermi piccoli e in stampa.

## Esempi: aggiungere una funzione

**Una nuova regola di calcolo** (per esempio uno sconto sulle fatture):

1. Aggiungi il campo in `GpRules` (`lib/types.ts`) e il valore predefinito in `DEFAULT_SETTINGS.gp` (`lib/seed.ts`).
2. Usalo in `summarizeReport` (`lib/stock/report.ts`) e aggiungi un test in `report.test.ts`.
3. Aggiungi il controllo in `components/settings/GpPane.tsx` e la traduzione in `lib/i18n/en.ts`.

**Un nuovo campo del prodotto:**

1. Aggiungilo a `StockItem` in `lib/types.ts`.
2. Aggiungi il campo nel modulo di `components/stock/inventory/StockItemDialog.tsx` (`toForm` e `submit`).
3. Se deve comparire in tabella, aggiungi una colonna in `lib/stock/inventory-sort.ts` e una cella in `InventoryTableRow.tsx`.

Non servono modifiche al database: ogni record è salvato come JSON intero.

**Una nuova finestra:**

1. Aggiungi il tipo in `state/dialogs.ts`.
2. Crea il componente usando `Dialog` e `DialogHeader` da `components/ui/Dialog.tsx`.
3. Aggiungi il caso in `components/shell/DialogHost.tsx` e aprila con `openDialog({ kind: "…" })`.

## Traduzioni

Il testo italiano è la chiave: scrivi `t("Salva bozza")` e aggiungi `"Salva bozza": "Save draft"` in `lib/i18n/en.ts`. Una chiave mancante mostra il testo italiano anche in inglese. Per i testi con valori usa `fmt(t("Stock {0}"), numero)`. Per i simboli di valuta scrivi "€" nel testo e passa da `f.withCurrency(…)`.

## Cose da sapere

- **Una finestra alla volta.** `DialogHost` usa una chiave per ogni finestra: aprirne un'altra azzera il modulo precedente.
- **Menu.** I piatti di un menu stanno in `Menu.recipeIds`, non sulla ricetta. `onMenu` in `useApp()` è l'insieme dei piatti nei menu attivi. Nell'editor della ricetta la scelta dei menu salva solo i menu che cambiano (`useMenuActions().setRecipeMenus`). Eliminare una ricetta la toglie da tutti i menu.
- **Prep list.** "Genera dai piatti" crea una riga per ogni base (ingrediente di tipo Base / preparazione o collegato a una ricetta base) e, se scelto, per ogni riga del MEP. La stessa base usata da più piatti è una riga sola con le quantità sommate e tutti i piatti collegati. "Aggiorna dai piatti" ricalcola quelle righe tenendo nome, fatto, pronto e note; le righe scritte a mano non vengono toccate.
- **Andamento.** Il GP teorico usa le vendite inserite e il costo per porzione delle ricette; il GP reale arriva dal report stock inviato che copre più giorni della settimana, quindi con report mensili è un'approssimazione. Gli sprechi del periodo compaiono anche nel riepilogo del report stock. Personale e paghe si gestiscono in Impostazioni → Personale; nei Turni si scrivono solo i turni.
- **Sicurezza alimentare.** Ogni controllo è una registrazione in `safetyLogs`. L'esito (`ok`) viene calcolato nel browser e ricalcolato dal server con i limiti in `settings.foodSafety`. Un controllo fuori limite non si salva senza l'azione correttiva. Il controllo all'arrivo si apre anche dalla consegna in Food Stock, la temperatura al cuore anche dalla scheda ricetta, le etichette dalla prep list.
- **Turni.** Si possono modificare la settimana corrente e le tre successive; le settimane prima sono storico in sola lettura. Le modifiche si salvano da sole 0,7 secondi dopo l'ultima battuta, una alla volta in coda (`useRotaActions`). L'esportazione Excel carica `public/vendor/xlsx.full.min.js` (SheetJS, preso dalla vecchia app) solo al primo clic. La stampa crea il foglio fuori da `.app-shell`, che le regole di stampa nascondono.
- **Report inviati.** All'invio il report salva le regole GP in `gpRules` e da lì in poi usa quelle. Riaprirlo le toglie.
- **Celle dell'inventario.** Si salvano all'uscita dalla cella o con Invio, una alla volta in coda.
- **Allineamento dei costi.** All'avvio e dopo ogni modifica a prodotti o consegne, le ricette con ingredienti collegati vengono risalvate se il prezzo è cambiato.
- **Rispetto alla prima versione.** Le funzioni sono le stesse; sono sparite solo le cose che React rende inutili: niente `innerHTML`, niente aggiornamenti manuali della pagina, niente escape a mano dei testi.
