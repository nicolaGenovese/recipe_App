# API

Tutte le API rispondono in JSON e non vengono mai messe in cache. Gli errori hanno la forma `{ "error": "messaggio" }`, con il messaggio in italiano (il browser lo traduce).

| Metodo e percorso | Corpo | Risposta |
| --- | --- | --- |
| `GET /api/state` | — | Tutto l'archivio: `recipes`, `settings`, `stockItems`, `stockReports`, `stockDeliveries`, `menus`, `prepLists`, `rotaWeeks`, `safetyLogs`, `wasteLogs`, `salesWeeks`, `storage` (`local` o `neon`). |
| `GET /api/health` | — | `{ storage, connected, error }`. Con Neon prova la connessione. |
| `POST /api/recipes` | Ricetta | La ricetta salvata. Il server imposta `updatedAt` e, se manca, `createdAt`. |
| `DELETE /api/recipes/:id` | — | `{ ok: true }` |
| `PUT /api/settings` | Impostazioni | Le impostazioni salvate, completate con i valori predefiniti. |
| `POST /api/stock/items` | Prodotto | Il prodotto salvato. |
| `POST /api/stock/reports` | Report | Il report salvato. |
| `POST /api/stock/deliveries` | Consegna | La consegna salvata. |
| `DELETE /api/stock/:kind/:id` | — | `kind` è `items`, `reports` o `deliveries`. Risponde `{ ok: true }`. |
| `POST /api/menus` | Menu | Il menu salvato. Il server imposta `updatedAt`, toglie i piatti doppi. |
| `DELETE /api/menus/:id` | — | `{ ok: true }`. Le ricette del menu restano in archivio. |
| `POST /api/prep-lists` | Prep list | La prep list salvata. Le righe senza nome vengono tolte. |
| `DELETE /api/prep-lists/:id` | — | `{ ok: true }` |
| `POST /api/rota` | Registrazione di sicurezza | `kind` è `temperature`, `cooking`, `delivery` o `checklist`; `date` nel formato `YYYY-MM-DD`; `by` non vuoto; per `cooking` anche `item` | `Registrazione non valida.`, `Indica chi ha fatto il controllo.`, `Indica cosa è stato controllato.` (400) |
| Settimana dei turni | La settimana salvata. L'`id` è il lunedì della settimana (`YYYY-MM-DD`). |
| `DELETE /api/rota/:id` | — | `{ ok: true }` (usato da "Svuota settimana"). |
| `POST /api/safety` | Registrazione di sicurezza alimentare | La registrazione salvata. Il server ricalcola `ok` con i limiti delle impostazioni. |
| `DELETE /api/safety/:id` | — | `{ ok: true }` |
| `POST /api/waste` | Spreco | Lo spreco salvato. |
| `DELETE /api/waste/:id` | — | `{ ok: true }` |
| `POST /api/sales` | Vendite di una settimana | Le vendite salvate. L'`id` è il lunedì della settimana. Le righe senza nome o con quantità zero vengono tolte. |
| `DELETE /api/sales/:id` | — | `{ ok: true }` |

Ogni `POST` crea il record se l'`id` è nuovo, altrimenti lo sostituisce.

## Controlli

| Record | Requisiti | Errore |
| --- | --- | --- |
| Tutti | `id` stringa non vuota, senza `/` | `Identificativo non valido.` (400) |
| Ricetta | `name` non vuoto | `La ricetta deve avere un nome.` (400) |
| Prodotto | `name` non vuoto | `Il prodotto deve avere un nome.` (400) |
| Report | `lines` è un elenco, `status` è `draft` o `submitted`, `dateFrom` e `dateTo` presenti | `Report stock non valido.` (400) |
| Consegna | almeno una riga in `lines`, `date` nel formato `YYYY-MM-DD` | `Consegna non valida.` (400) |
| Menu | `name` non vuoto; `recipeIds` è un elenco di id | `Il menu deve avere un nome.` (400) |
| Prep list | `name` non vuoto, `date` nel formato `YYYY-MM-DD` | `La prep list deve avere un nome e una data.` (400) |
| Registrazione di sicurezza | `kind` è `temperature`, `cooking`, `delivery` o `checklist`; `date` nel formato `YYYY-MM-DD`; `by` non vuoto; per `cooking` anche `item` | `Registrazione non valida.`, `Indica chi ha fatto il controllo.`, `Indica cosa è stato controllato.` (400) |
| Settimana dei turni | `id` è un lunedì, `rows` è un elenco di al massimo 60 righe; nomi e turni vengono tagliati a 60 caratteri | `Settimana dei turni non valida.` (400) |
| Corpo della richiesta | JSON valido, al massimo 5 MB | 400 o 413 |

Se l'archivio non risponde (per esempio Neon non raggiungibile) l'errore è 503 con `Archivio non raggiungibile. Controlla DATABASE_URL e la connessione.`

## Archivio

