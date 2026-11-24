# Funzioni di Recipe Studio

Stato all'11/11/2026. Questo documento elenca cosa fa oggi l'app, cosa resta da fare e i limiti noti. Per il codice vedi [ARCHITETTURA.md](ARCHITETTURA.md), per i dati [API.md](API.md), per i conti [CALCOLI.md](CALCOLI.md).

## Funzioni implementate

### Ricette

- Catalogo con ricerca su nome, descrizione, ingredienti, fornitori e allergeni; filtri per categoria (dentro un menu mostrano solo le categorie e i conteggi di quel menu, in "Tutte le ricette" tutte), ordinamento, pagine, vista a elenco (predefinita) o a schede.
- Scheda ricetta: ingredienti (prodotto, base o esterno) con quantità, unità, costo, allergeni e kcal; foto, metodo, MEP, impiattamento, note nutrizionali, controlli di sicurezza, attrezzature, giorni di conservazione.
- Costi: costo totale e per porzione, margine teorico, prezzo suggerito.
- Catalogo unico degli ingredienti: il magazzino. Gli ingredienti collegati a un prodotto prendono da lì prezzo, fornitore, allergeni e kcal, e si aggiornano in tutte le ricette quando il prodotto cambia. Un ingrediente che manca si aggiunge al magazzino dalla ricetta compilando la scheda prodotto completa (fornitore, misura, prezzo, contenuto, kcal, allergeni, livello minimo) senza uscire dalla ricetta; la ricetta si può salvare anche senza, e gli ingredienti non in magazzino restano nella campanella in alto a destra, da cui si aggiungono. La scheda prodotto mostra in quali ricette è usato.
- Allergeni del piatto: arrivano dagli ingredienti e dalle basi (la scheda Cucina & allergeni mostra quale ingrediente porta ogni allergene), più le tracce ("può contenere") scelte sul piatto. La cucina conferma il controllo con nome e data; se poi gli allergeni cambiano (ingrediente nuovo, prodotto o base modificati) il piatto torna "da ricontrollare". Le righe scritte a mano, non dal magazzino, sono segnalate.
- Basi e preparazioni riutilizzabili, collegabili come ingrediente di altre ricette.
- Creazione, modifica, duplicazione, eliminazione; ricetta creata dal magazzino scegliendo i prodotti.

### Menu

- Più menu nella stessa cucina (oggi: Main menu, Pizza menu, Sunday Roast Menu), ognuno con nome, descrizione, stato attivo o sospeso e piatti in ordine di servizio.
- Disponibilità di ogni menu: giorni della settimana e una o più fasce orarie (anche oltre la mezzanotte). La scheda del menu mostra quando è servito e se è disponibile in questo momento; senza giorni né orari il menu è sempre disponibile.
- Lo stesso piatto può stare in più menu; la scelta si fa dal menu o dalla scheda del piatto.
- Per ogni menu: piatti, costo e prezzo medi, food cost, margine medio, piatti senza prezzo.
- Per ogni menu: quanti piatti hanno gli allergeni da controllare, e la matrice allergeni da stampare (A4 orizzontale): un piatto per riga, i 14 allergeni in colonna, ● contiene, ○ può contenere, stato del controllo e avviso se qualche piatto non è controllato.
- Scorciatoia nella barra laterale per ogni menu attivo (con più menu, in un elenco a tendina sotto "Menu"); stampe e prezzi per un menu o per tutti i menu attivi.

### Prep list

- Prep list per data e per uno o più menu, con porzioni previste per piatto.
- "Genera dai piatti": una riga per ogni base usata dai piatti (quantità sommate e scalate sulle porzioni) e per ogni riga MEP; ogni riga indica i piatti a cui serve e la ricetta base da seguire.
- Righe a mano, quantità da fare (serve − pronto), note, spunta anche dalla pagina, duplicazione, stampa.
- "Porzioni dalle vendite": porzioni previste dalla media delle vendite delle ultime 4 settimane.
- Etichette da stampare: preparazione, data di preparazione, data di scadenza, chi l'ha preparata, allergeni della base, piatti.

### Food Stock

