# Esempio: una Margherita dall'acquisto alla vendita

Il file [margherita-esempio.json](margherita-esempio.json) è un archivio di prova con una sola pizza, seguita in tutte le parti dell'app. Serve a capire come i dati passano da una pagina all'altra.

**Come caricarlo:** nell'app apri **Recipes** (Ricette), clicca **Import** e scegli il file. Gli id iniziano con `ex-`; reimportarlo aggiorna gli stessi record invece di crearne di nuovi. Le impostazioni dell'archivio (valuta GBP, IVA 20%, personale, frigoriferi) sostituiscono quelle attuali.

Date di riferimento: settimana dal 9 al 15 novembre 2026, oggi 13 novembre.

## 1. Il magazzino è il catalogo degli ingredienti

Food Stock → **Inventory**: 6 prodotti.

| Prodotto | Si compra come | Prezzo | Contenuto | Costo per unità ricetta | Allergeni |
| --- | --- | --- | --- | --- | --- |
| Pizza dough ball 250 g | box of 20 | £12,00 | 20 pz | £0,60 / pz | Glutine |
| Peeled tomatoes 2.5 kg tin | tin | £3,20 | 2,5 kg | £1,28 / kg | — |
| Mozzarella fior di latte | kg | £8,00 | 1 kg | £8,00 / kg | Latte |
| Fresh basil | bunch 30 g | £1,20 | 0,03 kg | £40,00 / kg | — |
| Extra virgin olive oil 5 l | 5 l tin | £35,00 | 5 l | £7,00 / l | — |
| Fine sea salt 1 kg | 1 kg bag | £0,80 | 1 kg | £0,80 / kg | — |

Costo per unità ricetta = prezzo ÷ contenuto. Le ricette leggono **solo** da qui prezzo, fornitore, allergeni e kcal. Nelle ricette i prodotti a kg o a litro si usano in **grammi** e **millilitri**: la mozzarella a £8/kg costa £0,008/g, e il cambio di unità è automatico.

## 2. La base: Tomato sauce

Recipes → **Tomato sauce (pizza)**: è una base (Base / preparazione), resa 36 porzioni da 70 g, conservazione 3 giorni.

| Ingrediente | Quantità | Costo |
| --- | --- | --- |
| Peeled tomatoes | 2.500 g × £0,00128 | £3,20 |
| Fine sea salt | 25 g × £0,0008 | £0,02 |
| Fresh basil | 10 g × £0,04 | £0,40 |
| Extra virgin olive oil | 50 ml × £0,007 | £0,35 |
| **Totale** | | **£3,97 → £0,11 a porzione** |

## 3. Il piatto: Margherita

Recipes → **Margherita**: 1 porzione, prezzo £11, IVA 20%.

| Ingrediente | Da dove | Quantità | Costo |
| --- | --- | --- | --- |
| Pizza dough ball | prodotto | 1 pz × £0,60 | £0,60 |
| Tomato sauce | **base** | 1 porz × £0,11 | £0,11 |
| Mozzarella | prodotto | 90 g × £0,008 | £0,72 |
| Fresh basil | prodotto | 2 g × £0,04 | £0,08 |
| Olive oil | prodotto | 6 ml × £0,007 | £0,04 |
| **Costo porzione** | | | **£1,55** |

- Prezzo netto = £11 ÷ 1,20 = £9,17.
- Margine teorico = (9,17 − 1,55) ÷ 9,17 = **83,1%** (food cost 16,9%).
- Allergeni del piatto = allergeni dei suoi ingredienti: **Glutine** (impasto) e **Latte** (mozzarella).

**Prova:** cambia il prezzo della mozzarella in Inventory (per esempio £9/kg). Il costo della Margherita sale da solo, e con lui margine, menu e riepilogo.

## 4. Il menu

Menus → **Pizza menu**, attivo, con la Margherita. La scheda del menu mostra piatti, costo medio, prezzo medio, food cost e margine medio. La stampa del menu e la matrice allergeni partono da qui.

## 5. La prep list

Prep lists → **Friday pizza prep**, 13 novembre, menu Pizza, porzioni previste: 40 Margherite.

| Preparazione | Da dove arriva | Serve / pronto / da fare | Per i piatti |
| --- | --- | --- | --- |
| Tomato sauce (pizza) | base della Margherita, 1 porz × 40 | 40 / 12 / **28 porz** | Margherita |
| Take the dough balls out… | riga MEP della Margherita | — (fatto) | Margherita |
| Pick basil leaves | riga MEP della Margherita | — | Margherita |
| Brush the oven floor | aggiunta a mano | — (fatto) | — |

"Genera dai piatti" crea queste righe dalle basi e dal MEP delle ricette. **Etichette** stampa la salsa con scadenza a 3 giorni.

## 6. Consegne e giacenza

Food Stock → **Deliveries**: due fatture del 12 novembre.

- **Dairy Co DC-2041:** 5 kg di mozzarella a £8.
- **Italian Foods IF-7781:** 3 box di impasto, 6 latte di pomodoro, 1 latta d'olio.

Le quantità ricevute entrano nella giacenza di Inventory; prezzo × giacenza dà il valore di magazzino. Basilico e sale sono sotto il livello minimo, quindi compaiono come **REORDER**.

## 7. Sicurezza alimentare

Food safety, 13 novembre:

- **Temperature del mattino** (Marco): 3 °C, 4 °C, −19 °C, tutte nei limiti.
- **Controllo all'arrivo** della consegna Dairy Co (Luca): refrigerati a 4 °C, collegato alla fattura DC-2041.
- **Temperatura al cuore** della Margherita (Sara): 92 °C, collegata alla ricetta.
- **Checklist di apertura** completa (Marco).

In cima restano "da fare": le temperature della sera e la checklist di chiusura.

## 8. Personale e turni

Impostazioni → **Personale**: Marco (Head chef, £15/h), Sara (Pizza chef, £12,50/h), Luca (KP, £11,44/h), con oneri del datore di lavoro al 13%.

**Rota**, settimana 9–15 novembre: 114 ore; costo = ore × paga × 1,13 = **£1.699,82**. La riga "Costo giornaliero" va da £0 il lunedì (tutti a riposo) a £441,22 il sabato.

## 9. Sprechi, vendite e riepilogo

- **Sprechi:** 2 impasti strappati (2 × £0,60, errore) e 0,3 kg di mozzarella scaduta (0,3 × £8): **£3,60**.
- **Vendite:** 650 Margherite nella settimana.
- **Performance → Riepilogo** della settimana:

| Voce | Calcolo | Risultato |
| --- | --- | --- |
| Vendite nette | 650 × £11 ÷ 1,20 | £5.958,33 |
| Costo teorico del cibo | 650 × £1,55 | £1.009 |
| GP teorico | (vendite − costo) ÷ vendite | 83,1% |
| Sprechi | | £3,60 (0,1%) |
| Costo del personale | dalla Rota | £1.699,82 (28,5%) |
| Prime cost | cibo teorico + personale | £2.708,82 (45,5%) |

Il **GP reale** compare quando si invia un report stock (Food Stock → Reports) che copre la settimana: confrontato con quello teorico mostra quanto si perde tra porzioni, sprechi non registrati e prezzi dei fornitori.

## Il flusso in una riga

Prodotto (prezzo, allergeni) → ricetta base → piatto (costo, margine, allergeni) → menu → prep list ed etichette → consegne e giacenza → controlli di sicurezza → turni e costo del personale → vendite e sprechi → riepilogo della settimana.
