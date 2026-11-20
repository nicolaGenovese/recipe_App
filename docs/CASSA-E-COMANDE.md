# Proposta: collegamento alla cassa e comande in cucina

Stato: **proposta, da implementare** (20/11/2026). Descrive come collegare Recipe Studio alla cassa (EPOS) di ogni sede per ricevere ordini e vendite in tempo reale, e come mostrare le comande su uno schermo in cucina al posto, o accanto, della stampante delle comande.

## 1. In breve

- La cassa avvisa l'app con un **webhook** ogni volta che un ordine viene mandato in cucina, modificato, pagato o stornato.
- Le comande compaiono subito nella **pagina Comande**, aperta su un tablet o uno schermo in cucina: chi cucina le prende in carico e le segna come pronte.
- Gli scontrini pagati diventano **vendite**: GP del giorno, magazzino teorico, avvisi e prep list si aggiornano da soli.

## 2. Come arrivano i dati

### Collegamento

- In **Impostazioni → Integrazioni**, per ogni sede: si sceglie la cassa e si preme «Collega».
  - Casse con accesso tramite account (per esempio Square e Lightspeed): si entra nell'account della cassa e si autorizza Recipe Studio, senza copiare chiavi.
  - Altre casse: si genera una chiave API nel pannello della cassa e la si incolla una volta. La chiave resta solo sul server, mai nel browser.
- L'app indica alla cassa l'indirizzo a cui mandare gli avvisi, uno per sede, protetto da un segreto. Un avviso senza la firma giusta viene scartato.

### Cosa manda la cassa

| Evento | Cosa serve all'app |
| --- | --- |
| **Ordine mandato in cucina** | Tavolo o nome, coperti, cameriere, ora; righe con piatto, quantità, varianti («senza cipolla»), note e allergie; portata (antipasti, principali, dolci) |
| **Portata «via»** | Quando il cameriere chiede di far partire i principali |
| **Ordine modificato** | Righe aggiunte, tolte o cambiate dopo l'invio |
| **Scontrino pagato** | Righe vendute con prezzo, sconti, omaggi, IVA e servizio |
| **Storno o rimborso** | Righe annullate dopo l'invio o dopo il pagamento |

L'app non riceve mai dati di carte né dati personali dei clienti.

### Regole

- **Nessun doppione**: ogni avviso ha un identificativo, e lo stesso ordine o scontrino ricevuto due volte conta una volta sola.
- **Se un avviso si perde**, l'app chiede alla cassa ogni 10–15 minuti gli ordini e gli scontrini recenti, così niente resta fuori.
- **Una cassa per sede**: gli avvisi entrano nella sede collegata e la row-level security li tiene nella sua compagnia.

## 3. Pagina Comande (cucina)

Una nuova scheda della **modalità cucina**, pensata per un tablet o uno schermo fisso al pass o alle partite.

### Cosa si vede

- **Una scheda per comanda**: tavolo, coperti, ora di arrivo e da quanti minuti aspetta. Il bordo diventa ambra e poi rosso oltre i tempi impostati (per esempio 10 e 15 minuti).
- **Righe divise per portata**, con le varianti in evidenza e le **allergie in rosso in alto**, ben visibili.
- **Portate in attesa** ingrigite finché il cameriere non le manda «via» dalla cassa.
- **Modifiche e storni** segnati sulla scheda («+1 patatine», piatto barrato), con un suono, perché chi cucina non li perda.
- **Toccando un piatto** si apre la sua ricetta: metodo, impiattamento, foto, allergeni.

### Cosa si fa

- **Prendo io**: la comanda passa a «in preparazione» con il nome di chi l'ha presa, quello scelto in modalità cucina.
- **Pronto** (bump): sparisce dallo schermo; si può richiamare l'ultima per errore.
- **Pronto per riga**, per chi lavora a partite: la comanda è pronta quando lo sono tutte le righe.
- Facoltativo, se la cassa lo permette: avvisare la sala che il tavolo è pronto.

