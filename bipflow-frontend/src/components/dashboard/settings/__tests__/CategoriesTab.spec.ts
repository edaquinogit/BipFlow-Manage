import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import CategoriesTab from '../CategoriesTab.vue'
import { useCategories } from '@/composables/useCategories'
import { useCurrentStore } from '@/composables/useCurrentStore'
import { useCurrentUser } from '@/composables/useCurrentUser'
import { useToast } from '@/composables/useToast'

vi.mock('@/composables/useCategories', () => ({ useCategories: vi.fn() }))
vi.mock('@/composables/useCurrentStore', () => ({ useCurrentStore: vi.fn() }))
vi.mock('@/composables/useCurrentUser', () => ({ useCurrentUser: vi.fn() }))
vi.mock('@/composables/useToast', () => ({ useToast: vi.fn() }))

describe('CategoriesTab', () => {
  const toastState = { success: vi.fn(), error: vi.fn() }
  const categoriesState = {
    categories: ref([{ id: 1, name: 'Bebidas', description: '', slug: 'bebidas', parent: null, parent_name: null, product_count: 0, children_count: 0 }]),
    loading: ref(false),
    error: ref<string | null>(null),
    fetchCategories: vi.fn(),
    addCategory: vi.fn(),
    deleteCategory: vi.fn(),
  }

  beforeEach(() => {
    vi.clearAllMocks()
    categoriesState.categories.value = [{ id: 1, name: 'Bebidas', description: '', slug: 'bebidas', parent: null, parent_name: null, product_count: 0, children_count: 0 }]
    categoriesState.loading.value = false
    categoriesState.error.value = null

    vi.mocked(useCategories).mockReturnValue(categoriesState as any)
    vi.mocked(useCurrentStore).mockReturnValue({ selectedStore: ref(null) } as any)
    vi.mocked(useCurrentUser).mockReturnValue({ canManageCatalog: ref(true) } as any)
    vi.mocked(useToast).mockReturnValue(toastState as any)
  })

  it('fetches categories on mount', () => {
    mount(CategoriesTab)

    expect(categoriesState.fetchCategories).toHaveBeenCalledWith(true)
  })

  it('disables the submit button while the category name is shorter than 2 characters', async () => {
    const wrapper = mount(CategoriesTab)

    const submitButton = wrapper.find('button[type="submit"]')
    expect(submitButton.attributes('disabled')).toBeDefined()

    await wrapper.find('input[type="text"]').setValue('Ok')
    expect(submitButton.attributes('disabled')).toBeUndefined()
  })

  it('creates a category with the trimmed name and resets the draft on success', async () => {
    categoriesState.addCategory.mockResolvedValue({ id: 2, name: 'Combos' })
    const wrapper = mount(CategoriesTab)

    await wrapper.find('input[type="text"]').setValue('  Combos  ')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(categoriesState.addCategory).toHaveBeenCalledWith({ name: 'Combos', description: '', parent: null })
    expect(toastState.success).toHaveBeenCalledWith('Categoria criada com sucesso.')
    expect((wrapper.find('input[type="text"]').element as HTMLInputElement).value).toBe('')
  })

  it('creates a subcategory when a parent category is selected', async () => {
    categoriesState.addCategory.mockResolvedValue({ id: 2, name: 'Biquíni', parent: 1 })
    const wrapper = mount(CategoriesTab)

    await wrapper.find('select').setValue('1')
    await wrapper.find('input[type="text"]').setValue('Biquíni')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(categoriesState.addCategory).toHaveBeenCalledWith({ name: 'Biquíni', description: '', parent: 1 })
    expect(toastState.success).toHaveBeenCalledWith('Subcategoria criada com sucesso.')
  })

  it('shows an error toast when category creation fails', async () => {
    categoriesState.addCategory.mockRejectedValue(new Error('boom'))
    const wrapper = mount(CategoriesTab)

    await wrapper.find('input[type="text"]').setValue('Combos')
    await wrapper.find('form').trigger('submit.prevent')
    await flushPromises()

    expect(toastState.error).toHaveBeenCalledWith('Não foi possível salvar a categoria.')
  })

  it('deletes a category and shows a success toast', async () => {
    categoriesState.deleteCategory.mockResolvedValue(undefined)
    const wrapper = mount(CategoriesTab)

    const removeButton = wrapper.find('button[title="Remover categoria"]')
    await removeButton.trigger('click')
    await flushPromises()

    expect(categoriesState.deleteCategory).toHaveBeenCalledWith(1)
    expect(toastState.success).toHaveBeenCalledWith('Categoria removida com sucesso.')
  })

  it('shows the empty state when there are no categories', () => {
    categoriesState.categories.value = []
    const wrapper = mount(CategoriesTab)

    expect(wrapper.text()).toContain('Nenhuma categoria cadastrada.')
  })
})
