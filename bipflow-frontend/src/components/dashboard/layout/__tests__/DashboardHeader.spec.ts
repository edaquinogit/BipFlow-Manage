import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DashboardHeader from '../DashboardHeader.vue'

const stores = [
  {
    id: 1,
    name: 'Loja A',
    slug: 'loja-a',
    whatsapp_phone: '5511999999999',
    is_active: true,
    receipt_exchange_policy: '',
    receipt_paper_format: '80mm' as const,
  },
  {
    id: 2,
    name: 'Loja B',
    slug: 'loja-b',
    whatsapp_phone: '5511888888888',
    is_active: false,
    receipt_exchange_policy: '',
    receipt_paper_format: '80mm' as const,
  },
]

const selectedStore = stores[0]

const mountHeader = () =>
  mount(DashboardHeader, {
    props: {
      userName: 'Ana',
      stores,
      selectedStore,
      isStoreLoading: false,
      storefrontPath: '/produtos',
    },
    global: {
      stubs: {
        RouterLink: { template: '<a><slot /></a>' },
        Transition: { template: '<div><slot /></div>' },
      },
    },
  })

describe('DashboardHeader', () => {
  it('renders a polished welcome message with the user name', () => {
    const wrapper = mountHeader()

    const text = wrapper.text()
    expect(text).toContain('Ana')
    expect(text).toMatch(/pedidos de hoje|fluxo estavel|consistencia/)
    // The greeting is "Bom dia" (masculine "dia"), not "Boa dia" -- this
    // used to only match the latter, so it passed or failed depending on
    // what time of day (and which timezone) the suite happened to run in.
    expect(text).toMatch(/Bom dia|Boa tarde|Boa noite/)
  })

  it('toggles the mobile nav and emits logout from the mobile menu', async () => {
    const wrapper = mountHeader()

    const mobileToggle = wrapper.find('button[aria-label="Abrir menu de navegacao"]')
    expect(mobileToggle.exists()).toBe(true)

    await mobileToggle.trigger('click')
    expect(wrapper.find('nav[aria-label="Secoes do dashboard (mobile)"]').exists()).toBe(true)

    const logoutButton = wrapper.find('button:has(svg) + span, button:contains("Finalizar sessao")')
    if (!logoutButton.exists()) {
      // Fallback to button text search if the CSS selector is not supported by the DOM implementation
      const button = wrapper.findAll('button').find((btn) => btn.text().includes('Finalizar sessao'))
      expect(button).toBeDefined()
      await button!.trigger('click')
    } else {
      await logoutButton.trigger('click')
    }

    expect(wrapper.emitted('logout')?.[0]).toEqual([])
  })

  it('opens the storefront menu with a copyable link and an entry point to the store', async () => {
    const wrapper = mountHeader()

    await wrapper.find('button[title="Ver vitrine"]').trigger('click')

    const enterLink = wrapper.find('a[href*="/produtos"]')
    expect(enterLink.exists()).toBe(true)
    expect(enterLink.text()).toContain('Entrar na vitrine')
    expect(enterLink.attributes('target')).toBe('_blank')
  })

})
