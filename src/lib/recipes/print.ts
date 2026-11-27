import { num } from "@/lib/num";
import { portionsOf } from "@/lib/recipes/math";
import type { Ingredient, Recipe } from "@/lib/types";

/** How many times the recipe is made: 16 portions of an 8-portion recipe is 2. */
export function printScale(recipe: Pick<Recipe, "portions">, portions: number): number {
  const base = portionsOf(recipe);
  return portions > 0 && base > 0 ? portions / base : 1;
}

/** An ingredient row as printed: the quantity for the portions chosen. */
export function scaledRow(row: Ingredient, scale: number): Ingredient {
  return { ...row, quantity: num(row.quantity) * scale };
}

/**
 * A quantity as a cook reads it: whole grams from 100 up, one decimal from 10, two below, and no
 * trailing zeros (250, 12.5, 1.25, 0.5).
 */
export function printQuantity(value: number, locale: string): string {
  const amount = num(value);
  const digits = amount >= 100 ? 0 : amount >= 10 ? 1 : 2;
  return new Intl.NumberFormat(locale, { maximumFractionDigits: digits }).format(amount);
}

/**
 * The method as numbered steps: one per line, without the numbers or dashes already typed in front
 * ("1.", "2)", "-", "•"). Empty lines are dropped.
 */
export function methodSteps(method: string | undefined): string[] {
  return String(method || "").split(/\r?\n/)
    // "3.5 kg" keeps its number: only a number followed by "." or ")" and a space is a step number.
    .map((line) => line.trim().replace(/^(\d{1,2}[.)]|[-–•*])\s+/, "").trim())
    .filter(Boolean);
}
