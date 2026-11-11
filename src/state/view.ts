// What the user is looking at. Kept apart from the data so filters survive saves and reloads of data.

/** "menu" shows the dishes of one menu (`menuId`) or of every active menu; "menus" and "prep" are their own pages. */
export type ViewFilter = "all" | "menu" | "archive" | "stock" | "menus" | "prep" | "rota" | "safety" | "performance";
export type RecipeSort = "updated" | "name" | "cost-high" | "cost-low" | "category";
export type StockTab = "reports" | "deliveries" | "inventory";
export type InventorySortKey = "code" | "name" | "supplier" | "unit" | "par" | "stock" | "reorder" | "status" | "cost" | "value";

export const ALL_CATEGORIES = "Tutte";

export interface ViewState {
  filter: ViewFilter;
  menuId: string | null;
  category: string;
  query: string;
  sort: RecipeSort;
  page: number;
  pageSize: number | "all";
  layout: "grid" | "list";
}

export interface StockViewState {
  tab: StockTab;
  open: string[];
  page: number;
  deliveryQuery: string;
  inventoryQuery: string;
  inventoryGroup: string;
  inventoryReorderOnly: boolean;
  inventorySort: { key: InventorySortKey; dir: 1 | -1 };
}

export const INITIAL_VIEW: ViewState = { filter: "all", menuId: null, category: ALL_CATEGORIES, query: "", sort: "updated", page: 1, pageSize: 9, layout: "grid" };

export const INITIAL_STOCK_VIEW: StockViewState = {
  tab: "reports", open: [], page: 1, deliveryQuery: "", inventoryQuery: "", inventoryGroup: "", inventoryReorderOnly: false,
  inventorySort: { key: "code", dir: 1 }
};
