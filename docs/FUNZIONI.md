# Funzioni di Recipe Studio

Stato al 25/11/2026. Questo documento elenca cosa fa oggi l'app, cosa resta da fare, i dati da inserire e i limiti noti. Per il codice vedi [ARCHITETTURA.md](ARCHITETTURA.md), per le API e i dati [API.md](API.md), per i conti [CALCOLI.md](CALCOLI.md), per la struttura del database [schema-database.pdf](schema-database.pdf).

## Funzioni implementate

### Ricette

- Catalogo con ricerca su nome, descrizione, ingredienti, fornitori e allergeni; filtri per categoria (dentro un menu mostrano solo le categorie e i conteggi di quel menu, in «Ricette» tutte), ordinamento, pagine, vista a elenco (predefinita) o a schede.
- Scheda ricetta: ingredienti (prodotto, base o esterno) con quantità, unità, costo, allergeni e kcal; foto, metodo, MEP, impiattamento, note nutrizionali, controlli di sicurezza, attrezzature, giorni di conservazione.
- Costi: costo totale e per porzione, margine teorico, prezzo suggerito.
- Catalogo unico degli ingredienti: il magazzino. Gli ingredienti collegati a un prodotto prendono da lì prezzo, fornitore, allergeni e kcal, e si aggiornano in tutte le ricette quando il prodotto cambia. Un ingrediente che manca si aggiunge al magazzino dalla ricetta compilando la scheda prodotto completa (fornitore, misura, prezzo, contenuto, kcal, allergeni, livello minimo) senza uscire dalla ricetta; la ricetta si può salvare anche senza, e gli ingredienti non in magazzino restano nella campanella in alto a destra, da cui si aggiungono. La scheda prodotto mostra in quali ricette è usato.
- Allergeni del piatto: l'unica fonte è il prodotto del magazzino. Arrivano dagli ingredienti e dalle basi (la scheda Cucina & allergeni mostra quale ingrediente porta ogni allergene) e non si tolgono dalla ricetta.
  - **Tracce** ("può contenere"): dall'etichetta del prodotto, ereditate da tutti i piatti che lo usano (anche attraverso le basi), più quelle aggiunte in cucina (friggitrice in comune, stesse superfici); le tracce ereditate non si tolgono.
  - **Allergeni controllati**: ogni prodotto ha la spunta «Allergeni controllati sull'etichetta», da mettere anche quando non ne ha. I prodotti nuovi (dalla scheda, dalla ricetta o dalla scansione di una fattura) nascono da controllare; quelli che esistevano prima contano come controllati.
  - **Conferma del piatto** con nome e data, possibile solo quando tutti gli ingredienti vengono dal magazzino con gli allergeni controllati; altrimenti il piatto è "da verificare". Se poi gli allergeni o le tracce cambiano (ingrediente nuovo, prodotto o base modificati), torna "da ricontrollare".
  - **Campanello**: piatti da riconfermare e prodotti con gli allergeni da controllare, prima degli ingredienti non nel magazzino.
- Basi e preparazioni riutilizzabili, collegabili come ingrediente di altre ricette.
- Creazione, modifica, duplicazione, eliminazione; ricetta creata dal magazzino scegliendo i prodotti.

### Menu

- Più menu per sede (oggi: Main menu, Pizza menu, Sunday Roast Menu), ognuno con nome, descrizione, stato attivo o sospeso e piatti in ordine di servizio.
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
- Le settimane della vecchia app Rota (Supabase) si possono importare così come sono: usano gli stessi valori dei turni.

### Personale (Impostazioni → Persone)

- Elenco del personale della compagnia con nome, ruolo, paga oraria, "in organico" e sedi in cui lavora (nessuna sede = tutte); aggiunta e rimozione solo da qui.
- Accanto a ogni persona il suo account nell'app, oppure il pulsante «Invita» che prepara il link d'invito per lei.
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
- Vendite per piatto: dalla cassa collegata (in sola lettura, per piatto e per giorno), oppure inserite a mano o importate da un CSV della cassa. La pagina rilegge i dati ogni volta che si apre.
- Registro degli sprechi con motivo, quantità e costo calcolato da prodotto o ricetta.
- Analisi del menu: star, cavallo da tiro, enigma, cane.

### Cassa e comande

Guida completa in [CASSA-E-COMANDE.md](CASSA-E-COMANDE.md).

