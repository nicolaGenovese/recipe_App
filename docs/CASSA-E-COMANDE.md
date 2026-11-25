# Cassa e comande in cucina

Stato al 25/11/2026: **fasi 1–3 fatte.** Le fasi 4–5 sono da fare (vedi il punto 9).

Ogni sede collega la sua cassa (EPOS) con un **webhook**. Le comande compaiono sugli schermi della cucina, divise per partita, e gli scontrini pagati diventano le vendite di Andamento. La marca della cassa non conta: serve solo che sappia mandare avvisi HTTP.

## 1. In breve

- **Indirizzo per sede.** In **Impostazioni → Cassa e comande** si crea un indirizzo webhook, uno per sede, e lo si incolla nella cassa.
- **Avvisi dalla cassa.** La cassa avvisa l'app quando un ordine viene mandato in cucina, modificato, mandato «via», pagato, stornato o rimborsato.
- **Schermi in cucina.** In **modalità cucina → Comande**, su uno o più schermi:
  - con tutte le comande (il pass);
  - oppure con le righe di una sola partita.
- **Vendite.** Gli scontrini pagati diventano le **vendite della settimana**. Riepilogo, GP teorico, analisi del menu, confronto tra sedi e porzioni suggerite si aggiornano da soli.

## 2. Collegare la cassa

1. **Impostazioni → Cassa e comande → Crea l'indirizzo per la cassa.**
   - L'indirizzo ha la forma `https://recipe-app-delta-ten.vercel.app/api/pos/pos_…`.
   - La parte finale è una chiave segreta lunga: chi ha l'indirizzo può mandare comande a quella sede. Va dato solo al fornitore della cassa.
2. **Nel pannello della cassa** si incolla l'indirizzo come webhook per gli eventi degli ordini e dei pagamenti. Se la cassa non ha webhook adatti, lo si incolla in un servizio che la collega (Zapier, Make, n8n…), vedi il punto 3.
3. **Se la cassa firma gli avvisi** (HMAC), si incolla il segreto in «Segreto di firma». Da quel momento gli avvisi senza una firma valida vengono rifiutati.
4. **«Invia una comanda di prova»** fa arrivare una comanda finta, con tre piatti del menu, una variante, un'allergia e i dolci in attesa. Fa lo stesso percorso di quelle vere e non conta nelle vendite.
5. **«Ultimi avvisi ricevuti»** mostra, per ogni avviso:
   - il contenuto arrivato;
   - come è stato letto: nuova comanda, modifica, portata via, pagato, storno, rimborso o «non riconosciuto».

   È il modo per controllare una cassa nuova.

Altri comandi:
- **Nuovo indirizzo**: il vecchio smette subito di funzionare.
- **Sospendi**: gli avvisi vengono rifiutati, con codice 403.
- **Scollega**.

Ognuno resta nel registro attività.

## 3. Quali casse funzionano

**Funzionano senza fare niente** le casse e le piattaforme che mandano l'ordine intero nel webhook. Il lettore degli avvisi (`src/lib/orders/pos.ts`) riconosce:

- **I nomi comuni dei campi**, in tutte le grafie («table_name», «tableName», «TableName», «table.name»).
- **Le buste** intorno all'ordine: `data.object.order`, `payload`, `details.order`, liste di eventi.
- **Le righe sotto molti nomi**: `lines`, `line_items`, `items`, `products`, `selections`, `entries`… anche dentro portate, coperti o conti.
- **Le varianti**: modificatori, opzioni e sotto-piatti dei menu fissi.
- **I prezzi** in sterline o in centesimi, alla Square (`total_money`). Per le casse che mandano tutti i prezzi in centesimi c'è la casella «La cassa manda i prezzi in centesimi».
- **Il tipo di avviso** dalle parole della cassa: «order.created», «ORDER_UPDATED», «COMPLETED», «course.fired», «refund.created»…
- **I form**, oltre al JSON: anche `payload=<json>`.

I test (`src/lib/orders/orders.test.ts`) provano formati nello stile di:
- Square;
- Toast (ordine diviso in conti);
- piattaforme di consegna con PLU e sotto-piatti, come Deliverect;
- portate raggruppate;
- il formato qui sotto.

