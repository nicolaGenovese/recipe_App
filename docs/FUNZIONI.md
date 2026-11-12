# Funzioni di Recipe Studio

Stato all'11/11/2026. Questo documento elenca cosa fa oggi l'app, cosa resta da fare e i limiti noti. Per il codice vedi [ARCHITETTURA.md](ARCHITETTURA.md), per i dati [API.md](API.md), per i conti [CALCOLI.md](CALCOLI.md).

## Funzioni implementate

### Ricette

- Catalogo con ricerca su nome, descrizione, ingredienti, fornitori e allergeni; filtri per categoria, ordinamento, pagine, vista a schede o a elenco.
- Scheda ricetta: ingredienti (prodotto, base o esterno) con quantità, unità, costo, allergeni e kcal; foto, metodo, MEP, impiattamento, note nutrizionali, controlli di sicurezza, attrezzature, giorni di conservazione.
- Costi: costo totale e per porzione, margine teorico, prezzo suggerito. Gli ingredienti collegati a un prodotto seguono il suo prezzo.
- Basi e preparazioni riutilizzabili, collegabili come ingrediente di altre ricette.
- Creazione, modifica, duplicazione, eliminazione; ricetta creata dal magazzino scegliendo i prodotti.

### Menu

- Più menu nella stessa cucina (oggi: Main menu, Pizza menu, Sunday Roast Menu), ognuno con nome, descrizione, stato attivo o sospeso e piatti in ordine di servizio.
- Lo stesso piatto può stare in più menu; la scelta si fa dal menu o dalla scheda del piatto.
- Per ogni menu: piatti, costo e prezzo medi, food cost, margine medio, piatti senza prezzo.
- Scorciatoia nella barra laterale per ogni menu attivo; stampe e prezzi per un menu o per tutti i menu attivi.

### Prep list

- Prep list per data e per uno o più menu, con porzioni previste per piatto.
- "Genera dai piatti": una riga per ogni base usata dai piatti (quantità sommate e scalate sulle porzioni) e per ogni riga MEP; ogni riga indica i piatti a cui serve e la ricetta base da seguire.
- Righe a mano, quantità da fare (serve − pronto), note, spunta anche dalla pagina, duplicazione, stampa.
- "Porzioni dalle vendite": porzioni previste dalla media delle vendite delle ultime 4 settimane.
- Etichette da stampare: preparazione, data di preparazione, data di scadenza, chi l'ha preparata, allergeni della base, piatti.

### Food Stock

- Report di magazzino per periodo: apertura, fatture, consegnato, chiusura e valore per prodotto, totali per fornitore, GP. Bozza, invio, riapertura. Il riepilogo mostra anche gli sprechi del periodo.
- Consegne: fattura con numero, data, fornitore e righe; le quantità entrano nel report e nella giacenza; il prezzo del prodotto segue la fattura più recente. Collegamento al controllo all'arrivo.
- Inventario: codice, livello minimo, giacenza, da riordinare, stato, costo e valore; colonne ordinabili e celle modificabili.

### Turni del personale

- Settimana corrente e tre successive modificabili, settimane passate in sola lettura.
- Una riga per ogni persona in organico; turni come `09:00-17:00`, anche oltre la mezzanotte o spezzati (`10:00-14:00, 18:00-22:00`); riposo e ferie.
- Ore per persona, per giorno e totali; costo per persona, costo giornaliero e costo della settimana.
- Salvataggio automatico, copia e incolla di una settimana, svuota, PDF, Excel, stampa.
- Le settimane della vecchia app Rota (Supabase) sono state importate.

### Personale (Impostazioni → Personale)

- Elenco del personale con nome, ruolo, paga oraria e "in organico"; aggiunta e rimozione solo da qui.
- Percentuale di contributi e oneri del datore di lavoro, aggiunta al costo del personale.

### Sicurezza alimentare

- Temperature di frigoriferi e congelatori, mattina e sera, con limiti per apparecchio.
- Cottura, abbattimento (con tempi), rigenerazione e mantenimento a caldo, collegati alla ricetta.
- Controllo della merce in arrivo: temperature, confezioni, scadenze, merce rifiutata; agganciato alle consegne di Food Stock.
- Checklist di apertura, chiusura e pulizie, con chi ha fatto ogni voce.
- Avviso dei controlli che mancano oggi; azione correttiva obbligatoria se un controllo è fuori limite; registro stampabile per periodo.
- Limiti e voci delle checklist modificabili (valori predefiniti UK Safer Food, Better Business).

