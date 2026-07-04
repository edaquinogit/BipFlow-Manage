import { describe, it, expect } from 'vitest'
import { buildVisiblePages, ELLIPSIS } from '../paginationRange'

describe('buildVisiblePages', () => {
  it('returns an empty list when there are no pages', () => {
    expect(buildVisiblePages(1, 0)).toEqual([])
  })

  it('returns a single page when there is only one', () => {
    expect(buildVisiblePages(1, 1)).toEqual([1])
  })

  it('shows every page with no ellipsis when the total is small', () => {
    expect(buildVisiblePages(1, 4)).toEqual([1, 2, 3, 4])
    expect(buildVisiblePages(3, 5)).toEqual([1, 2, 3, 4, 5])
  })

  it('does not use an ellipsis to hide a single page -- shows it instead', () => {
    // current=5 would hide only page "2" between "1" and the 3-7 window if
    // the threshold were off by one; must show it directly (same width as
    // an ellipsis, more informative).
    expect(buildVisiblePages(5, 20)).toEqual([1, 2, 3, 4, 5, 6, 7, ELLIPSIS, 20])
  })

  it('shows a leading ellipsis once 2+ pages are actually hidden', () => {
    expect(buildVisiblePages(6, 20)).toEqual([1, ELLIPSIS, 4, 5, 6, 7, 8, ELLIPSIS, 20])
  })

  it('shows a trailing ellipsis only once 2+ pages are actually hidden', () => {
    expect(buildVisiblePages(16, 20)).toEqual([1, ELLIPSIS, 14, 15, 16, 17, 18, 19, 20])
    expect(buildVisiblePages(15, 20)).toEqual([1, ELLIPSIS, 13, 14, 15, 16, 17, ELLIPSIS, 20])
  })

  it('collapses both sides when the current page is in the middle of a long list', () => {
    expect(buildVisiblePages(50, 100)).toEqual([1, ELLIPSIS, 48, 49, 50, 51, 52, ELLIPSIS, 100])
  })

  it('never shows an ellipsis when current page is at the very first page', () => {
    expect(buildVisiblePages(1, 100)).toEqual([1, 2, 3, ELLIPSIS, 100])
  })

  it('never shows an ellipsis when current page is at the very last page', () => {
    expect(buildVisiblePages(100, 100)).toEqual([1, ELLIPSIS, 98, 99, 100])
  })

  it('handles an out-of-range current page defensively instead of crashing', () => {
    expect(buildVisiblePages(999, 10)).toEqual([1, ELLIPSIS, 10])
    expect(buildVisiblePages(-5, 10)).toEqual([1, ELLIPSIS, 10])
  })

  it('never produces duplicate page numbers across the full range of totals', () => {
    for (let total = 1; total <= 40; total += 1) {
      for (let current = 1; current <= total; current += 1) {
        const pages = buildVisiblePages(current, total)
        const numbers = pages.filter((item): item is number => item !== ELLIPSIS)
        expect(new Set(numbers).size).toBe(numbers.length)
        expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
      }
    }
  })
})
