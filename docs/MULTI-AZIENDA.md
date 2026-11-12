# Proposta: più compagnie, più sedi, account e permessi

Stato: **proposta, non ancora implementata** (12/11/2026). Descrive come trasformare Recipe Studio da app per una sola cucina ad app per più compagnie, ognuna con più ristoranti o pub, con account e permessi dal head office fino ai kitchen porter. Le scelte segnate come "da decidere" sono in fondo.

## 1. Struttura: compagnia → area → sede

```
Compagnia (es. Nine Elms Group)
 ├─ Area / regione  (facoltativa: "Londra Sud", "Kent")
 │   ├─ Sede: Nine Elms Tavern  (pub)
 │   └─ Sede: Battersea Kitchen (ristorante)
 └─ Sede senza area
```

Ogni dato appartiene alla compagnia o a una sola sede:

| Livello | Dati |
| --- | --- |
| **Compagnia** | Libreria di ricette e basi, allergeni, fornitori e listini, modelli di menu e di checklist, regole GP, ruoli, utenti |
| **Sede** | Menu attivi e prezzi locali, magazzino, consegne, report stock, prep list, turni, sicurezza alimentare, sprechi, vendite, apparecchi da controllare |

- Le **ricette** stanno a livello di compagnia: l'head office definisce lo standard una volta sola.
- Ogni **sede** ha i suoi menu: pescano dalla libreria e possono avere prezzi locali o piatti propri.
- I **dati operativi** (turni, stock, registri HACCP, vendite, sprechi) appartengono sempre a una sola sede.

## 2. Utenti, persone in organico e incarichi

Tre concetti distinti:

- **Utente**: chi fa login (email e password). Un solo account anche se lavora per più compagnie.
- **Persona in organico**: chi compare nei Turni, con paga e ruolo. Può non avere un account; se ce l'ha, si collega all'utente.
- **Incarico**: utente + ruolo + ambito (compagnia, area o sede). Una persona può averne più di uno, per esempio head chef in una sede e sous chef in un'altra.

### Ruoli predefiniti

| Livello | Ruolo | Ambito tipico |
| --- | --- | --- |
| 1 | Proprietario / Head office admin | Compagnia |
| 2 | Operations, Finance, Executive chef | Compagnia |
| 3 | Area manager | Area |
| 4 | General manager | Sede |
| 5 | Head chef | Sede |
| 6 | Sous chef | Sede |
| 7 | Chef de partie / Commis | Sede |
| 8 | Kitchen porter | Sede |

## 3. Permessi

Un permesso è un'azione precisa; un ruolo è un pacchetto di permessi. Così in futuro una compagnia potrà creare ruoli propri senza cambiare il codice.

| Azione | Head office | Area mgr | GM | Head chef | Sous | CdP/Commis | KP |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Modificare la libreria ricette | ✓ | — | — | proposta | — | — | — |
| Menu e prezzi della sede | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Vedere costi e GP | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Report stock e inventario | ✓ | ✓ | ✓ | ✓ | ✓ | conteggi | — |
| Turni: modificare | ✓ | ✓ | ✓ | ✓ | ✓ | — | — |
| Turni: vedere i propri | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Paghe e costo del personale | ✓ | ✓ | ✓ | sola lettura | — | — | — |
| Prep list: spuntare | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Registri HACCP: compilare | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Registri HACCP: correggere o eliminare | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Sprechi: registrare | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Vendite e andamento | ✓ | ✓ | ✓ | ✓ | — | — | — |
| Gestire utenti della sede | ✓ | ✓ | ✓ | solo cucina | — | — | — |
| Gestire sedi, aree e ruoli | ✓ | — | — | — | — | — | — |

"Proposta" vuol dire che l'head chef può proporre una modifica alla libreria, che l'head office approva.

### Regole sempre valide

- **Assegnazione dei ruoli:** nessuno assegna un ruolo uguale o superiore al proprio (un head chef può invitare un commis, non un GM).
- **Ambito:** un incarico vale solo dove è assegnato. L'area manager vede le sue sedi, non quelle di un'altra area.
- **Paghe:** sono dati personali (UK GDPR), quindi visibili solo dal GM in su.
- **Registri HACCP:** non si cancellano davvero. Una correzione crea una nuova versione con nome e ora.
- **Registro delle attività:** chi ha cambiato cosa e quando, per prezzi, turni, paghe, ruoli e permessi.

## 4. Come cambia la tecnica

### Database