**Serve un servizio in mezzo** per le casse che nel webhook mandano solo l'id dell'ordine. Square, per esempio, manda solo l'id negli aggiornamenti degli ordini, e senza le righe la comanda non si può mostrare. In quel caso un servizio come Zapier, Make o n8n legge l'ordine dalla cassa e lo manda nel formato consigliato.

### Formato consigliato

Il formato più semplice da preparare in un servizio in mezzo:

```json
{
  "event": "order.created",
  "id": "evt_123",
  "order": {
    "id": "A-1001",
    "number": "1001",
    "table": "12",
    "covers": 4,
    "server": "Marta",
    "channel": "Sala",
    "created_at": "2026-11-25T19:02:00Z",
    "note": "Compleanno",
    "allergies": ["Glutine"],
    "lines": [
      { "id": "1", "name": "Margherita", "plu": "101", "quantity": 2, "course": "Principali", "category": "Pizze",
        "modifiers": ["Senza basilico"], "note": "ben cotta", "allergens": [], "held": false, "total": 19.00 },
      { "id": "2", "name": "Tiramisù", "quantity": 2, "course": "Dolci", "held": true, "total": 13.00 }
    ],
    "total": 32.00
  }
}
```

| `event` | Effetto |
| --- | --- |
| `order.created`, `order.updated` | Nuova comanda, oppure comanda aggiornata. La cassa manda l'ordine intero: le righe nuove compaiono come «+ NUOVO», quelle sparite restano barrate («TOLTO») e quelle cambiate sono segnate «CAMBIATO» e vanno rifatte. |
| `course.fired` con `"course": "Dolci"` | Le righe di quella portata smettono di essere in attesa. Senza portata partono tutte quelle in attesa. |
| `order.paid` | Lo scontrino diventa una vendita. Se l'avviso non ha righe, si usano quelle della comanda. |
| `order.voided` | Senza righe annulla tutta la comanda; con righe toglie solo quelle. Se la comanda era già pagata, diventa un rimborso. |
| `order.refunded` | Rimborso: le righe (o l'intero scontrino) contano in negativo. |

**Regole sui campi:**
- `id` dell'avviso e `id` dell'ordine sono facoltativi ma consigliati: con l'`id` dell'avviso, lo stesso avviso mandato due volte conta una volta sola.
- Senza `id` dell'avviso il doppione si riconosce dal contenuto identico.
- `total` di riga è l'incasso IVA inclusa. Senza prezzo si usa il prezzo del menu.

**Dati personali:** l'app non legge dati di carte né dati personali dei clienti. Il nome sul conto (`tab_name`, `ticket_name`) si usa solo come etichetta della comanda.

### Firme riconosciute

Con un segreto impostato, l'avviso passa se porta una di queste firme HMAC-SHA256:
- **Standard Webhooks / Svix**: `webhook-id`, `webhook-timestamp`, `webhook-signature: v1,<base64>`; segreti `whsec_…` compresi.
- **Stile Stripe**: `t=…,v1=<hex>`.
- **Square**: `x-square-hmacsha256-signature`, calcolata su indirizzo + corpo.
- **Firma semplice del corpo**, in esadecimale o base64, anche con `sha256=` davanti, in qualsiasi intestazione che contiene «signature» o «hmac».

### Risposte

| Codice | Quando |
| --- | --- |
| 200 | Avviso ricevuto, anche se è un doppione (`"duplicate": true`) o non riconosciuto. |
| 401 | La firma non è valida. |
| 403 | Il collegamento è sospeso. |
| 404 | L'indirizzo non è valido. |
| 413 | Il corpo supera 1 MB. |
| 500 | Salvataggio non riuscito: la cassa riprova, e l'avviso non viene scambiato per un doppione. |

`GET` sullo stesso indirizzo risponde `ok`, e restituisce `challenge` quando la cassa lo chiede per verificare l'indirizzo.

## 4. Schermi delle comande

In **modalità cucina → Comande**, per chi ha il permesso «Vedere e gestire le comande».

**La scheda di una comanda:**
- **Intestazione**: tavolo (o nome del conto, numero, canale), coperti, cameriere, ora di arrivo e minuti di attesa.
  - Il bordo diventa **ambra** e poi **rosso** oltre i minuti impostati (predefiniti 10 e 15).
  - I minuti seguono l'orologio del server, quindi sono uguali su tutti gli schermi.
- **Allergie in rosso in alto**: quelle della comanda, quelle delle singole righe e le note che le nominano.
  - Se la ricetta abbinata contiene un'allergia della comanda (o della sua riga), il piatto è bordato di rosso con «⚠ contiene …».
- **Righe divise per portata**, con varianti in evidenza e note tra «».
  - Le portate in attesa sono grigie finché il cameriere non le manda «via».
- **Modifiche dalla cassa**:
  - «MODIFICATA alle …» per tre minuti;
  - righe nuove, tolte o cambiate segnate;
  - suono diverso da quello di una comanda nuova.
- **Comanda annullata**: resta con «ANNULLATA dalla cassa» finché qualcuno preme **Visto**.
- **«i»** accanto a un piatto abbinato apre la sua ricetta: metodo, impiattamento, foto, allergeni.
- **Bevande**: le righe di ciò che non è cibo non si vedono, per esempio con «Bevande» in «Non è cibo».

**Cosa si fa:**
- **Tocco su una riga**: pronta o non pronta, con il nome di chi lavora.
- **Prendo io / Lascia**: segna chi ha preso la comanda.
- **Pronto**:
  - sullo schermo di una partita, segna pronte tutte le sue righe, e la comanda sparisce da quello schermo;
  - al pass, chiude la comanda. Diventa «Servita ✓» in verde quando tutte le righe sono pronte.
- **Richiama**: riporta sullo schermo l'ultima comanda chiusa, per un errore.

**Più schermi:**
- Ogni schermo sceglie in alto «Tutte · pass» o una partita, e se lo ricorda.
- **«Solo comande»** nasconde il resto della modalità cucina e chiede lo schermo intero.
- Per uno schermo fisso si apre una volta il suo indirizzo, per esempio `…/?comande&partita=Forno`, oppure `…/?comande` per il pass. Gli indirizzi da copiare sono in Impostazioni → Cassa e comande.
- Lo schermo resta acceso, come nel resto della modalità cucina.

**Aggiornamento e collegamento:**
- Ogni schermo chiede al server cosa è cambiato **ogni 3 secondi** (ogni 15 quando la pagina è nascosta) e rilegge tutto ogni minuto. Senza cassa collegata né comande aperte chiede ogni minuto.
- **Costo:** con gli schermi accesi il database non va mai in pausa. Sul piano gratuito di Neon conviene chiudere la pagina a fine servizio (vedi i limiti in [FUNZIONI.md](FUNZIONI.md)).
- Vercel non tiene aperte connessioni lunghe, e per una cucina un controllo così frequente basta.
- **Se la connessione cade**, compare un avviso rosso «Connessione persa»: finché non torna, la riserva è la stampante delle comande.

**Suono:** il suono si attiva al primo tocco sullo schermo, perché i browser non suonano prima. Ci sono due toni per una comanda nuova e tre per una modifica o un annullamento.

## 5. Partite

In **Impostazioni → Cassa e comande → Partite e schermi**, per sede.

- **Cosa riceve una partita**: un elenco di parole. Una riga va a quella partita se una parola corrisponde a uno di questi:
  - la **categoria della ricetta** abbinata;
  - la **categoria della cassa**;
  - la **portata**;
  - il **nome del piatto**;
  - il **PLU**.
- **«anche il resto»**: la partita riceve anche le righe che nessun'altra prende. Senza, quelle righe si vedono solo al pass.
- **Una riga a più partite**: se corrisponde a più partite, compare su tutte.
- **Tempi di allarme**: ambra e rosso, in minuti.
- **Non è cibo**: categorie, nomi o PLU che non vanno in cucina e non contano nelle vendite food.

## 6. Piatti della cassa e ricette

- **Stesso nome**: un piatto con lo stesso nome di una ricetta si abbina da solo. Non contano maiuscole, accenti e punteggiatura.
- **Abbinamento a mano**: per gli altri («BURGER CHK» → Chicken Burger) si sceglie la ricetta in **Impostazioni → Cassa e comande → Piatti della cassa e ricette**.
  - L'app propone la ricetta più simile.
  - L'abbinamento si salva per PLU quando la cassa lo manda, altrimenti per nome.
- **Cosa compare nell'elenco**: i piatti arrivati negli ultimi 30 giorni.
- **Cosa decide l'abbinamento**: costo e GP delle vendite, partita per categoria della ricetta, pulsante «i» sullo schermo e controllo degli allergeni.

## 7. Vendite

- **Scontrino pagato**: diventa una vendita del suo giorno di cucina (ora di Londra).
  - Conta una volta sola, anche se la cassa manda sia «pagamento» sia «ordine completato».
  - Il conto pagato in più volte conta una volta.
- **Rimborsi e storni dopo il pagamento** contano in negativo.
- **Andamento → Vendite**: una settimana con scontrini della cassa è **in sola lettura**, con il totale per piatto e per giorno, e sostituisce quella scritta a mano. La settimana scritta resta salvata sotto.
- **Cosa resta fuori**:
  - ciò che è segnato come «Non è cibo», per esempio le bevande, così il GP resta un GP food;
  - le comande di prova.
- **Piatti senza ricetta**: sono elencati e il link «Abbina i piatti» porta alle impostazioni.
- **Aggiornamento**: la pagina Andamento rilegge i dati ogni volta che si apre.

## 8. Permessi

| Permesso | Ruoli predefiniti |
| --- | --- |
| `orders.view` · Vedere e gestire le comande | Head office, area manager, GM, head chef, sous chef, chef de partie / commis (il proprietario ha tutto) |
| `orders.setup` · Collegare la cassa e configurare le partite | Head office, area manager, GM, head chef |
| `menus.edit` · Abbinare i piatti della cassa alle ricette | Chi modifica i menu |

L'aggiornamento del database (schema 2) ha dato questi permessi anche ai ruoli predefiniti delle compagnie già esistenti. I ruoli personalizzati vanno aggiornati a mano in Impostazioni → Ruoli e permessi.

## 9. Cosa manca

1. **Rilettura periodica dalla cassa**, per gli avvisi persi. Serve l'API della cassa, quindi si fa quando si sa quale cassa usano le sedi. Intanto, se un avviso non viene salvato, l'app risponde 500 e la cassa riprova.
2. **Magazzino teorico**: ogni piatto venduto scala gli ingredienti dalla giacenza della sede.
3. **Piatti esauriti**, segnalati in cucina e, se la cassa lo permette, bloccati anche in cassa.
4. **Prep list suggerite per giorno della settimana**, dalle vendite giornaliere che ora ci sono.
5. **Tempi di cucina**: tempo medio per piatto, partita e fascia oraria. I dati ci sono già: ora di arrivo, chi ha preso la comanda, ora delle righe pronte e della chiusura.
6. **Ritorno verso la cassa** (comanda pronta, piatto esaurito), se la cassa lo permette.
7. **Avvisi nel campanello**: comanda in ritardo, piatti della cassa da abbinare (vedi [AVVISI.md](AVVISI.md)).

## 10. Da verificare con il fornitore della cassa

- **Webhook per gli ordini mandati in cucina**, e non solo per gli scontrini pagati: senza questi le comande non arrivano, le vendite sì.
- **Righe nel webhook**: arrivano le righe con portate, varianti, note e allergie, o solo l'id dell'ordine? Nel secondo caso serve un servizio in mezzo (punto 3).
- **Prezzi**: in sterline o in centesimi?
- **Firma degli avvisi**: c'è? Con quale segreto?
- **Accesso**: il webhook è a pagamento o richiede un accordo da partner?
- **Sedi**: ogni sede ha un account o una postazione separati?
