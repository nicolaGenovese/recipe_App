# Proposta: avvisi del campanello

Stato: **proposta, in parte fatta** (22/11/2026, aggiornata il 25/11). Oggi il campanello in alto a destra avvisa di tre cose: allergeni da riconfermare, prodotti alimentari con gli allergeni da controllare sull'etichetta (mai quelli di pulizia o i materiali di consumo) e ingredienti scritti a mano nelle ricette e assenti dal magazzino. Qui c'è cosa aggiungere, dai dati che l'app ha già, e come mostrarlo.

## 1. Rosso: sicurezza alimentare (ogni giorno)

| # | Avviso | Da dove viene |
| --- | --- | --- |
| 1 | **Controlli di oggi non fatti**: giro temperature del mattino non registrato entro le 11, della sera entro le 22; checklist di apertura o chiusura mancanti | Gli stessi conteggi della barra «Da fare oggi» in Sicurezza alimentare |
| 2 | **Registrazioni fuori limite senza azione correttiva** | Registri con esito fuori limite e azione vuota |
| 3 | **Consegne senza controllo all'arrivo** | L'elenco già mostrato in modalità cucina |
| 4 | **Allergeni da riconfermare**: ricetta modificata dopo l'ultima conferma, o un prodotto usato che ha cambiato allergeni · **fatto** (24/11/2026), insieme ai prodotti con gli allergeni da controllare | Conferma allergeni della ricetta confrontata con gli allergeni di oggi |
| 5 | **Foto mancanti**, quando le foto delle temperature sono obbligatorie | Impostazioni sicurezza e registri di oggi |

## 2. Ambra: magazzino e costi

| # | Avviso | Da dove viene |
| --- | --- | --- |
| 6 | **Prodotti sotto il livello minimo** | Giacenza della sede e livello minimo |
| 7 | **Prodotti senza prezzo** (oggi una cinquantina): costi e GP non sono affidabili | Inventario |
| 8 | **Ricette con costo zero**, per esempio con le quantità degli ingredienti a 0 | Costo calcolato della ricetta |
| 9 | **Prezzo cambiato molto in una consegna** (oltre il 30%) | Controllo che lo scanner delle fatture già fa |
| 10 | **Piatti sotto il margine obiettivo** dopo un aumento di prezzo | Margine teorico e regole GP |
| 11 | **Report stock in bozza** non inviato a fine periodo | Report stock |

## 3. Ambra: prep e personale

| # | Avviso | Da dove viene |
| --- | --- | --- |
| 12 | **Nessuna prep list per domani**, dal pomeriggio | Prep list |
| 13 | **Turni della settimana prossima non ancora fatti**, dal giovedì | Turni |
| 14 | **Persona in due sedi lo stesso giorno** | Turni in altre sedi (oggi visibile solo nella pagina Turni) |
| 15 | **Personale senza paga oraria**: il costo del personale risulta sottostimato | Impostazioni → Persone |

## 4. Informazione: per chi gestisce

| # | Avviso | Da dove viene |
| --- | --- | --- |
| 16 | **Inviti in scadenza** non accettati, e **nuove persone entrate** con un invito | Inviti e incarichi |
| 17 | **Cambi di prezzi, paghe o ruoli fatti da altri** | Registro attività |
| 18 | **Head office**: sedi con controlli HACCP mancanti oggi, una riga per sede | Confronto sedi |

## 5. Con il collegamento alla cassa

Con la cassa e le comande ([CASSA-E-COMANDE.md](CASSA-E-COMANDE.md)) ci sono già i dati per altri avvisi:

| # | Avviso | Da dove viene |
| --- | --- | --- |
| 19 | **Comanda in ritardo**: aperta da più dei minuti del rosso | Comande aperte e minuti di allarme della sede |
| 20 | **Piatti della cassa da abbinare** alle ricette | Elenco in Impostazioni → Cassa e comande |
| 21 | **Avvisi della cassa non riconosciuti** o rifiutati per la firma | Ultimi avvisi ricevuti |
| 22 | **Nessun avviso dalla cassa** durante il servizio, quando di solito arrivano | Ultimi avvisi ricevuti e orari dei menu |

Piatto esaurito e ordine al fornitore da mandare prima dell'orario limite arriveranno con le funzioni che li calcolano (punto 9 di CASSA-E-COMANDE.md e ordini ai fornitori in FUNZIONI.md).

## 6. Come mostrarli

- **Per ruolo**, con i permessi che esistono già: il kitchen porter vede sicurezza e prep, il GM tutto della sua sede, l'head office il riepilogo delle sedi. Nessuno vede avvisi su cose che non può cambiare.
- **Tre livelli**: il numero rosso sul campanello conta solo gli avvisi rossi e quelli di oggi; gli altri sono nell'elenco, raggruppati per tipo, senza allarmare.
- **Ogni avviso porta dove si risolve**: «Temperature mattina» apre il giro temperature, «Prezzo +42%» apre il prodotto.
- **Gli avvisi informativi si chiudono**; quelli di sicurezza restano finché il problema non è risolto.
- **Più avanti**: notifiche sul telefono anche ad app chiusa, solo per gli avvisi rossi.

## 7. Da dove partire

Avvisi **1, 2, 3** (sicurezza), **6** (sotto il minimo) e **7–8** (prezzi mancanti e costi a zero): si calcolano con dati che l'app ha già, senza cambiare il database.
