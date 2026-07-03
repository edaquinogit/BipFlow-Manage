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
  },
  {
    id: 2,
    name: 'Loja B',
    slug: 'loja-b',
    whatsapp_phone: '5511888888888',
    is_active: false,
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
  it('renders the store picker with the active store selected', () => {
    const wrapper = mountHeader()

    const select = wrapper.find('select')
    expect(select.exists()).toBe(true)
    expect(select.element.value).toBe('loja-a')

    const options = wrapper.findAll('option')
    expect(options).toHaveLength(3)
    expect(options.at(1)?.text()).toBe('Loja A')
  })

  it('renders a polished welcome message with the user name', () => {
    const wrapper = mountHeader()

    const text = wrapper.text()
    expect(text).toContain('Ana')
    expect(text).toContain('O que vamos pedir hoje')
    expect(text).toMatch(/Boa (tarde|noite|dia)/)
  })

  it('emits selectStore when the store selector changes', async () => {
    const wrapper = mountHeader()

    await wrapper.find('select').setValue('loja-b')
    expect(wrapper.emitted('selectStore')?.[0]).toEqual(['loja-b'])
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

  it('emits openStore when the storefront button is clicked', async () => {
    const wrapper = mountHeader()

    await wrapper.find('a[title="Abrir /produtos"]').trigger('click')
    expect(wrapper.emitted('openStore')?.[0]).toEqual([])
  })
})
