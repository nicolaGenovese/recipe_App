# API

Tutte le API rispondono in JSON e non vengono mai messe in cache. Gli errori hanno la forma `{ "error": "messaggio" }`, a volte con `detail`, e il messaggio è in italiano (il browser lo traduce).

## Accesso

- **Con il database** ogni richiesta porta il cookie di sessione di Better Auth. Il server ricava l'utente, la sede scelta (cookie `rs_site`, oppure intestazione `x-rs-site`) e i permessi che i suoi incarichi gli danno in quella sede (vedi `lib/access/permissions.ts`). La sede indicata è solo una preferenza: se l'utente non ci lavora, vale la prima sede che raggiunge.
- **Senza database** c'è una sola cucina e ogni permesso è concesso; se è impostata `APP_PASSWORD`, serve il cookie della password condivisa (`/api/login`, `/api/logout`).

| Errore | Quando |
| --- | --- |
| 401 `Accesso richiesto.` | Nessuna sessione |
| 403 con `detail: "no-company"` | Account senza nessuna compagnia: il browser va alla pagina di benvenuto |
| 403 `Non hai il permesso per questa operazione.` | Manca il permesso richiesto |
| 503 `Archivio non raggiungibile…` | Il database non risponde |

## Dati della sede

La colonna **Permesso** dice cosa serve; "—" vuol dire qualsiasi persona della compagnia che lavora nella sede.

| Metodo e percorso | Permesso | Corpo → risposta |
| --- | --- | --- |
| `GET /api/state` | — | Archivio della sede: `recipes` (libreria più ricette della sede), `settings` (della compagnia con la sicurezza alimentare della sede), `stockItems` (con la giacenza della sede), `stockReports`, `stockDeliveries`, `menus`, `prepLists`, `rotaWeeks`, `safetyLogs`, `wasteLogs`, `salesWeeks`, `sharedShifts` (turni delle stesse persone in altre sedi), `access` (utente, compagnia, sede, permessi), `storage`. Quello che il ruolo non può vedere arriva a zero o vuoto: prezzi e costi senza `costs.view`, paghe senza `pay.view`, turni degli altri senza `rota.view`, vendite senza `sales.view`. |
| `GET /api/health` | — | `{ storage, connected, error, invoiceReader }`. |
| `POST /api/recipes` | `recipes.library` per la libreria, `recipes.site` per una ricetta con `siteId` | Ricetta → ricetta salvata. Il server imposta `updatedAt` e, se manca, `createdAt`. Una ricetta di un'altra sede non si tocca. |
| `DELETE /api/recipes/:id` | come sopra, secondo la ricetta | `{ ok: true }` |
| `PUT /api/settings` | `settings.company` se cambiano liste, valuta, GP o personale; `settings.site` se cambia la sicurezza alimentare | Impostazioni → impostazioni salvate, completate con i valori predefiniti. Si scrivono solo le parti cambiate; senza `pay.view` le paghe salvate restano quelle di prima. I cambi di paga vanno nel registro attività. |
| `POST /api/stock/items` | `stock.manage`; con solo `stock.count` si può cambiare solo la giacenza | Prodotto → prodotto salvato. Nome, prezzo e allergeni sono della compagnia; giacenza iniziale, conteggio e livello minimo della sede. I cambi di prezzo vanno nel registro attività. |
| `POST /api/stock/reports` | `stock.manage` | Report → report salvato. |
| `POST /api/stock/deliveries` | `stock.deliveries` | Consegna → consegna salvata. |
| `DELETE /api/stock/:kind/:id` | `stock.deliveries` per `deliveries`, altrimenti `stock.manage` | `kind` è `items`, `reports` o `deliveries`. Un prodotto eliminato sparisce da tutte le sedi. |
| `POST /api/invoices/scan` | `stock.deliveries` | `{ files: [{ mimeType, data }], suppliers }` (foto JPG, PNG, WEBP o PDF in base64, al massimo 5) → `{ supplier, invoiceNumber, date, netTotal, lines }`. Niente viene salvato. |
| `POST /api/menus`, `DELETE /api/menus/:id` | `menus.edit` | Menu → menu salvato, senza piatti doppi; eliminarlo lascia le ricette in archivio. |
| `POST /api/prep-lists` | `prep.edit`; con solo `prep.tick` si possono cambiare solo spunte e quantità pronte | Prep list → prep list salvata. Le righe senza nome vengono tolte. |
| `DELETE /api/prep-lists/:id` | `prep.edit` | `{ ok: true }` |
| `POST /api/rota`, `DELETE /api/rota/:id` | `rota.edit` | Settimana dei turni → settimana salvata (registro attività). L'`id` è il lunedì. |
| `POST /api/safety` | `safety.record`; `safety.correct` per correggere una registrazione di un giorno passato | Registrazione → registrazione salvata. Il server ricalcola `ok` con i limiti della sede. Una correzione conserva la copia precedente. |
| `DELETE /api/safety/:id` | `safety.correct` | `{ ok: true }`. La registrazione sparisce dal registro, ma ne resta una copia con chi l'ha eliminata. |
| `POST /api/waste`, `DELETE /api/waste/:id` | `waste.record` | Spreco → spreco salvato. Senza `costs.view` il costo viene calcolato dal server con i prezzi veri. |
| `POST /api/sales`, `DELETE /api/sales/:id` | `sales.view` | Vendite di una settimana (id = lunedì) → vendite salvate, senza righe vuote o a zero. |
| `POST /api/photos` | `safety.record` | `{ id, mimeType, data }` → `{ id }`. Foto di un termometro, JPEG, PNG o WEBP: al massimo 3 MB di testo base64, circa 2,2 MB di immagine (`Foto troppo grande.`, 413). Il browser la riduce prima a 1280 px. |
| `GET /api/photos/:id` | — | L'immagine, solo a chi è della stessa compagnia. |
| `DELETE /api/photos/:id` | `safety.record` | `{ ok: true }` |

