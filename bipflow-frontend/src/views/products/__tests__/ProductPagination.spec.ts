import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ProductPagination from '../ProductPagination.vue'

function mountPagination(props: {
  currentPage: number
  totalPages: number
  hasPreviousPage: boolean
  hasNextPage: boolean
  showingRange?: string
}) {
  return mount(ProductPagination, {
    props: { showingRange: 'Exibindo 1-12 de 100 produtos', ...props },
  })
}

describe('ProductPagination', () => {
  it('renders nothing when there is only one page', () => {
    const wrapper = mountPagination({
      currentPage: 1,
      totalPages: 1,
      hasPreviousPage: false,
      hasNextPage: false,
    })

    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('renders an ellipsis as a non-interactive element, not a button', () => {
    const wrapper = mountPagination({
      currentPage: 10,
      totalPages: 20,
      hasPreviousPage: true,
      hasNextPage: true,
    })

    const ellipses = wrapper.findAll('span[aria-hidden="true"]').filter((el) => el.text() === '…')
    expect(ellipses.length).toBeGreaterThan(0)

    const pageButtons = wrapper.findAll('button[aria-label^="Ir para página"]')
    expect(pageButtons.some((btn) => btn.text() === '…')).toBe(false)
  })

  it('marks the current page with aria-current and highlights it', () => {
    const wrapper = mountPagination({
      currentPage: 3,
      totalPages: 5,
      hasPreviousPage: true,
      hasNextPage: true,
    })

    const current = wrapper.find('[aria-current="page"]')
    expect(current.exists()).toBe(true)
    expect(current.text()).toBe('3')
  })

  it('emits goToPage when a page number is clicked', async () => {
    const wrapper = mountPagination({
      currentPage: 1,
      totalPages: 5,
      hasPreviousPage: false,
      hasNextPage: true,
    })

    await wrapper.find('[aria-label="Ir para página 3"]').trigger('click')

    expect(wrapper.emitted('goToPage')).toEqual([[3]])
  })

  it('disables and does not emit previousPage on the first page', async () => {
    const wrapper = mountPagination({
      currentPage: 1,
      totalPages: 5,
      hasPreviousPage: false,
      hasNextPage: true,
    })

    const previousButtons = wrapper.findAll('[aria-label="Página anterior"]')
    for (const button of previousButtons) {
      expect(button.attributes('disabled')).toBeDefined()
      await button.trigger('click')
    }

    expect(wrapper.emitted('previousPage')).toBeFalsy()
  })

  it('disables and does not emit nextPage on the last page', async () => {
    const wrapper = mountPagination({
      currentPage: 5,
      totalPages: 5,
      hasPreviousPage: true,
      hasNextPage: false,
    })

    const nextButtons = wrapper.findAll('[aria-label="Próxima página"]')
    for (const button of nextButtons) {
      expect(button.attributes('disabled')).toBeDefined()
      await button.trigger('click')
    }

    expect(wrapper.emitted('nextPage')).toBeFalsy()
  })

  it('emits nextPage/previousPage from the middle of the list', async () => {
    const wrapper = mountPagination({
      currentPage: 3,
      totalPages: 5,
      hasPreviousPage: true,
      hasNextPage: true,
    })

    await wrapper.findAll('[aria-label="Próxima página"]')[0]!.trigger('click')
    await wrapper.findAll('[aria-label="Página anterior"]')[0]!.trigger('click')

    expect(wrapper.emitted('nextPage')).toHaveLength(1)
    expect(wrapper.emitted('previousPage')).toHaveLength(1)
  })

  it('shows the showingRange text', () => {
    const wrapper = mountPagination({
      currentPage: 1,
      totalPages: 5,
      hasPreviousPage: false,
      hasNextPage: true,
      showingRange: 'Exibindo 1-12 de 50 produtos',
    })

    expect(wrapper.text()).toContain('Exibindo 1-12 de 50 produtos')
  })
})