### Andamento

- Riepilogo settimanale: vendite nette, GP teorico, GP reale dal report stock, sprechi, costo del personale (anche giorno per giorno), prime cost, con percentuali sulle vendite.
- Vendite per piatto inserite a mano o importate da un CSV della cassa.
- Registro degli sprechi con motivo, quantità e costo calcolato da prodotto o ricetta.
- Analisi del menu: star, cavallo da tiro, enigma, cane.

### Generale

- Impostazioni: valuta, lingua (italiano, inglese), regole del calcolo GP, personale, liste personalizzabili.
- Archivio su file JSON locale o su Neon Postgres; backup e importazione JSON, CSV delle ricette.
- Interfaccia in italiano e inglese, utilizzabile anche da telefono (barra laterale a icone).

## Da implementare

In ordine di utilità, secondo quanto discusso finora.

1. **Ordini ai fornitori.** Ordine suggerito per fornitore (sotto il livello minimo più il fabbisogno delle prossime prep list); scheda fornitore con contatti, giorni di consegna e orario limite; invio per email o WhatsApp; confronto tra ordinato e consegnato.
2. **Più compagnie e sedi, utenti e ruoli.** Compagnie con più ristoranti o pub, login, gerarchia dal head office al kitchen porter e permessi per sede. Necessario prima di usare l'app fuori dalla rete del locale. Proposta completa in [MULTI-AZIENDA.md](MULTI-AZIENDA.md).
3. **Modalità cucina per tablet.** Pulsanti grandi, solo prep list, temperature e checklist del giorno.
4. **Costi delle basi nei piatti.** Oggi una base collegata a un piatto ha quantità 0 e il suo costo non arriva al piatto: va collegato il costo per porzione o per kg della base.
5. **Scalare una ricetta** (per esempio da una dose a 3 kg) e stampare la scheda scalata.
6. **Storico dei prezzi** di prodotti e piatti.
7. **Chef special e menu stagionali**: piatti a tempo con data di inizio e fine.
8. **Turni legati alla persona invece che al nome**, così un cambio di nome non separa i turni già scritti.
9. **Vendite giornaliere** invece che settimanali, per suggerire la prep list per giorno della settimana.
10. **Allergeni completi sui piatti del Main menu** e matrice allergeni per menu da stampare.

## Dati da completare

Senza questi dati alcuni calcoli restano a zero o falsati.

- **Prezzi dei prodotti** in Inventario (oggi tutti a 0) e **quantità degli ingredienti** nei piatti del Main menu (oggi 0): servono per costi, food cost, GP teorico, margini e analisi del menu.
- **IVA predefinita**: in Impostazioni → Calcolo GP è al 10%; nel Regno Unito per la ristorazione è al 20%.
- **Paga oraria** di ogni persona in Impostazioni → Personale.
- **Nomi degli apparecchi** in Sicurezza alimentare → Impostazioni sicurezza (oggi "Frigo 1", "Frigo 2", "Congelatore 1").
- **Giorni di conservazione** sulle ricette base, per le etichette.
- **Chef special** del Pizza menu, ancora senza ricetta.

## Limiti noti

- **Nessun login**: chiunque raggiunga l'indirizzo dell'app può vedere e modificare tutto. Va usata solo sul computer del locale o in una rete fidata.
- **Neon non provato** con un database reale: le tabelle si creano da sole, ma l'archivio in uso è il file locale.
- **GP reale settimanale** approssimato: arriva dal report stock che copre più giorni della settimana.
- **Controllo all'arrivo aperto da una consegna** non provato, perché l'archivio non ha ancora consegne.
- **Vecchia app Rota** ancora attiva su Supabase: le modifiche fatte lì non arrivano qui.
- **Server legato alla sessione**: se l'app è stata avviata da Claude, si ferma alla chiusura della sessione; altrimenti si avvia con `npm start`.
- **Nessun controllo di versione**: la cartella non è un repository git; i backup dei dati sono in `data/backups/`.