Ogni `POST` crea il record se l'`id` è nuovo, altrimenti lo sostituisce.

## Cassa e comande

Come collegare la cassa e il formato consigliato degli avvisi: [CASSA-E-COMANDE.md](CASSA-E-COMANDE.md).

| Metodo e percorso | Permesso | Corpo → risposta |
| --- | --- | --- |
| `POST /api/pos/:token` | nessun account: il token dell'indirizzo dice la sede; con un segreto serve anche la firma HMAC | Avviso della cassa, JSON o form → `{ ok, duplicate, events: [{ kind, summary }] }`. Codici: 200 ricevuto (anche doppione o non riconosciuto), 401 firma non valida, 403 collegamento sospeso, 404 indirizzo non valido, 413 oltre 1 MB, 500 da riprovare. |
| `GET /api/pos/:token` | come sopra | `{ ok: true }`, oppure il testo di `?challenge=` per le casse che verificano l'indirizzo. |
| `GET /api/orders` | `orders.view` | `OrdersFeed { orders, cursor, now, config, connected }`: comande aperte delle ultime 12 ore e chiuse nell'ultima ora, impostazioni degli schermi (partite, minuti di allarme, «non è cibo», abbinamenti). Con `?since=<cursor>` solo quelle cambiate. |
| `POST /api/orders/:id` | `orders.view` | `{ action, by?, keys?, ready? }` → comanda aggiornata. `action`: `claim` (serve `by`), `unclaim`, `lines` (righe `keys` pronte, o non pronte con `ready: false`), `bump` (chiusa), `recall` (riaperta), `seen` (annullamento visto). |
| `GET /api/orders/setup` | `orders.setup` o `menus.edit` | `PosSetup { config, token, signed, enabled, events, items }`. `token` e gli ultimi 40 avvisi solo con `orders.setup`; `items` sono i piatti arrivati dalla cassa negli ultimi 30 giorni. |
| `POST /api/orders/setup` | `orders.setup`; `menus.edit` per `map` | `action`: `config` (partite, minuti, «non è cibo», prezzi in centesimi), `map` (`{ key: "plu:…" o "name:…", recipeId }`, `recipeId` vuoto toglie l'abbinamento), `connect` (nuovo indirizzo), `disconnect`, `pause`, `resume`, `secret` (`{ secret }`, vuoto lo toglie), `test` (comanda di prova). Risponde con `PosSetup`. Collegamenti e segreto vanno nel registro attività. |

## Account e compagnia

| Metodo e percorso | Accesso | Corpo → risposta |
| --- | --- | --- |
| `/api/auth/*` | pubblico | Endpoint di Better Auth: `sign-in/email`, `sign-up/email`, `sign-out`, `get-session`… |
| `GET /api/account` | pubblico | `{ accounts, claim, appPassword }`: se ci sono account e se i dati della versione a cucina singola aspettano ancora un proprietario. |
| `POST /api/account` | pubblico, `company` con sessione | `action`: `register` (nuovo account con nuova compagnia e prima sede), `claim` (il primo account prende i dati di prima, con la vecchia `APP_PASSWORD`), `company` (un utente già entrato crea un'altra compagnia). |
| `GET /api/invites/:token` | pubblico | `{ companyName, roleName, placeName, expired, accepted, email }` |
| `POST /api/invites/:token` | sessione | Accetta l'invito: crea l'incarico. Un invito vale una volta, per 14 giorni, e se ha un'email solo per quell'email. |
| `GET /api/company` | `users.manage` o `company.manage` | Compagnia, aree, sedi, ruoli (con quante persone li hanno), persone con incarico, inviti aperti. |
| `GET /api/company?audit=1` | `audit.view` | Le ultime 300 voci del registro attività. |
| `GET /api/company?compare=1` | `reports.company` | Per ogni sede raggiungibile: vendite, GP teorico e reale, sprechi, personale, prime cost, anomalie HACCP e controlli da fare oggi delle ultime 4 settimane. |
| `POST /api/company` | secondo l'azione | `action`: `renameCompany`, `saveArea`, `deleteArea`, `saveSite`, `deleteSite`, `saveRole`, `deleteRole` (`company.manage`); `invite`, `revokeInvite`, `updateMember`, `removeMember` (`users.manage`). Risponde con la compagnia aggiornata (`invite` con `{ token }`). Ogni modifica va nel registro attività. |

**Regole della compagnia:**
- Nessuno assegna un ruolo pari o superiore al proprio (il proprietario sì), né in sedi o aree in cui non lavora; gli incarichi su tutta la compagnia li dà solo chi lavora su tutta la compagnia.
- La compagnia tiene sempre almeno un proprietario e una sede.
- Una sede con dati (registri, turni, menu, consegne…) non si elimina; un ruolo assegnato a qualcuno nemmeno.
- Il ruolo del proprietario ha sempre tutti i permessi; si può solo rinominare.

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
| Registrazione di sicurezza | `kind` è `temperature`, `cooking`, `delivery` o `checklist`; `date` nel formato `YYYY-MM-DD`; `by` non vuoto; per `cooking` anche `item`. L'azione correttiva di un controllo fuori limite la chiede il browser | `Registrazione non valida.`, `Indica chi ha fatto il controllo.`, `Indica cosa è stato controllato.` (400) |
| Settimana dei turni | `id` è un lunedì, `rows` è un elenco di al massimo 60 righe; nomi e turni tagliati a 60 caratteri | `Settimana dei turni non valida.` (400) |
| Corpo della richiesta | JSON valido, al massimo 5 MB | 400 o 413 |

## Archivio

Il **file locale** ha la stessa forma della risposta di `/api/state`, senza `storage`, `access` e `sharedShifts`. È anche il formato del backup JSON esportato dall'app, che contiene la sede scelta.

In **Neon** ogni record è una riga con l'`id` e il JSON completo in `payload`, più le colonne del proprietario. Il disegno completo è in [schema-database.pdf](schema-database.pdf).

| Tabelle | Di chi | Chiave |
| --- | --- | --- |
| `recipe_studio_recipes` | Compagnia; con `site_id` ricetta propria di una sede | `company_id, id` |
| `recipe_studio_stock_items`, `recipe_studio_photos` | Compagnia | `company_id, id` |
| `recipe_studio_menus`, `_prep_lists`, `_rota_weeks`, `_safety_logs`, `_waste_logs`, `_sales_weeks`, `_stock_reports`, `_stock_deliveries` | Sede | `site_id, id` |
| `rs_company_settings` / `rs_site_settings` | Impostazioni della compagnia / sicurezza alimentare della sede | `company_id` / `site_id` |
| `rs_site_stock` | Giacenza iniziale, conteggio e livello minimo di ogni prodotto nella sede | `site_id, item_id` |
| `rs_audit_log`, `rs_record_versions` | Registro attività e copie dei registri corretti o eliminati | progressivo |
| `rs_pos_config` | Collegamento della cassa (token, segreto di firma, attivo) e impostazioni degli schermi della sede | `site_id` |
| `rs_orders` | Comande: `pos` (la parte della cassa) e `kitchen` (spunte, chi l'ha presa, chiusura) in colonne separate, così cassa e schermi non si sovrascrivono; `version` per gli aggiornamenti della cassa | `site_id, id` |
| `rs_pos_events` | Ultimi 500 avvisi della cassa per sede, con l'id dell'avviso per scartare i doppioni | progressivo; unico `site_id, event_key` |
| `rs_pos_sales` | Scontrini pagati (e rimborsi in negativo) per giorno, con le righe vendute | `site_id, receipt_id` |
| `rs_companies`, `rs_areas`, `rs_sites`, `rs_roles`, `rs_memberships`, `rs_invites` | Compagnie, accessi e inviti | `id` (`token` per gli inviti) |
| `user`, `session`, `account`, `verification` | Account di Better Auth | `id` |
| `rs_schema`, `rs_meta` | Versione della struttura e delle tabelle di Better Auth | — |
| `recipe_studio_settings` | Impostazioni della versione a cucina singola, non più usate | `id = 1` |

- Le tabelle dei dati hanno la **row-level security**: l'app ci legge e scrive con il ruolo `rs_tenant` e la compagnia impostata per la transazione, quindi vede solo le righe di quella compagnia.
- La **migrazione** (`lib/server/schema.ts`) gira da sola alla prima richiesta dopo un aggiornamento, in una sola transazione con un lock. Versione 1: i dati della versione a cucina singola diventano la compagnia `company_first` con la sede `site_first`. Versione 2: le quattro tabelle della cassa e i permessi `orders.view` e `orders.setup` ai ruoli predefiniti delle compagnie esistenti.

## Forma dei dati

```ts
Recipe   { id, name, category, portions, ingredients: Ingredient[], sellingPrice, mayContain?, allergenCheck?, siteId?, shelfLifeDays?, … }
Ingredient { type: "Prodotto" | "Base / preparazione" | "Esterno", name, supplier, quantity, unit, unitCost, allergens, mayContain?, kcal, stockItemId? }
StockItem { id, code, name, supplier, price, recipeContent, recipeUnit, allergens, mayContain?, allergensChecked?, initialStock, parLevel?, stockCount?, invoiceNames?, … }
Menu     { id, name, description?, active, recipeIds: string[], availability?: { days: number[], slots: { from, to }[] }, createdAt, updatedAt }
PrepList { id, name, date, menuIds: string[], portions: { [recipeId]: number }, tasks: PrepTask[], createdAt, updatedAt }
PrepTask { id, name, quantity, onHand, unit, recipeIds: string[], baseRecipeId?, notes?, done, auto? }
RotaWeek { id /* lunedì YYYY-MM-DD */, rows: { name, shifts: string[7] }[], createdAt, updatedAt }
SafetyLog = { id, date, time, by, ok, action?, notes?, createdAt, updatedAt } più, secondo kind:
  temperature { slot: "am" | "pm", readings: { equipmentId, name, value, ok, photoId? }[] }
  cooking     { process: "cook" | "cool" | "reheat" | "hotHold", item, recipeId?, temperature, photoId?, startTime?, endTime?, startTemperature?, startPhotoId? }
  delivery    { deliveryId?, supplier, invoiceNumber?, chilledTemperature, frozenTemperature, chilledPhotoId?, frozenPhotoId?, packagingOk, datesOk, rejected }
  checklist   { list: "opening" | "closing" | "cleaning", items: { label, done, by, at }[] }
```

- **Ricette e allergeni:** `allergens` e `mayContain` delle righe collegate sono copie del prodotto o della base, riallineate a ogni sincronizzazione. `mayContain` della ricetta sono le tracce aggiunte in cucina. `allergenCheck { at, by, contains, mayContain }` è la conferma, con la copia di quello che è stato confermato. `siteId` c'è solo sulle ricette proprie di una sede.
- **Prodotti:** `allergensChecked: false` vuol dire allergeni da controllare sull'etichetta; i prodotti senza il campo, salvati prima, contano come controllati.
- **Menu:** `recipeIds` è in ordine di servizio e un piatto può stare in più menu. `availability`: giorni da lunedì (0) a domenica (6), vuoto = tutti; fasce `HH:MM`, anche oltre la mezzanotte; senza = sempre disponibile.
- **Prep list:** `portions` sono le porzioni previste per piatto e scalano le righe generate; `auto` c'è solo sulle righe generate dai piatti.
- **Sicurezza alimentare:** i limiti stanno in `settings.foodSafety` (apparecchi con minimo e massimo, cottura 75 °C, rigenerazione 75 °C, mantenimento 63 °C, abbattimento sotto 8 °C entro 90 minuti, consegne refrigerate fino a 8 °C e surgelate fino a −15 °C, conservazione predefinita 3 giorni, voci delle checklist, `requireTemperaturePhotos`). Sono i valori delle linee guida UK Safer Food, Better Business e si cambiano da "Impostazioni sicurezza". `photoId` punta a una foto di `/api/photos`.
- **Sprechi:** `WasteLog { id, date, source: "product" | "recipe" | "other", itemId?, name, quantity, unit, unitCost, reason: "expired" | "error" | "leftover" | "damaged" | "other", by, notes? }`. Il costo è `quantity × unitCost`.
- **Vendite:** `SalesWeek { id /* lunedì */, lines: { recipeId?, name, quantity, revenue? /* IVA inclusa */ }[], netSales?, source?, days? }`. Senza `revenue` vale quantità × prezzo del menu; il netto toglie l'IVA della ricetta (o quella predefinita). Le settimane con scontrini della cassa arrivano da `/api/state` con `source: "pos"` e `days: { date, dishes, revenue }[]`, sommate da `rs_pos_sales`; prendono il posto della settimana scritta a mano, che resta salvata.
- **Comande:** `KitchenOrder { id, externalId, number?, table?, covers?, server?, channel?, note?, allergies, receivedAt, changedAt?, fired, paid?, test?, status: "open" | "done" | "cancelled", claimedBy?, doneAt?, doneBy?, seen?, version, updatedAt, lines }`. Ogni riga: `{ id, key, name, quantity, modifiers, note?, course?, category?, plu?, allergens?, held?, voided?, total?, addedAt?, voidedAt?, changedAt?, rev?, firedAt?, ready?: { at, by } }`. La `key` è l'id più la revisione: una riga cambiata dalla cassa va segnata pronta di nuovo. Tipi in `lib/orders/types.ts`.
- **Personale:** `settings.staff = { id, name, role?, hourlyRate, active, siteIds? }[]` (senza `siteIds` la persona lavora in tutte le sedi) e gli oneri in `settings.labour.onCostPercent`. Le settimane modificabili hanno una riga per ogni persona attiva della sede; le righe sono legate al nome.
- **Turni:** un turno è `"09:00-17:00"`, più fasce separate da virgola per un turno spezzato, `"__DAY_OFF__"` (riposo), `"__HOLIDAY__"` (ferie) oppure `""`. Sono gli stessi valori della vecchia app Rota.

## Passaggio dal vecchio "menu attuale"

Prima esisteva un solo menu, segnato con `currentMenu: true` sulle ricette. Un archivio locale senza `menus` trasforma le ricette segnate nel menu "Menu principale" (o "Main menu" se l'archivio è in inglese), con id `main-menu`. In Neon il passaggio è già avvenuto. Il campo `currentMenu` non è più usato.
