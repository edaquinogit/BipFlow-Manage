import { describe, it, expect, vi, beforeEach } from 'vitest'
import { flushPromises } from '@vue/test-utils'
import { useProductSearch } from '../useProductSearch'
import productService from '@/services/product.service'
import type { PaginatedProductsResponse } from '@/types/product'

vi.mock('@/services/product.service', () => ({
  default: { list: vi.fn() },
}))

const PAGE_SIZE = 2
const TOTAL_COUNT = 10
const TOTAL_PAGES = 5

function pageResponse(page: number): PaginatedProductsResponse {
  const start = (page - 1) * PAGE_SIZE + 1
  return {
    count: TOTAL_COUNT,
    next: page < TOTAL_PAGES ? `page=${page + 1}` : null,
    previous: page > 1 ? `page=${page - 1}` : null,
    page_size: PAGE_SIZE,
    total_pages: TOTAL_PAGES,
    results: [
      { id: start, name: `Produto ${start}` } as any,
      { id: start + 1, name: `Produto ${start + 1}` } as any,
    ],
  }
}

describe('useProductSearch pagination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(productService.list).mockImplementation(async (_filters, page = 1) =>
      pageResponse(page)
    )
  })

  it('fetches page 1 on creation', async () => {
    const { products, page, totalPages, showingRange } = useProductSearch({ pageSize: PAGE_SIZE })
    await flushPromises()

    expect(page.value).toBe(1)
    expect(totalPages.value).toBe(TOTAL_PAGES)
    expect(products.value.map((p) => p.id)).toEqual([1, 2])
    expect(showingRange.value).toBe('Exibindo 1-2 de 10 produtos')
  })

  it('hasPreviousPage/hasNextPage reflect the current page boundaries', async () => {
    const { hasPreviousPage, hasNextPage, goToPage } = useProductSearch({ pageSize: PAGE_SIZE })
    await flushPromises()

    expect(hasPreviousPage.value).toBe(false)
    expect(hasNextPage.value).toBe(true)

    goToPage(TOTAL_PAGES)
    await flushPromises()

    expect(hasPreviousPage.value).toBe(true)
    expect(hasNextPage.value).toBe(false)
  })

  it('goToPage replaces the product list with only that page\'s slice', async () => {
    const { products, page, showingRange, goToPage } = useProductSearch({ pageSize: PAGE_SIZE })
    await flushPromises()

    goToPage(3)
    await flushPromises()

    expect(page.value).toBe(3)
    expect(products.value.map((p) => p.id)).toEqual([5, 6])
    expect(showingRange.value).toBe('Exibindo 5-6 de 10 produtos')
  })

  it('ignores out-of-range or no-op goToPage calls', async () => {
    const { page, goToPage } = useProductSearch({ pageSize: PAGE_SIZE })
    await flushPromises()
    vi.mocked(productService.list).mockClear()

    goToPage(0)
    goToPage(TOTAL_PAGES + 1)
    goToPage(1) // already on page 1
    await flushPromises()

    expect(page.value).toBe(1)
    expect(productService.list).not.toHaveBeenCalled()
  })

  it('nextPage replaces the product list with the next page\'s slice, not appended', async () => {
    const { products, page, showingRange, nextPage } = useProductSearch({ pageSize: PAGE_SIZE })
    await flushPromises()

    nextPage()
    await flushPromises()

    expect(page.value).toBe(2)
    expect(products.value.map((p) => p.id)).toEqual([3, 4])
    expect(showingRange.value).toBe('Exibindo 3-4 de 10 produtos')
  })

  it('previousPage does nothing on the first page', async () => {
    const { page, previousPage } = useProductSearch({ pageSize: PAGE_SIZE })
    await flushPromises()
    vi.mocked(productService.list).mockClear()

    previousPage()
    await flushPromises()

    expect(page.value).toBe(1)
    expect(productService.list).not.toHaveBeenCalled()
  })
})
