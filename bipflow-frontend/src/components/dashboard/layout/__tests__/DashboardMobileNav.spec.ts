import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DashboardMobileNav from '../DashboardMobileNav.vue'

const iconStub = { template: '<svg />' }
const routerLinkStub = { template: '<a><slot /></a>' }

const items = [
  { label: 'Visao geral', to: { name: 'Overview' }, icon: iconStub },
  { label: 'Produtos', to: { name: 'Products' }, icon: iconStub },
]

describe('DashboardMobileNav', () => {
  it('renders mobile nav items when open', () => {
    const wrapper = mount(DashboardMobileNav, {
      props: { items, isOpen: true },
      global: {
        stubs: {
          RouterLink: routerLinkStub,
          Transition: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.text()).toContain('Visao geral')
    expect(wrapper.text()).toContain('Produtos')
  })

  it('does not render when closed', () => {
    const wrapper = mount(DashboardMobileNav, {
      props: { items, isOpen: false },
      global: {
        stubs: {
          RouterLink: routerLinkStub,
          Transition: { template: '<div><slot /></div>' },
        },
      },
    })

    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('emits logout when the logout button is clicked', async () => {
    const wrapper = mount(DashboardMobileNav, {
      props: { items, isOpen: true },
      global: {
        stubs: {
          RouterLink: routerLinkStub,
          Transition: { template: '<div><slot /></div>' },
        },
      },
    })

    await wrapper.find('button').trigger('click')
    expect(wrapper.emitted('logout')).toHaveLength(1)
  })
})
