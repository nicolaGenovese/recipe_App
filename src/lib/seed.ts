// Default lists and demo content used when the archive is empty.
import type { Recipe, Settings, StockItem } from "@/lib/types";

export const DEFAULT_SETTINGS: Settings = {
  categories: ["Antipasti", "Primi", "Secondi", "Contorni", "Dessert", "Bevande", "Basi e preparazioni"],
  cookingMethods: ["Nessuna", "Forno", "Griglia", "Padella", "Frittura", "Bollitura", "Brasatura", "Vapore", "A freddo"],
  allergens: ["Glutine", "Crostacei", "Uova", "Pesce", "Arachidi", "Soia", "Latte", "Frutta a guscio", "Sedano", "Senape", "Sesamo", "Solfiti", "Lupini", "Molluschi"],
  ccpChecks: ["Controllare integrità e temperatura alla ricezione", "Etichettare e conservare secondo le procedure della cucina", "Separare crudo e pronto al consumo", "Verificare e registrare cottura o mantenimento", "Raffreddare, coprire e datare le preparazioni"],
  prepChecks: ["Tagliere rosso · carne cruda", "Tagliere blu · pesce crudo", "Tagliere verde · ortaggi", "Tagliere giallo · alimenti cotti", "Tagliere bianco · pane e latticini", "Tagliere marrone · radici"],
  currency: "EUR",
  gp: { target: 70, includeTransfers: true, salesIncludeVat: false, salesVatRate: 10, recipeMarginOnNet: true, defaultVat: 10, defaultMarginTarget: 68 },
  labour: { onCostPercent: 0 },
  staff: [],
  // UK Safer Food, Better Business guidance; every value can be changed from the Food safety page.
  foodSafety: {
    equipment: [
      { id: "fridge-1", name: "Frigo 1", kind: "fridge", min: 0, max: 5 },
      { id: "fridge-2", name: "Frigo 2", kind: "fridge", min: 0, max: 5 },
      { id: "freezer-1", name: "Congelatore 1", kind: "freezer", min: null, max: -18 }
    ],
    cookMin: 75, reheatMin: 75, hotHoldMin: 63, coolTarget: 8, coolMinutes: 90, chilledDeliveryMax: 8, frozenDeliveryMax: -15, defaultShelfLifeDays: 3,
    checklists: {
      opening: ["Frigoriferi e congelatori in temperatura", "Superfici di lavoro pulite e disinfettate", "Lavamani con sapone e carta", "Personale in salute e in divisa pulita", "Prodotti scaduti tolti dal servizio"],
      closing: ["Alimenti coperti, etichettati e in frigorifero", "Avanzi buttati o raffreddati ed etichettati", "Superfici e attrezzature pulite", "Pavimenti puliti e rifiuti portati fuori", "Gas, forni e friggitrici spenti"],
      cleaning: ["Taglieri e coltelli lavati e disinfettati", "Interno frigoriferi pulito", "Friggitrici filtrate o olio cambiato", "Cappe e filtri puliti", "Lavastoviglie pulita e controllata"]
    }
  }
};

const example = (id: string, name: string, category: string, opts: Partial<Recipe> = {}): Recipe => ({
  id,
  name,
  category,
  description: opts.description ?? "Una preparazione di esempio. Modifica ingredienti, resa e procedure per adattarla alla tua cucina.",
  portions: opts.portions ?? 4,
  currentMenu: opts.currentMenu ?? false,
  archivedBatch: opts.archivedBatch ?? false,
  createdAt: opts.createdAt ?? "2026-10-20T10:00:00.000Z",
  updatedAt: opts.updatedAt ?? "2026-11-02T09:30:00.000Z",
  creator: opts.creator ?? "Team cucina",
  image: "",
  cookingMethod: opts.cookingMethod ?? "Padella",
  ingredients: opts.ingredients ?? [],
  sellingPrice: opts.sellingPrice ?? 14.5,
  marginTarget: opts.marginTarget ?? 68,
  vat: opts.vat ?? 10,
  allergenGuidance: opts.allergenGuidance ?? "Verificare sempre le etichette dei fornitori e il rischio di contaminazione crociata.",
  mep: opts.mep ?? "Preparare e porzionare gli ingredienti prima del servizio.",
  method: opts.method ?? "1. Preparare gli ingredienti.\n2. Cuocere secondo la tecnica indicata.\n3. Assaggiare, regolare e servire.",
  plating: opts.plating ?? "Impiattare in un piatto caldo e rifinire con erbe fresche.",
  nutritionInfo: opts.nutritionInfo ?? "Valori nutrizionali da completare in base ai prodotti effettivamente utilizzati.",
  ccpChecks: opts.ccpChecks ?? [DEFAULT_SETTINGS.ccpChecks[0], DEFAULT_SETTINGS.ccpChecks[2]],
  prepChecks: opts.prepChecks ?? [DEFAULT_SETTINGS.prepChecks[2]],
  notes: opts.notes ?? ""
});

