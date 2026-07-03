import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DashboardHeaderBranding from '../DashboardHeaderBranding.vue'

describe('DashboardHeaderBranding', () => {
  it('renders branding name and tagline', () => {
    const wrapper = mount(DashboardHeaderBranding, {
      props: {
        branding: {
          logoUrl: null,
          name: 'BipFlow',
          tagline: 'Gestao de vendas',
        },
      },
    })

    expect(wrapper.text()).toContain('BipFlow')
    expect(wrapper.text()).toContain('Gestao de vendas')
  })
})