- **Collegamento a qualsiasi cassa con webhook**: in Impostazioni → Cassa e comande ogni sede crea il suo indirizzo e lo incolla nella cassa (o in Zapier, Make, n8n). Il lettore riconosce da solo i formati più comuni (nello stile di Square, Toast, Deliverect e altri) e un formato consigliato documentato; firma HMAC facoltativa; doppioni scartati; ultimi avvisi ricevuti con il contenuto, per controllare una cassa nuova; comanda di prova.
- **Schermi delle comande** in modalità cucina → Comande: una scheda per comanda con tavolo, coperti, minuti di attesa (bordo ambra e rosso), allergie in rosso in alto, righe per portata con varianti e note, portate in attesa finché non vanno «via», modifiche e annullamenti della cassa segnati con un suono. Prendo io, pronto per riga o per partita, chiusura al pass, richiama l'ultima. «i» apre la ricetta del piatto; se la ricetta contiene un'allergia della comanda il piatto è bordato di rosso.
- **Più schermi e partite**: ogni schermo mostra tutte le comande (pass) o solo le righe di una partita (per categoria della ricetta o della cassa, portata, nome o PLU), si aggiorna ogni 3 secondi, ha la modalità «Solo comande» a schermo intero e si fissa con un indirizzo come `?comande&partita=Forno`. Se la connessione cade, lo dice.
- **Vendite dalla cassa**: gli scontrini pagati diventano le vendite della settimana (rimborsi e storni in negativo, bevande escluse con «Non è cibo»), con i piatti della cassa abbinati alle ricette per nome o a mano.

### Generale

- Impostazioni in due gruppi. **Cucina**: valuta, lingua (italiano, inglese), regole del calcolo GP, liste personalizzabili. **Compagnia**: Persone, Sedi e aree, Ruoli e permessi, Registro attività. Senza account Persone sta nel gruppo Cucina.
- Online su Vercel con database Neon; in locale anche su file JSON. Backup e importazione JSON, CSV delle ricette.
- **Più compagnie e sedi, account e ruoli** (con il database): ognuno entra con email e password (Better Auth). Una compagnia ha una o più sedi, raggruppabili in aree; la libreria di ricette e i prodotti sono della compagnia, una sede può avere ricette proprie, e menu, magazzino, prep list, turni, registri, sprechi e vendite sono di ogni sede. La sede si sceglie in alto nella barra laterale.
  - **Primo accesso**: i dati che esistevano prima degli account diventano la prima compagnia e la sua sede; li prende il primo account, che deve conoscere la vecchia password dell'app (`APP_PASSWORD`).
  - **Registrazione**: chiunque può creare una nuova compagnia (pagina "Crea una nuova compagnia"); parte vuota e ne diventa proprietario.
  - **Impostazioni → Persone**: in alto il personale (paga, sedi; si salva con «Salva impostazioni») con l'account di ciascuno o il pulsante «Invita»; sotto l'accesso all'app (si salva subito): persone con ruolo, sede o area e persona in organico collegata, inviti con link (14 giorni, una volta sola, facoltativamente legati a un'email).
  - **Impostazioni → Sedi e aree, Ruoli e permessi, Registro attività** (si salvano subito): nome della compagnia, sedi e aree; ruoli con una tabella dei permessi da spuntare; chi ha cambiato prezzi, turni, paghe, ruoli e incarichi. Ognuno vede solo le sezioni che il suo ruolo può usare; il gruppo Cucina solo chi gestisce le impostazioni della compagnia.
  - **Andamento → Confronto sedi** (head office e area manager, con più di una sede): vendite, GP teorico e reale, sprechi, personale, prime cost, anomalie HACCP e controlli da fare oggi delle ultime 4 settimane, sede per sede.
  - **Ruoli**: gli otto ruoli predefiniti di MULTI-AZIENDA.md, modificabili per ogni compagnia, più ruoli propri. Nessuno assegna un ruolo pari o superiore al proprio, né fuori dalle sedi in cui lavora.
  - **Permessi** controllati dal server su ogni operazione; quello che un ruolo non può vedere (prezzi e costi, paghe, turni degli altri) non arriva al browser e le cifre non compaiono.
  - **Isolamento tra compagnie su due livelli**: il codice filtra ogni lettura, e Postgres applica la row-level security con un ruolo limitato (`rs_tenant`).
  - **Personale tra sedi**: ogni persona ha le sedi in cui lavora; nei turni si vedono i suoi turni nelle altre sedi, con in rosso i giorni in cui lavora in due posti. Un account collegato a una persona vede i propri turni e firma i registri in modalità cucina con il proprio nome.
  - **Registro delle attività**: prezzi, turni, paghe, ruoli, permessi, incarichi, sedi. I registri HACCP corretti o eliminati conservano la copia precedente con chi e quando.