export const DEMO_RECIPES: Recipe[] = [
  example("demo-01", "Pasta al limone e basilico", "Primi", {
    description: "Pasta fresca con limone, parmigiano e basilico.", currentMenu: true, cookingMethod: "Padella", sellingPrice: 15.5,
    ingredients: [
      { type: "Prodotto", name: "Pasta fresca", supplier: "Pastaio locale", quantity: 0.36, unit: "kg", unitCost: 8.4, allergens: ["Glutine", "Uova"], kcal: 370 },
      { type: "Prodotto", name: "Limone", supplier: "Ortofrutta", quantity: 2, unit: "pz", unitCost: 0.38, allergens: [], kcal: 17 },
      { type: "Prodotto", name: "Parmigiano", supplier: "Latticini", quantity: 0.08, unit: "kg", unitCost: 19, allergens: ["Latte"], kcal: 431 },
      { type: "Prodotto", name: "Basilico", supplier: "Ortofrutta", quantity: 0.02, unit: "kg", unitCost: 24, allergens: [], kcal: 23 }
    ], method: "1. Cuocere la pasta in acqua salata.\n2. Emulsionare succo e scorza di limone con poca acqua di cottura.\n3. Mantecare con il formaggio e aggiungere il basilico.",
    plating: "Servire in una fondina, completando con scorza di limone e foglie di basilico.", ccpChecks: [DEFAULT_SETTINGS.ccpChecks[0], DEFAULT_SETTINGS.ccpChecks[2], DEFAULT_SETTINGS.ccpChecks[3]], prepChecks: [DEFAULT_SETTINGS.prepChecks[2], DEFAULT_SETTINGS.prepChecks[4]]
  }),
  example("demo-02", "Curry di ceci e cocco", "Secondi", {
    description: "Ceci stufati con latte di cocco, pomodoro e spezie.", currentMenu: true, cookingMethod: "Brasatura", sellingPrice: 13.5,
    ingredients: [
      { type: "Prodotto", name: "Ceci cotti", supplier: "Dispensa", quantity: 0.6, unit: "kg", unitCost: 3.2, allergens: [], kcal: 164 },
      { type: "Prodotto", name: "Latte di cocco", supplier: "Dispensa", quantity: 0.4, unit: "l", unitCost: 3.6, allergens: [], kcal: 197 },
      { type: "Prodotto", name: "Pomodori", supplier: "Ortofrutta", quantity: 0.4, unit: "kg", unitCost: 3.1, allergens: [], kcal: 18 },
      { type: "Prodotto", name: "Pasta di curry", supplier: "Dispensa", quantity: 0.04, unit: "kg", unitCost: 16, allergens: [], kcal: 120 }
    ], ccpChecks: [DEFAULT_SETTINGS.ccpChecks[0], DEFAULT_SETTINGS.ccpChecks[1], DEFAULT_SETTINGS.ccpChecks[3]], prepChecks: [DEFAULT_SETTINGS.prepChecks[2]]
  }),
  example("demo-03", "Melanzana glassata al miso", "Secondi", {
    description: "Melanzana arrostita, miso dolce e sesamo tostato.", currentMenu: true, cookingMethod: "Forno", sellingPrice: 12,
    ingredients: [
      { type: "Prodotto", name: "Melanzana", supplier: "Ortofrutta", quantity: 0.8, unit: "kg", unitCost: 3.4, allergens: [], kcal: 25 },
      { type: "Prodotto", name: "Miso", supplier: "Dispensa", quantity: 0.06, unit: "kg", unitCost: 18, allergens: ["Soia"], kcal: 199 },
      { type: "Prodotto", name: "Sciroppo di riso", supplier: "Dispensa", quantity: 0.03, unit: "kg", unitCost: 9.8, allergens: [], kcal: 310 },
      { type: "Prodotto", name: "Sesamo", supplier: "Dispensa", quantity: 0.02, unit: "kg", unitCost: 8, allergens: ["Sesamo"], kcal: 573 }
    ], prepChecks: [DEFAULT_SETTINGS.prepChecks[2], DEFAULT_SETTINGS.prepChecks[4]]
  }),
  example("demo-04", "Vellutata di zucca arrosto", "Antipasti", {
    description: "Zucca al forno, brodo vegetale e olio alle erbe.", currentMenu: true, cookingMethod: "Forno", sellingPrice: 8.5,
    ingredients: [
      { type: "Prodotto", name: "Zucca", supplier: "Ortofrutta", quantity: 1.2, unit: "kg", unitCost: 2.7, allergens: [], kcal: 26 },
      { type: "Prodotto", name: "Brodo vegetale", supplier: "Preparazione interna", quantity: 0.8, unit: "l", unitCost: 1.5, allergens: ["Sedano"], kcal: 12 },
      { type: "Prodotto", name: "Panna", supplier: "Latticini", quantity: 0.12, unit: "l", unitCost: 5.3, allergens: ["Latte"], kcal: 340 }
    ],
    ingredientsNote: "", ccpChecks: [DEFAULT_SETTINGS.ccpChecks[0], DEFAULT_SETTINGS.ccpChecks[3], DEFAULT_SETTINGS.ccpChecks[4]]
  }),
  example("demo-05", "Torta di mandorle e arancia", "Dessert", {
    description: "Torta morbida senza farina con mandorle e scorza d'arancia.", currentMenu: true, cookingMethod: "Forno", sellingPrice: 7,
    ingredients: [
      { type: "Prodotto", name: "Farina di mandorle", supplier: "Dispensa", quantity: 0.3, unit: "kg", unitCost: 15, allergens: ["Frutta a guscio"], kcal: 579 },
      { type: "Prodotto", name: "Uova", supplier: "Produttore locale", quantity: 5, unit: "pz", unitCost: 0.32, allergens: ["Uova"], kcal: 143 },
      { type: "Prodotto", name: "Arance", supplier: "Ortofrutta", quantity: 2, unit: "pz", unitCost: 0.42, allergens: [], kcal: 47 },
      { type: "Prodotto", name: "Zucchero", supplier: "Dispensa", quantity: 0.2, unit: "kg", unitCost: 1.8, allergens: [], kcal: 387 }
    ], prepChecks: [DEFAULT_SETTINGS.prepChecks[2], DEFAULT_SETTINGS.prepChecks[4]]
  }),
  example("demo-06", "Brodo vegetale di stagione", "Basi e preparazioni", {
    description: "Una base versatile per zuppe, risotti e salse.", portions: 12, archivedBatch: true, currentMenu: false, cookingMethod: "Bollitura", sellingPrice: 0,
    ingredients: [
      { type: "Prodotto", name: "Carote", supplier: "Ortofrutta", quantity: 0.5, unit: "kg", unitCost: 1.9, allergens: [], kcal: 41 },
      { type: "Prodotto", name: "Sedano", supplier: "Ortofrutta", quantity: 0.3, unit: "kg", unitCost: 2.2, allergens: ["Sedano"], kcal: 16 },
      { type: "Prodotto", name: "Cipolle", supplier: "Ortofrutta", quantity: 0.4, unit: "kg", unitCost: 1.7, allergens: [], kcal: 40 },
      { type: "Esterno", name: "Acqua", supplier: "—", quantity: 4, unit: "l", unitCost: 0, allergens: [], kcal: 0 }
    ], method: "1. Lavare e tagliare grossolanamente le verdure.\n2. Coprire con acqua fredda e cuocere a fuoco dolce.\n3. Filtrare, raffreddare e conservare secondo le procedure locali.",
    ccpChecks: [DEFAULT_SETTINGS.ccpChecks[1], DEFAULT_SETTINGS.ccpChecks[4]], prepChecks: [DEFAULT_SETTINGS.prepChecks[2]]
  }),
  example("demo-07", "Insalata di farro, erbe e verdure", "Contorni", {
    description: "Farro, verdure croccanti, erbe fresche e vinaigrette.", currentMenu: false, cookingMethod: "Bollitura", sellingPrice: 10.5,
    ingredients: [
      { type: "Prodotto", name: "Farro", supplier: "Dispensa", quantity: 0.32, unit: "kg", unitCost: 4.5, allergens: ["Glutine"], kcal: 340 },
      { type: "Prodotto", name: "Cetriolo", supplier: "Ortofrutta", quantity: 0.25, unit: "kg", unitCost: 2.5, allergens: [], kcal: 15 },
      { type: "Prodotto", name: "Pomodorini", supplier: "Ortofrutta", quantity: 0.25, unit: "kg", unitCost: 4.2, allergens: [], kcal: 18 },
      { type: "Prodotto", name: "Olio extravergine", supplier: "Dispensa", quantity: 0.05, unit: "l", unitCost: 11, allergens: [], kcal: 884 }
    ],
    ccpChecks: [DEFAULT_SETTINGS.ccpChecks[0], DEFAULT_SETTINGS.ccpChecks[1], DEFAULT_SETTINGS.ccpChecks[2]]
  }),
  example("demo-08", "Crema pasticcera alla vaniglia", "Basi e preparazioni", {
    description: "Base per crostate, bignè e dessert al cucchiaio.", portions: 10, archivedBatch: true, currentMenu: false, cookingMethod: "Padella", sellingPrice: 0,
    ingredients: [
      { type: "Prodotto", name: "Latte intero", supplier: "Latticini", quantity: 1, unit: "l", unitCost: 1.6, allergens: ["Latte"], kcal: 61 },
      { type: "Prodotto", name: "Tuorli", supplier: "Produttore locale", quantity: 8, unit: "pz", unitCost: 0.2, allergens: ["Uova"], kcal: 322 },
      { type: "Prodotto", name: "Zucchero", supplier: "Dispensa", quantity: 0.18, unit: "kg", unitCost: 1.8, allergens: [], kcal: 387 },
      { type: "Prodotto", name: "Amido di mais", supplier: "Dispensa", quantity: 0.06, unit: "kg", unitCost: 3.1, allergens: [], kcal: 381 },
      { type: "Esterno", name: "Vaniglia", supplier: "Dispensa", quantity: 1, unit: "baccello", unitCost: 1.2, allergens: [], kcal: 288 }
    ],
    ccpChecks: [DEFAULT_SETTINGS.ccpChecks[0], DEFAULT_SETTINGS.ccpChecks[3], DEFAULT_SETTINGS.ccpChecks[4]], prepChecks: [DEFAULT_SETTINGS.prepChecks[4]]
  })
];

const STOCK_GROUPS: Record<string, string> = { Ortofrutta: "Frutta e verdura", Dispensa: "Dispensa", Latticini: "Latticini" };
const STOCK_MEASURES: Record<string, string> = { kg: "Kilo", l: "Litre" };

// Demo stock built from the demo recipes, so that recipes and products line up.
export const DEMO_STOCK_ITEMS: StockItem[] = Array.from(
  new Map(DEMO_RECIPES.flatMap((recipe) => recipe.ingredients).filter((row) => row.type === "Prodotto").map((row) => [row.name, row])).values()
).map((row, index) => ({
  id: "stock-" + String(index + 1).padStart(2, "0"),
  name: row.name,
  supplier: row.supplier,
  group: STOCK_GROUPS[row.supplier] ?? "Altro",
  measurement: STOCK_MEASURES[row.unit] ?? "Pack",
  unitOfSale: row.unit,
  unitsPerPack: 1,
  price: row.unitCost,
  initialStock: Math.round(row.quantity * 300) / 100,
  recipeContent: 1,
  recipeUnit: row.unit,
  allergens: row.allergens,
  kcal: row.kcal
}));
