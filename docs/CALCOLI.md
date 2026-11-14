# Regole di calcolo

Tutte le formule sono in `src/lib/` e coperte dai test (`npm test`).

## Costi delle ricette — `lib/recipes/math.ts`, `lib/stock/units.ts`

- Costo ricetta = somma di quantità × costo per unità di ogni ingrediente.
- Costo per porzione = costo ricetta ÷ porzioni.
- Margine teorico = (prezzo netto − costo per porzione) ÷ prezzo netto. Il prezzo netto è il prezzo di vendita diviso per (1 + IVA), oppure il prezzo così com'è se nelle impostazioni è disattivato **Margine sul prezzo al netto dell'IVA**.
- Prezzo suggerito = costo per porzione ÷ (1 − margine obiettivo), più IVA se il margine è sul netto.
- Un ingrediente collegato a un prodotto costa: prezzo del prodotto ÷ contenuto per unità di vendita, convertito nell'unità della ricetta.
- Peso e volume usano la stessa scala: 1 g = 1 ml, cl = 10, tsp = 5, tbsp = 15, oz = 28,35 g, lb = 453,6 g, fl oz = 28,41 ml, pint = 568,3 ml (misure UK). Le unità che non si convertono (per esempio pz verso kg) mantengono il costo scritto a mano, e la scheda segnala il costo incompleto.
- L'acqua non conta mai come costo mancante.

## Scheda prodotto: costo nelle ricette — `lib/stock/preview.ts`

- Costo per unità ricetta = prezzo per unità di vendita ÷ contenuto per unità di vendita, espresso nell'unità ricetta del prodotto. In ricetta i kg diventano g e i litri ml.
- La scheda mostra mentre scrivi: "1 unità di vendita = prezzo, contiene N unità → 1 unità = costo" e "In ricetta: 1 g = costo · 100 g = costo".
- **Avvisi:**
  - Measurement Kilo o Litre con unità ricetta g o ml e contenuto sotto 100: probabilmente doveva essere 1000. Il pulsante "Imposta contenuto 1000" lo corregge.
  - Più di £200 al kg o al litro: quasi sempre un errore di contenuto o di unità. Non blocca il salvataggio, perché zafferano o tartufo possono costare tanto.

## Catalogo ingredienti — `lib/recipes/catalog.ts`

Il magazzino (Inventario) è l'unico catalogo degli ingredienti. Una riga di ricetta dice solo quale prodotto o quale ricetta base usa, la quantità e l'unità.

- **Grammi e millilitri:** le ricette si scrivono in g e ml. Un prodotto contato in kg o l, collegato a una riga, entra in g o ml (90 g di mozzarella, non 0,09 kg). Cambiare l'unità di una riga converte la quantità (0,09 kg → 90 g); una riga vecchia in kg o l viene portata in g o ml alla prima sincronizzazione, con lo stesso costo.
- **Riga collegata a un prodotto:** nome, fornitore, allergeni, costo per unità e kcal vengono dal prodotto. Costo e kcal sono convertiti nell'unità della riga (un prodotto a £4/kg usato in g costa £0,004/g). Se le unità non si convertono, la riga tiene il costo e le kcal che aveva.
- **Riga collegata a una ricetta base:** con unità `porz`, il costo è il costo per porzione della base e le kcal quelle per porzione. Gli allergeni sono quelli della base.
- **Voce libera** (tipo Esterno, o un nome che non è a magazzino): costo, allergeni e kcal sono quelli scritti nella riga e valgono solo per quella ricetta. "+ Aggiungi al magazzino" apre sotto la riga la scheda prodotto completa, già compilata dalla riga: una riga in g diventa un prodotto a Kg con prezzo e kcal per kg (0,03 €/g → 30 €/kg). Creato il prodotto, la riga si collega; le altre ricette con lo stesso nome si collegano da sole. La ricetta si può salvare anche con voci non a magazzino (tranne Esterno e basi): l'avviso al salvataggio e la campanella in alto a destra le elencano con le ricette che le usano.
- **Sincronizzazione:** all'apertura dell'app e dopo ogni modifica di prodotti, consegne o ricette base, le ricette che non corrispondono al catalogo vengono aggiornate e salvate. Una riga vecchia senza collegamento, il cui nome coincide con un prodotto, viene collegata a quel prodotto.
- **Prodotto eliminato:** nelle ricette che lo usavano resta come voce libera con gli ultimi valori.

## Report Food Stock — `lib/stock/report.ts`

- Valore di una riga = quantità × prezzo. Con la misura **Pezzo**: pezzi ÷ pezzi per confezione × prezzo.
- Apertura = chiusura dell'ultimo report inviato. Senza report: il conteggio in Inventario, altrimenti la giacenza iniziale.
- Totale fatture = consegne registrate nel periodo + quantità aggiunte a mano in Qtà fattura. Se una consegna ha l'importo fattura, vale quello al posto del totale righe. Il campo si può sostituire con l'importo reale.
- Costo del venduto = apertura + fatture + trasferimenti − chiusura. I trasferimenti si possono escludere dalle impostazioni.
- Vendite nette = vendite inserite. Se le vendite sono inserite IVA inclusa: vendite ÷ (1 + IVA sulle vendite).
- GP = (vendite nette − costo del venduto) ÷ vendite nette.
- Il GP è verde se raggiunge l'obiettivo, rosso se è sotto. Con obiettivo 0 resta neutro.
- Un report inviato conserva le regole GP con cui è stato inviato; cambiare le impostazioni dopo non cambia il suo GP.

## Consegne — `lib/stock/deliveries.ts`

- Contano nel report tutte le consegne dopo la fine dell'ultimo report inviato e fino alla fine del periodo, così un buco tra due periodi non perde merce.
- Una consegna con data entro l'ultimo report inviato è chiusa: per modificarla bisogna riaprire il report.
- Se un prodotto è stato eliminato, il valore della sua consegna resta nel totale fatture.
- Con **Aggiorna il prezzo dei prodotti** attivo, il prezzo del prodotto diventa quello della fattura, a meno che esista una fattura più recente per lo stesso prodotto.

## Inventario — `lib/stock/inventory.ts`

- Giacenza attuale = chiusura dell'ultimo report inviato (o giacenza iniziale) + consegne successive.
- Un conteggio scritto in Inventario sostituisce questa base finché non viene inviato un nuovo report; da quel momento si sommano solo le consegne arrivate dopo il conteggio.
- Le fatture sono in unità di vendita: con la misura Pezzo la quantità ricevuta viene moltiplicata per i pezzi per confezione.
- Da riordinare = livello minimo − giacenza attuale, se positivo. Stato: RIORDINA, OK, oppure "—" senza livello minimo.
- I nuovi prodotti ricevono il codice successivo della serie ING (ING01, ING02…).

## Ricetta dal magazzino

- Disponibile = giacenza attuale in unità di vendita × contenuto per unità.
- Porzioni producibili = quante volte la giacenza copre la quantità scelta di ogni ingrediente (si prende il minimo) × porzioni della ricetta.