### Partite e pass

- Ogni categoria di piatti va a una **partita**: griglia, friggitrice, dolci, freddi. La configurazione è nelle impostazioni della sede.
- **Vista partita**: un tablet vede solo le righe della sua partita.
- **Vista pass**: il capo cucina vede le comande intere e chiama i tavoli.

### Affidabilità

- Lo schermo si aggiorna da solo in pochi secondi, senza ricaricare. Per farlo serve un canale in tempo reale: un servizio dedicato, oppure Neon Realtime. Vercel da solo non tiene aperte connessioni lunghe.
- Lo schermo resta acceso, come già succede in modalità cucina.
- **Se la connessione cade**, la pagina lo dice chiaramente e la stampante delle comande resta la riserva. All'inizio conviene tenerla accesa in parallelo, finché la cucina non si fida dello schermo.

## 4. Vendite e cosa si aggiorna

- **Abbinamento piatti**: «BURGER CHK» in cassa diventa «Chicken Burger» in Recipe Studio. L'app propone l'abbinamento per nome o codice PLU, chi gestisce il menu conferma, e l'abbinamento viene ricordato, come i nomi delle fatture. I piatti non abbinati restano in un elenco da sistemare.
- **Vendite giornaliere** invece che settimanali, con le righe piatto per piatto: sostituiscono l'inserimento a mano e il CSV, che resta come riserva.
- **Andamento in diretta**: vendite, GP teorico, costo del personale sulle vendite, anche nel confronto tra sedi.
- **Magazzino teorico**: ogni piatto venduto scala gli ingredienti dalla giacenza della sede, con avviso sotto il livello minimo e ordini ai fornitori più precisi.
- **Piatti esauriti**: quando una base finisce, il piatto viene segnalato in cucina e, se la cassa lo permette, bloccato anche in cassa.
- **Prep list suggerite per giorno della settimana**, dalle vendite vere.
- **Tempi di cucina**: tempo medio per piatto, partita e fascia oraria, dalle comande prese e segnate pronte.

## 5. Permessi

Nuovi permessi nella tabella dei ruoli:

| Permesso | Ruoli predefiniti |
| --- | --- |
| Vedere e gestire le comande | tutti i ruoli di cucina, compreso il commis |
| Collegare la cassa e configurare le partite | GM e head chef in su |
| Abbinare i piatti della cassa alle ricette | chi modifica i menu |

## 6. Da verificare con il fornitore della cassa

- La cassa ha i **webhook** per gli ordini mandati in cucina, e non solo per gli scontrini pagati? Senza questi la pagina Comande non è possibile; le vendite sì, con la lettura ogni pochi minuti.
- Negli avvisi arrivano **portate, varianti, note e allergie**?
- Si possono rimandare alla cassa lo stato «pronto» o un piatto esaurito?
- L'accesso all'API è **a pagamento** o richiede un **accordo da partner**?
- Ogni sede ha un **account o una postazione** separati?

## 7. Ordine di lavoro

1. **Collegamento e vendite**: scontrini pagati e storni via webhook, abbinamento piatti, vendite giornaliere. Questo è già utile per il GP in diretta.
2. **Pagina Comande**: ordini mandati in cucina, schede, prendo/pronto, tempi, con la stampante ancora accesa come riserva.
3. **Partite e pass**, modifiche e storni sulle schede, suoni.
4. **Magazzino teorico**, piatti esauriti, prep list suggerite, tempi di cucina.
5. **Ritorno verso la cassa** (pronto, esaurito), se la cassa lo permette.

## 8. Da decidere

- **Quale cassa** usano le sedi di oggi; se sedi diverse usano casse diverse, si valuta un connettore che unisce più casse.
- **Schermi in cucina**: un tablet al pass, uno per partita, o uno schermo grande.
- **Tempi di allarme** delle comande (ambra e rosso), per sede o per portata.
- Se tenere la **stampante delle comande** sempre, o solo come riserva quando la connessione cade.