- Senza database (in locale) l'app resta una sola cucina, aperta o protetta dalla password condivisa.
- **Barra laterale**, nell'ordine del lavoro: Ingredienti (l'inventario di Food Stock), Ricette base, Ricette, Menu, Prep list, Sicurezza alimentare, Food Stock, Andamento; in fondo Turni, modalità cucina e impostazioni. Dall'inventario, «Ingredienti» resta evidenziato; «Food Stock» apre report e consegne.
- **Accessibilità** (WCAG 2.2 AA): tutto si usa anche da tastiera, con un anello blu ben visibile sul controllo attivo e «Vai al contenuto» al primo Tab; testi almeno di 12 px e colori con contrasto sufficiente, anche per i bordi dei campi; finestre che ricevono e restituiscono il focus e chiedono prima di chiudere con modifiche non salvate (anche chiudendo la pagina); messaggi d'errore letti dagli screen reader e che restano finché non si chiudono; schede e voci di menu che dicono quale è attiva; niente animazioni per chi le ha disattivate nel sistema.
- **Archivio non raggiungibile**: se all'apertura i dati non arrivano, l'app lo dice e offre «Riprova», invece di mostrare una cucina vuota.
- Interfaccia in italiano e inglese, pensata anche per il telefono: barra in basso con Ricette, Menu, Prep list, Sicurezza e "Altro" (tutte le altre pagine, i menu, la modalità cucina e le impostazioni), finestre a tutto schermo, testi e pulsanti più grandi, tabelle che scorrono nel loro riquadro. Si può aggiungere alla schermata Home del telefono o del tablet.
- Modalità cucina per tablet e telefono: si apre da sola su telefoni e tablet (schermi touch); se su un dispositivo si esce, quel dispositivo lo ricorda e si apre nell'app normale finché non si sceglie di nuovo Modalità cucina (barra laterale o "Altro"). Dal computer si apre dalla barra laterale → Modalità cucina, oppure con l'indirizzo `?cucina`: schermo intero con pulsanti grandi, ora e data, e chi sta lavorando scelto una volta sola, che firma ogni registrazione. Su telefono e tablet si apre su una pagina con un pulsante grande per sezione, tutti visibili senza scorrere: icona, nome e stato in parole («2 da fare», «Tutto fatto», «5 aperte»), con il bordo rosso dove c'è da fare. Toccandolo si apre la sezione; «Sezioni» in alto, o il tasto Indietro del telefono, riporta alla pagina. Sul computer le sezioni sono schede in alto. Le sezioni sono cinque (sei con le Comande, per chi le vede): prep list di oggi (si spunta toccando la riga; senza liste di oggi mostra la più vicina), giro temperature mattina/sera (verde o rosso per apparecchio, tasto ± per i congelatori, azione correttiva se fuori limite) cottura, abbattimento, rigenerazione e mantenimento (con i piatti controllati di recente a un tocco), controllo merce in arrivo (parte dalle consegne di Food Stock ancora senza controllo; con "Scansiona fattura" si fotografa la fattura, si controllano le righe e la consegna salvata viene scelta subito per il controllo) e checklist apertura, chiusura e pulizie, che riprendono il record di oggi. Ogni temperatura ha la sua foto; i controlli di oggi si toccano per correggerli. Lo schermo resta acceso e il tablet riapre la modalità cucina finché non si esce.

## Da implementare

In ordine di utilità, secondo quanto discusso finora.

1. **Ordini ai fornitori.** Ordine suggerito per fornitore (sotto il livello minimo più il fabbisogno delle prossime prep list); scheda fornitore con contatti, giorni di consegna e orario limite; invio per email o WhatsApp; confronto tra ordinato e consegnato.
2. **Cassa, passi successivi** (vedi [CASSA-E-COMANDE.md](CASSA-E-COMANDE.md), punto 9): magazzino teorico dalle vendite, piatti esauriti, prep list suggerite per giorno della settimana, tempi di cucina, ritorno verso la cassa e rilettura periodica degli ordini quando si sa quale cassa usano le sedi.
3. **Più avvisi nel campanello** (vedi [AVVISI.md](AVVISI.md)): controlli HACCP di oggi non fatti, registri fuori limite senza azione, consegne senza controllo, allergeni da riconfermare, prodotti sotto il minimo o senza prezzo, ricette a costo zero, prezzi cambiati molto, turni e prep list mancanti; per ruolo, su tre livelli, e ognuno porta dove si risolve.
4. **Abbonamenti e vendita** (vedi [PIANO-VENDITA.md](PIANO-VENDITA.md)): Stripe, prova gratuita, limiti di scansione per sede, email di sistema per inviti e recupero password.
5. **Costi delle basi nei piatti.** Oggi una base collegata a un piatto ha quantità 0 e il suo costo non arriva al piatto: va collegato il costo per porzione o per kg della base.
6. **Scalare una ricetta** (per esempio da una dose a 3 kg) e stampare la scheda scalata.
7. **Storico dei prezzi** di prodotti e piatti.
8. **Chef special e menu stagionali**: piatti a tempo con data di inizio e fine.
9. **Turni legati alla persona invece che al nome**, così un cambio di nome non separa i turni già scritti.
10. **Vendite giornaliere senza cassa collegata**, da CSV giornaliero; con la cassa collegata ci sono già, giorno per giorno.