- Il file JSON locale non regge più utenti e compagnie: resta solo **Postgres** (Neon va bene).
- Al posto del formato attuale "id + JSON" servono **tabelle vere**. Ognuna ha `company_id` e, dove serve, `site_id`.
- **Isolamento su due livelli:**
  - il server controlla ogni richiesta;
  - Postgres applica regole per riga (row-level security), così un errore nel codice non mostra mai dati di un'altra compagnia.

Tabelle principali previste:

| Tabella | Contenuto |
| --- | --- |
| `companies`, `areas`, `sites` | La struttura della compagnia |
| `users` | Account (gestiti dalla libreria di login) |
| `memberships` | Incarichi: utente, ruolo, ambito |
| `roles`, `role_permissions` | Ruoli predefiniti e personalizzati |
| `staff_members` | Persone in organico per sede, collegate facoltativamente a un utente |
| `recipes`, `ingredients`, `suppliers`, `products` | Libreria della compagnia |
| `site_menus`, `site_menu_items` | Menu e prezzi di ogni sede |
| `stock_*`, `rota_weeks`, `safety_logs`, `waste_logs`, `sales_weeks`, `prep_lists` | Dati operativi della sede |
| `audit_log` | Registro delle attività |

### Login

- **Proposta: Better Auth.** È una libreria aperta, gira dentro Next.js e salva gli utenti nello stesso Postgres. Ha già organizzazioni, team, inviti per email e ruoli.
- **Alternativa: Clerk.** Più veloce da mettere in piedi, ma a pagamento per utente e con i dati degli utenti fuori dal nostro database.

### Permessi nel codice

- Ogni API controlla `può(utente, azione, sede)` prima di leggere o scrivere.
- L'interfaccia nasconde i pulsanti non permessi, ma la protezione vera sta sempre sul server.
- I permessi stanno in un unico modulo (per esempio `lib/auth/permissions.ts`) con i relativi test.

### Indirizzi e interfaccia

- Indirizzi per compagnia e sede, per esempio `/nine-elms-group/nine-elms-tavern/turni`.
- Il riquadro "La mia cucina" della barra laterale diventa il selettore di compagnia e sede.
- **Pagine head office e area manager:** GP, sprechi e costo del personale per sede, confronto tra sedi, dove è usata ogni ricetta.

### Hosting

- Per l'uso da più posti l'app deve essere online: per esempio Vercel e Neon, con HTTPS e backup automatici del database.
- Non può più girare solo sul computer del locale.

## 5. Ordine di lavoro

1. **Database:** passare da JSON a tabelle Postgres con compagnia e sede. I dati attuali diventano "Nine Elms Group → Nine Elms Tavern". Per chi la usa, l'app resta uguale.
2. **Login e incarichi:** utenti, inviti per email, ruoli predefiniti, controllo dei permessi su tutte le API.
3. **Selettore di sede** e indirizzi per sede; libreria ricette condivisa a livello di compagnia, menu e prezzi per sede.
4. **Collegamento persona–account:** ogni utente vede i propri turni; firme dei registri dall'utente collegato.
5. **Pagine head office e area manager** con i numeri di più sedi.
6. **Registro attività e ruoli personalizzati**; più avanti, abbonamento per compagnia se l'app verrà offerta ad altri.

Il punto 1 è il più delicato perché tocca tutti i dati: va fatto con un backup completo e una prova su una copia. Gli altri si aggiungono uno sopra l'altro.

### Cosa cambia per le funzioni di oggi

| Funzione | Cambiamento |
| --- | --- |
| Ricette e basi | Diventano della compagnia; le sedi le usano nei loro menu |
| Menu | Diventano della sede, con prezzi locali |
| Food Stock, prep list, sprechi, vendite | Restano uguali, ma per sede |
| Turni e personale | Personale per sede; una persona in più sedi ha un incarico in ognuna |
| Sicurezza alimentare | Per sede; firme dall'account dell'utente; correzioni come nuove versioni |
| Impostazioni | Divise in impostazioni della compagnia (valuta, regole GP, liste) e della sede (apparecchi, checklist) |

## 6. Da decidere prima di iniziare

- **Ricette:** le sedi possono creare ricette proprie, o solo l'head office?
- **Personale tra sedi:** una persona lavora in più sedi della stessa compagnia, e i suoi turni vanno visti insieme?
- **Ruoli:** bastano quelli predefiniti, o ogni compagnia deve poterli personalizzare da subito?
- **Uso esterno:** l'app resta vostra o sarà offerta ad altre compagnie? Cambiano la parte su abbonamenti, sicurezza e contratti (trattamento dei dati).
- **Hosting:** online (consigliato) o su un server vostro?
- **Login:** Better Auth (consigliato) o Clerk?
