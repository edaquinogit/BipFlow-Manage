import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, ref } from 'vue'
import ProductListing from '../ProductListing.vue'
import { useProducts } from '@/composables/useProducts'
import { useCategories } from '@/composables/useCategories'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { createDefaultFilterState } from '@/types/filters'

vi.mock('@/composables/useProducts', () => ({ useProducts: vi.fn() }))
vi.mock('@/composables/useCategories', () => ({ useCategories: vi.fn() }))
vi.mock('@/composables/useCurrentStore', () => ({ useCurrentStore: vi.fn() }))
vi.mock('@/composables/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))

const ProductTableStub = defineComponent({
  name: 'ProductTableRoot',
  props: ['products', 'activeStore', 'canManageCatalog', 'selectedAssetIds', 'isAllSelected', 'isIndeterminate'],
  emits: ['delete', 'edit', 'toggle-selection', 'select-all', 'adjust-stock', 'print-label'],
  template: '<div class="product-table-stub" />',
})

const SearchAndFilterBarStub = defineComponent({
  name: 'SearchAndFilterBar',
  props: ['filters', 'isSearching', 'categories'],
  emits: ['updateFilters', 'clear-filters'],
  template: '<div class="search-filter-stub" />',
})

const BulkActionBarStub = defineComponent({
  name: 'BulkActionBar',
  props: ['selectedCount', 'categories', 'isUpdating'],
  emits: ['cancel', 'confirm-bulk-update'],
  template: '<div class="bulk-action-bar-stub" />',
})

describe('ProductListing', () => {
  const productsState = {
    products: ref([{ id: 1, name: 'Produto teste', price: '10.00', stock_quantity: 5 } as any]),
    loading: ref(false),
    error: ref<string | null>(null),
    filters: ref(createDefaultFilterState()),
    isSearching: ref(false),
    selectedAssetIds: ref(new Set<number>()),
    isAllSelected: ref(false),
    isIndeterminate: ref(false),
    fetchData: vi.fn(),
    updateFilters: vi.fn(),
    clearFilters: vi.fn(),
    toggleSelection: vi.fn(),
    selectAll: vi.fn(),
    clearSelection: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    productsState.products.value = [{ id: 1, name: 'Produto teste', price: '10.00', stock_quantity: 5 } as any]
    productsState.loading.value = false
    productsState.error.value = null
    productsState.selectedAssetIds.value = new Set()

    vi.mocked(useProducts).mockReturnValue(productsState as any)
    vi.mocked(useCategories).mockReturnValue({ categories: ref([]) } as any)
    vi.mocked(useCurrentStore).mockReturnValue({ selectedStore: ref(null) } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(true) } as any)
  })

  const mountListing = (props: { isBulkUpdating?: boolean } = {}) =>
    mount(ProductListing, {
      props,
      global: {
        stubs: {
          ProductTable: ProductTableStub,
          SearchAndFilterBar: SearchAndFilterBarStub,
          BulkActionBar: BulkActionBarStub,
        },
      },
    })

  it('shows the loading skeleton while useProducts() is loading', () => {
    productsState.loading.value = true
    const wrapper = mountListing()

    expect(wrapper.find('[data-cy="loading-skeleton"]').exists()).toBe(true)
  })

  it('shows the error state and retries by calling fetchData() directly', async () => {
    productsState.error.value = 'Falha ao carregar produtos'
    const wrapper = mountListing()

    const errorState = wrapper.find('[data-cy="error-state"]')
    expect(errorState.exists()).toBe(true)
    expect(errorState.text()).toContain('Falha ao carregar produtos')

    await wrapper.find('[data-cy="btn-retry-connection"]').trigger('click')
    expect(productsState.fetchData).toHaveBeenCalledTimes(1)
  })

  it('emits open-panel when the add-product button is clicked', async () => {
    const wrapper = mountListing()

    await wrapper.find('[data-cy="btn-add-product"]').trigger('click')

    expect(wrapper.emitted('open-panel')).toHaveLength(1)
  })

  it('does not render the add-product button without catalog permission', () => {
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(false) } as any)
    const wrapper = mountListing()

    expect(wrapper.find('[data-cy="btn-add-product"]').exists()).toBe(false)
  })

  it('bubbles delete and edit up from the product table', () => {
    const wrapper = mountListing()
    const table = wrapper.findComponent(ProductTableStub)

    table.vm.$emit('delete', 7)
    table.vm.$emit('edit', { id: 7, name: 'Produto teste' })

    expect(wrapper.emitted('delete')?.at(-1)).toEqual([7])
    expect(wrapper.emitted('edit')?.at(-1)).toEqual([{ id: 7, name: 'Produto teste' }])
  })

  it('bubbles adjust-stock up from the product table', () => {
    const wrapper = mountListing()
    const table = wrapper.findComponent(ProductTableStub)

    table.vm.$emit('adjust-stock', { id: 7, name: 'Produto teste' })

    expect(wrapper.emitted('adjust-stock')?.at(-1)).toEqual([{ id: 7, name: 'Produto teste' }])
  })

  it('bubbles print-label up from the product table', () => {
    const wrapper = mountListing()
    const table = wrapper.findComponent(ProductTableStub)

    table.vm.$emit('print-label', { id: 7, name: 'Produto teste' })

    expect(wrapper.emitted('print-label')?.at(-1)).toEqual([{ id: 7, name: 'Produto teste' }])
  })

  it('calls toggleSelection/selectAll directly instead of emitting them', () => {
    const wrapper = mountListing()
    const table = wrapper.findComponent(ProductTableStub)

    table.vm.$emit('toggle-selection', 3)
    table.vm.$emit('select-all')

    expect(productsState.toggleSelection).toHaveBeenCalledWith(3)
    expect(productsState.selectAll).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('toggle-selection')).toBeUndefined()
    expect(wrapper.emitted('select-all')).toBeUndefined()
  })

  it('calls updateFilters/clearFilters directly instead of emitting them', () => {
    const wrapper = mountListing()
    const searchBar = wrapper.findComponent(SearchAndFilterBarStub)

    searchBar.vm.$emit('updateFilters', { search: 'abc' })
    searchBar.vm.$emit('clear-filters')

    expect(productsState.updateFilters).toHaveBeenCalledWith({ search: 'abc' })
    expect(productsState.clearFilters).toHaveBeenCalledTimes(1)
  })

  it('calls clearSelection directly on bulk-bar cancel, but emits bulk-update-category', () => {
    const wrapper = mountListing()
    const bulkBar = wrapper.findComponent(BulkActionBarStub)

    bulkBar.vm.$emit('cancel')
    bulkBar.vm.$emit('confirm-bulk-update', 9)

    expect(productsState.clearSelection).toHaveBeenCalledTimes(1)
    expect(wrapper.emitted('bulk-update-category')?.at(-1)).toEqual([9])
  })
})
