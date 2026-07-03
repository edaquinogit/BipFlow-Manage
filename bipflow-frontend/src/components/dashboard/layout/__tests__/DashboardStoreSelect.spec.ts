import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DashboardStoreSelect from '../DashboardStoreSelect.vue'

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

describe('DashboardStoreSelect', () => {
  it('renders the select and options', () => {
    const wrapper = mount(DashboardStoreSelect, {
      props: { stores, selectedStore: stores[0], isStoreLoading: false },
    })

    const options = wrapper.findAll('option')
    expect(options).toHaveLength(3)
    expect(options.at(1)?.text()).toBe('Loja A')
  })

  it('emits select-store when a store is selected', async () => {
    const wrapper = mount(DashboardStoreSelect, {
      props: { stores, selectedStore: stores[0], isStoreLoading: false },
    })

    await wrapper.find('select').setValue('loja-b')
    expect(wrapper.emitted('select-store')?.[0]).toEqual(['loja-b'])
  })

  it('shows loading text when store list is loading', () => {
    const wrapper = mount(DashboardStoreSelect, {
      props: { stores: [], selectedStore: null, isStoreLoading: true },
    })

    expect(wrapper.find('option').text()).toBe('Carregando loja...')
  })
})