## Dati da inserire

Situazione dell'archivio online al 24/11/2026. Per avere numeri affidabili servono:

- **Prezzi dei prodotti**: 53 prodotti su 145 sono ancora senza prezzo in Inventario.
- **Quantità degli ingredienti**: 39 ricette hanno tutte le quantità a 0, quindi costo zero. Servono per costi, food cost, GP teorico, margini e analisi del menu.
- **Personale**: l'elenco in Impostazioni → Persone è vuoto. Servono le persone con la paga oraria, per i turni, il costo del personale e le firme dei registri.
- **Allergeni dei prodotti**: i prodotti che esistevano prima della spunta «Allergeni controllati» contano come controllati. Conviene ricontrollarli sull'etichetta, a cominciare da quelli senza allergeni, e compilare il «può contenere».
- **Ingredienti scritti a mano**: quelli che non sono in magazzino (nel campanello) vanno aggiunti, altrimenti i piatti che li usano non si possono confermare.
- **Giorni di conservazione** sulle ricette base, per le etichette.
- **Chef special** del Pizza menu, ancora senza ricetta.
- **Cassa e comande**, quando si collega la cassa: le partite della cucina in Impostazioni → Cassa e comande, le categorie che non sono cibo (bevande), gli abbinamenti dei piatti della cassa alle ricette e il permesso delle comande nei ruoli personalizzati, se ce ne sono.

## Limiti noti

- **Inviti solo con link**: non partono email; il link si copia e si manda a mano. Anche il recupero della password non è ancora attivo (serve un servizio email).
- **Indirizzi per sede** (`/compagnia/sede/...`) non ancora usati: la sede scelta resta nel browser.
- **Prezzi cambiati da chi non modifica le ricette** (per esempio un sous chef): i costi delle ricette si riallineano alla prossima apertura di chi può modificarle.
- **GP reale settimanale** approssimato: arriva dal report stock che copre più giorni della settimana.
- **Prezzi di vendita uguali in tutte le sedi**: il prezzo sta sulla ricetta, che è della compagnia; un prezzo diverso per sede non si può ancora indicare.
- **Scansione fatture con Gemini gratuito**: la quota gratuita per modello è piccola. L'app passa da sola a un altro modello, ma per un uso quotidiano conviene attivare la fatturazione su Google AI Studio.
- **Vecchia app Rota** ancora attiva su Supabase: le modifiche fatte lì non arrivano qui.
- **Date «ultima modifica» delle ricette fino al 25/11/2026 non affidabili**: con il database online ogni apertura dell'app risalvava le ricette (corretto il 25/11/2026), quindi molte risultano modificate in date in cui nessuno le ha toccate. Da ora in poi la data cambia solo con una modifica vera.
- **Casse che nel webhook mandano solo l'id dell'ordine** (per esempio gli aggiornamenti degli ordini di Square): serve un servizio in mezzo che legga l'ordine e lo mandi completo. Un avviso perso non viene ancora recuperato rileggendo la cassa.
- **Schermi delle comande aggiornati ogni 3 secondi**, non all'istante: Vercel non tiene aperte connessioni lunghe. Senza cassa collegata né comande aperte controllano ogni minuto.
- **Database sempre sveglio con gli schermi accesi**: con la cassa collegata, uno schermo delle comande aperto interroga Neon ogni 3 secondi (15 se la pagina è nascosta), quindi il database non va in pausa. Sul piano gratuito di Neon le ore di calcolo finiscono se gli schermi restano accesi giorno e notte: a fine servizio conviene chiudere la pagina o spegnere lo schermo, oppure passare al piano a pagamento (fase 0 di PIANO-VENDITA.md).