Il **file locale** ha la stessa forma della risposta di `/api/state`, senza `storage`. È anche il formato del backup JSON esportato dall'app.

In **Neon** ogni record è una riga con l'`id` e il JSON completo in `payload`:

| Tabella | Contenuto |
| --- | --- |
| `recipe_studio_recipes` | Ricette, con nome, categoria, menu, base e date anche in colonne proprie. |
| `recipe_studio_settings` | Una sola riga (`id = 1`). |
| `recipe_studio_stock_items` | Prodotti. |
| `recipe_studio_stock_reports` | Report. |
| `recipe_studio_stock_deliveries` | Consegne. |
| `recipe_studio_menus` | Menu. |
| `recipe_studio_prep_lists` | Prep list. |
| `recipe_studio_rota_weeks` | Settimane dei turni del personale. |
| `recipe_studio_safety_logs` | Registrazioni di sicurezza alimentare. |
| `recipe_studio_waste_logs` | Sprechi. |
| `recipe_studio_sales_weeks` | Piatti venduti per settimana. |

Le prime cinque sono le tabelle della prima versione dell'app. Menu e prep list si aggiungono da sole al primo avvio.

## Forma di menu e prep list

```ts
Menu     { id, name, description?, active, recipeIds: string[], createdAt, updatedAt }
PrepList { id, name, date, menuIds: string[], portions: { [recipeId]: number }, tasks: PrepTask[], createdAt, updatedAt }
PrepTask { id, name, quantity, onHand, unit, recipeIds: string[], baseRecipeId?, notes?, done, auto? }
RotaWeek { id /* lunedì YYYY-MM-DD */, rows: { name, shifts: string[7] }[], createdAt, updatedAt }
SafetyLog = { id, date, time, by, ok, action?, notes?, createdAt, updatedAt } più, secondo kind:
  temperature { slot: "am" | "pm", readings: { equipmentId, name, value, ok }[] }
  cooking     { process: "cook" | "cool" | "reheat" | "hotHold", item, recipeId?, temperature, startTime?, endTime?, startTemperature? }
  delivery    { deliveryId?, supplier, invoiceNumber?, chilledTemperature, frozenTemperature, packagingOk, datesOk, rejected }
  checklist   { list: "opening" | "closing" | "cleaning", items: { label, done, by, at }[] }
```

- I limiti stanno in `settings.foodSafety` (apparecchi con minimo e massimo, cottura 75 °C, rigenerazione 75 °C, mantenimento 63 °C, abbattimento sotto 8 °C entro 90 minuti, consegne refrigerate fino a 8 °C e surgelate fino a −15 °C, conservazione predefinita 3 giorni, voci delle checklist). Sono i valori delle linee guida UK Safer Food, Better Business e si cambiano da "Impostazioni sicurezza".
- `WasteLog { id, date, source: "product" | "recipe" | "other", itemId?, name, quantity, unit, unitCost, reason: "expired" | "error" | "leftover" | "damaged" | "other", by, notes? }`. Il costo è `quantity × unitCost`; `unitCost` viene proposto dal prezzo del prodotto (per unità di ricetta) o dal costo per porzione della ricetta.
- `SalesWeek { id /* lunedì */, lines: { recipeId?, name, quantity, revenue? /* IVA inclusa */ }[], netSales? }`. Senza `revenue` vale quantità × prezzo del menu; il netto toglie l'IVA della ricetta (o quella predefinita).
- Il personale sta in `settings.staff = { id, name, role?, hourlyRate, active }[]` e gli oneri in `settings.labour.onCostPercent`. Le settimane dei turni modificabili hanno una riga per ogni persona attiva; le righe sono legate al nome. Gli archivi senza `staff` lo ricavano una volta dai nomi presenti nei turni (con i vecchi `labour.rates`, se c'erano).
- La ricetta può avere `shelfLifeDays`, usato per la data di scadenza sulle etichette della prep list.

- Un turno è `"09:00-17:00"`, più fasce separate da virgola per un turno spezzato, `"__DAY_OFF__"` (riposo), `"__HOLIDAY__"` (ferie) oppure `""`. Sono gli stessi valori della vecchia app Rota, quindi le sue settimane si possono importare così come sono.

- `recipeIds` del menu è in ordine di servizio. Un piatto può stare in più menu.
- `portions` sono le porzioni previste per piatto; scalano le quantità delle righe generate.
- `auto` c'è solo sulle righe generate dai piatti: serve a riconoscerle quando la lista viene aggiornata.

## Passaggio dal vecchio "menu attuale"

Prima esisteva un solo menu, segnato con `currentMenu: true` sulle ricette. Al primo avvio della nuova versione le ricette segnate diventano il menu "Menu principale" (o "Main menu" se l'archivio è in inglese), con id `main-menu`. Con il file locale succede quando l'archivio non ha ancora `menus`; con Neon quando la tabella `recipe_studio_menus` non esiste ancora. Il campo `currentMenu` viene tolto dalla ricetta al primo salvataggio e non è più usato.
