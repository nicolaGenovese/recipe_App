// Default settings for a new archive. A new archive has no recipes, products or other data.
import { DEFAULT_UNITS } from "@/lib/stock/units";
import type { Settings } from "@/lib/types";

export const DEFAULT_SETTINGS: Settings = {
  categories: ["Antipasti", "Primi", "Secondi", "Contorni", "Dessert", "Bevande", "Basi e preparazioni"],
  cookingMethods: ["Nessuna", "Forno", "Griglia", "Padella", "Frittura", "Bollitura", "Brasatura", "Vapore", "A freddo"],
  allergens: ["Glutine", "Crostacei", "Uova", "Pesce", "Arachidi", "Soia", "Latte", "Frutta a guscio", "Sedano", "Senape", "Sesamo", "Solfiti", "Lupini", "Molluschi"],
  ccpChecks: ["Controllare integrità e temperatura alla ricezione", "Etichettare e conservare secondo le procedure della cucina", "Separare crudo e pronto al consumo", "Verificare e registrare cottura o mantenimento", "Raffreddare, coprire e datare le preparazioni"],
  prepChecks: ["Tagliere rosso · carne cruda", "Tagliere blu · pesce crudo", "Tagliere verde · ortaggi", "Tagliere giallo · alimenti cotti", "Tagliere bianco · pane e latticini", "Tagliere marrone · radici"],
  currency: "EUR",
  language: "en",
  units: [...DEFAULT_UNITS],
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
