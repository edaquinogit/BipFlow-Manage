export const ELLIPSIS = 'ellipsis' as const

export type PaginationItem = number | typeof ELLIPSIS

/**
 * Builds the compact "1 ... 4 5 6 ... 20" page list around `currentPage`.
 *
 * Never collapses a single hidden page behind an ellipsis (e.g. current=2
 * shows "1 2 3 ... 20", not "1 ... 2 3 ... 20") -- a "..." for exactly one
 * skipped page wastes the same width as just showing that page's number.
 */
export function buildVisiblePages(
  currentPage: number,
  totalPages: number,
  delta = 2
): PaginationItem[] {
  if (totalPages <= 1) {
    return totalPages === 1 ? [1] : []
  }

  const rangeStart = Math.max(2, currentPage - delta)
  const rangeEnd = Math.min(totalPages - 1, currentPage + delta)

  const middle: number[] = []
  for (let page = rangeStart; page <= rangeEnd; page += 1) {
    middle.push(page)
  }

  const items: PaginationItem[] = [1]

  if (rangeStart > 2) {
    items.push(rangeStart === 3 ? 2 : ELLIPSIS)
  }

  items.push(...middle)

  if (rangeEnd < totalPages - 1) {
    items.push(rangeEnd === totalPages - 2 ? totalPages - 1 : ELLIPSIS)
  }

  items.push(totalPages)

  return items
}
