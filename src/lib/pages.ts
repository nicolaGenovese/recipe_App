/**
 * Page buttons to show: the first, the last, and the pages around the current one, with gaps
 * (null) in between, so eleven pages fit a phone: 1 … 4 5 6 … 11.
 */
export function pageWindow(page: number, pages: number, around = 1): (number | null)[] {
  if (pages <= around * 2 + 5) return Array.from({ length: pages }, (_, index) => index + 1);
  const from = Math.max(2, Math.min(page - around, pages - 1 - around * 2 - 1));
  const to = Math.min(pages - 1, Math.max(page + around, 2 + around * 2 + 1));
  const middle = Array.from({ length: to - from + 1 }, (_, index) => from + index);
  return [1, ...(from > 2 ? [null] : []), ...middle, ...(to < pages - 1 ? [null] : []), pages];
}