- Report di magazzino per periodo: apertura, fatture, consegnato, chiusura e valore per prodotto, totali per fornitore, GP. Bozza, invio, riapertura. Il riepilogo mostra anche gli sprechi del periodo.
- Consegne: fattura con numero, data, fornitore e righe; le quantità entrano nel report e nella giacenza; il prezzo del prodotto segue la fattura più recente. Collegamento al controllo all'arrivo.
- Scansione fattura: pulsante «Scansiona fattura» in Food Stock → Consegne e in Food safety → Consegne (computer: scegli una foto o un PDF dal disco, oppure trascinalo nella finestra della consegna) e in modalità cucina (telefono: fotocamera o file). Foto o PDF (fino a 5 pagine) letti dall'AI, che compila numero, data, fornitore, importo e righe. Ogni riga viene abbinata a un prodotto (✓ sicuro, ⚠ da verificare o con prezzo molto diverso, ＋ prodotto nuovo) e si salva solo dopo il tuo controllo. Le correzioni restano come nomi della fattura del prodotto, così la volta dopo l'abbinamento è automatico. Il servizio si sceglie con `INVOICE_READER` (oggi Gemini con `GEMINI_API_KEY`, gratuito nei limiti di Google AI Studio: l'app chiede a Google quali modelli Flash può usare la chiave e prova il più recente, poi il Flash-Lite se è sovraccarico; `GEMINI_MODEL` ne forza uno); senza chiave il pulsante non compare.
- Inventario: codice, livello minimo, giacenza, da riordinare, stato, costo e valore; colonne ordinabili e celle modificabili.

### Turni del personale

- Settimana corrente e tre successive modificabili, settimane passate in sola lettura.
- Una riga per ogni persona in organico; turni come `09:00-17:00`, anche oltre la mezzanotte o spezzati (`10:00-14:00, 18:00-22:00`); riposo e ferie.
- Ore per persona, per giorno e totali; costo per persona, costo giornaliero e costo della settimana.
- Salvataggio automatico, copia e incolla di una settimana, svuota, PDF, Excel, stampa.
- Le settimane della vecchia app Rota (Supabase) sono state importate.

### Personale (Impostazioni → Persone)

- Elenco del personale con nome, ruolo, paga oraria e "in organico"; aggiunta e rimozione solo da qui.
- Percentuale di contributi e oneri del datore di lavoro, aggiunta al costo del personale.

### Sicurezza alimentare

- Temperature di frigoriferi e congelatori, mattina e sera, con limiti per apparecchio.
- Cottura, abbattimento (con tempi), rigenerazione e mantenimento a caldo, collegati alla ricetta.
- Controllo della merce in arrivo: temperature, confezioni, scadenze, merce rifiutata; agganciato alle consegne di Food Stock.
- Checklist di apertura, chiusura e pulizie, con chi ha fatto ogni voce.
- Avviso dei controlli che mancano oggi; azione correttiva obbligatoria se un controllo è fuori limite; registro stampabile per periodo.
- Limiti e voci delle checklist modificabili (valori predefiniti UK Safer Food, Better Business).
- Foto delle temperature: accanto a ogni temperatura (frigoriferi, cotture, abbattimenti, consegne) si scatta la foto del termometro o del display. La foto viene ridotta sul telefono, salvata a parte (non rallenta l'app) e si apre dal registro con l'icona 📷. In Impostazioni della sicurezza alimentare si può rendere obbligatoria: senza foto la registrazione non si salva. Le foto sostituite o di registrazioni eliminate vengono cancellate.

### Andamento

- Riepilogo settimanale: vendite nette, GP teorico, GP reale dal report stock, sprechi, costo del personale (anche giorno per giorno), prime cost, con percentuali sulle vendite.
- Vendite per piatto inserite a mano o importate da un CSV della cassa.
- Registro degli sprechi con motivo, quantità e costo calcolato da prodotto o ricetta.
- Analisi del menu: star, cavallo da tiro, enigma, cane.

### Generale

- Impostazioni: valuta, lingua (italiano, inglese), regole del calcolo GP, personale, liste personalizzabili.
- Online su Vercel con database Neon; in locale anche su file JSON. Backup e importazione JSON, CSV delle ricette.
- **Più compagnie e sedi, account e ruoli** (con il database): ognuno entra con email e password (Better Auth). Una compagnia ha una o più sedi, raggruppabili in aree; la libreria di ricette e i prodotti sono della compagnia, una sede può avere ricette proprie, e menu, magazzino, prep list, turni, registri, sprechi e vendite sono di ogni sede. La sede si sceglie in alto nella barra laterale.
  - **Primo accesso**: i dati che esistevano prima degli account diventano la prima compagnia e la sua sede; li prende il primo account, che deve conoscere la vecchia password dell'app (`APP_PASSWORD`).
  - **Registrazione**: chiunque può creare una nuova compagnia (pagina "Crea una nuova compagnia"); parte vuota e ne diventa proprietario.
  - **Impostazioni → Persone**: in alto il personale (turni, paga, sedi; si salva con le impostazioni) con accanto l'account di ciascuno o il pulsante «Invita», sotto l'accesso all'app (si salva subito): persone con ruolo, sede o area e persona in organico collegata, inviti con link (14 giorni, una volta sola, facoltativamente legati a un'email), sedi e aree con il nome della compagnia, ruoli e permessi con una tabella da spuntare, registro delle attività (gruppo Compagnia, si salva subito). Ognuno vede solo le sezioni che il suo ruolo può usare; il gruppo Cucina (valuta, lingua, GP, personale, liste) solo chi gestisce le impostazioni della compagnia.
  - **Andamento → Confronto sedi** (head office e area manager, con più di una sede): vendite, GP teorico e reale, sprechi, personale, prime cost, anomalie HACCP e controlli da fare oggi delle ultime 4 settimane, sede per sede.
  - **Ruoli**: gli otto ruoli predefiniti di MULTI-AZIENDA.md, modificabili per ogni compagnia, più ruoli propri. Nessuno assegna un ruolo pari o superiore al proprio, né fuori dalle sedi in cui lavora.
  - **Permessi** controllati dal server su ogni operazione; quello che un ruolo non può vedere (prezzi e costi, paghe, turni degli altri) non arriva al browser e le cifre non compaiono.
  - **Isolamento tra compagnie su due livelli**: il codice filtra ogni lettura, e Postgres applica la row-level security con un ruolo limitato (`rs_tenant`).
  - **Personale tra sedi**: ogni persona ha le sedi in cui lavora; nei turni si vedono i suoi turni nelle altre sedi, con in rosso i giorni in cui lavora in due posti. Un account collegato a una persona vede i propri turni e firma i registri in modalità cucina con il proprio nome.
  - **Registro delle attività**: prezzi, turni, paghe, ruoli, permessi, incarichi, sedi. I registri HACCP corretti o eliminati conservano la copia precedente con chi e quando.
- Senza database (in locale) l'app resta una sola cucina, aperta o protetta dalla password condivisa.
- Interfaccia in italiano e inglese, pensata anche per il telefono: barra in basso con Ricette, Menu, Prep list, Sicurezza e "Altro" (tutte le altre pagine, i menu, la modalità cucina e le impostazioni), finestre a tutto schermo, testi e pulsanti più grandi, tabelle che scorrono nel loro riquadro. Si può aggiungere alla schermata Home del telefono o del tablet.
- Modalità cucina per tablet e telefono: si apre da sola su telefoni e tablet (schermi touch); se su un dispositivo si esce, quel dispositivo lo ricorda e si apre nell'app normale finché non si sceglie di nuovo Modalità cucina (barra laterale o "Altro"). Dal computer si apre dalla barra laterale → Modalità cucina, oppure con l'indirizzo `?cucina`: schermo intero con pulsanti grandi, ora e data, e chi sta lavorando scelto una volta sola, che firma ogni registrazione. Cinque schede con il conteggio di cosa manca: prep list di oggi (si spunta toccando la riga; senza liste di oggi mostra la più vicina), giro temperature mattina/sera (verde o rosso per apparecchio, tasto ± per i congelatori, azione correttiva se fuori limite) cottura, abbattimento, rigenerazione e mantenimento (con i piatti controllati di recente a un tocco), controllo merce in arrivo (parte dalle consegne di Food Stock ancora senza controllo; con "Scansiona fattura" si fotografa la fattura, si controllano le righe e la consegna salvata viene scelta subito per il controllo) e checklist apertura, chiusura e pulizie, che riprendono il record di oggi. Ogni temperatura ha la sua foto; i controlli di oggi si toccano per correggerli. Lo schermo resta acceso e il tablet riapre la modalità cucina finché non si esce.

## Da implementare

In ordine di utilità, secondo quanto discusso finora.

1. **Ordini ai fornitori.** Ordine suggerito per fornitore (sotto il livello minimo più il fabbisogno delle prossime prep list); scheda fornitore con contatti, giorni di consegna e orario limite; invio per email o WhatsApp; confronto tra ordinato e consegnato.
2. **Collegamento alla cassa e comande in cucina** (vedi [CASSA-E-COMANDE.md](CASSA-E-COMANDE.md)): la cassa di ogni sede manda ordini e scontrini via webhook; le comande compaiono in tempo reale in una pagina della modalità cucina (prendo, pronto, tempi, allergie in evidenza, partite e pass), e le vendite aggiornano GP, magazzino teorico, piatti esauriti e prep list.
3. **Più avvisi nel campanello** (vedi [AVVISI.md](AVVISI.md)): controlli HACCP di oggi non fatti, registri fuori limite senza azione, consegne senza controllo, allergeni da riconfermare, prodotti sotto il minimo o senza prezzo, ricette a costo zero, prezzi cambiati molto, turni e prep list mancanti; per ruolo, su tre livelli, e ognuno porta dove si risolve.
4. **Abbonamenti e vendita** (vedi [PIANO-VENDITA.md](PIANO-VENDITA.md)): Stripe, prova gratuita, limiti di scansione per sede, email di sistema per inviti e recupero password.
5. **Costi delle basi nei piatti.** Oggi una base collegata a un piatto ha quantità 0 e il suo costo non arriva al piatto: va collegato il costo per porzione o per kg della base.
6. **Scalare una ricetta** (per esempio da una dose a 3 kg) e stampare la scheda scalata.
7. **Storico dei prezzi** di prodotti e piatti.
8. **Chef special e menu stagionali**: piatti a tempo con data di inizio e fine.
9. **Turni legati alla persona invece che al nome**, così un cambio di nome non separa i turni già scritti.
10. **Vendite giornaliere** invece che settimanali, per suggerire la prep list per giorno della settimana: arrivano con il collegamento alla cassa (punto 2); senza cassa collegata, da CSV giornaliero.

## Dati da inserire

L'archivio online parte vuoto. Per avere numeri affidabili servono:

- **Prezzi dei prodotti** in Inventario (oggi tutti a 0) e **quantità degli ingredienti** nei piatti del Main menu (oggi 0): servono per costi, food cost, GP teorico, margini e analisi del menu.
- **IVA predefinita**: in Impostazioni → Calcolo GP è al 10%; nel Regno Unito per la ristorazione è al 20%.
- **Paga oraria** di ogni persona in Impostazioni → Persone.
- **Nomi degli apparecchi** in Sicurezza alimentare → Impostazioni sicurezza (oggi "Frigo 1", "Frigo 2", "Congelatore 1").
- **Giorni di conservazione** sulle ricette base, per le etichette.
- **Chef special** del Pizza menu, ancora senza ricetta.

## Limiti noti

- **Inviti solo con link**: non partono email; il link si copia e si manda a mano. Anche il recupero della password non è ancora attivo (serve un servizio email).
- **Indirizzi per sede** (`/compagnia/sede/...`) non ancora usati: la sede scelta resta nel browser.
- **Prezzi cambiati da chi non modifica le ricette** (per esempio un sous chef): i costi delle ricette si riallineano alla prossima apertura di chi può modificarle.
- **GP reale settimanale** approssimato: arriva dal report stock che copre più giorni della settimana.
- **Controllo all'arrivo aperto da una consegna** non provato, perché l'archivio non ha ancora consegne.
- **Vecchia app Rota** ancora attiva su Supabase: le modifiche fatte lì non arrivano qui.
