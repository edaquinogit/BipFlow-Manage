import { describe, expect, it } from 'vitest'
import { buildCategoryTree, flattenCategoryTree, getCategoryDisplayName } from '../categories'

describe('category utilities', () => {
  it('groups subcategories under their parent and keeps parent before children', () => {
    const categories = [
      { id: 2, name: 'Biquíni', parent: 1, parent_name: 'Moda Praia' },
      { id: 1, name: 'Moda Praia', parent: null },
      { id: 3, name: 'Acessórios', parent: null },
    ]

    const tree = buildCategoryTree(categories)
    const flat = flattenCategoryTree(categories)

    expect(tree.map((category) => category.name)).toEqual(['Acessórios', 'Moda Praia'])
    expect(tree[1]?.children.map((category) => category.name)).toEqual(['Biquíni'])
    expect(flat.map((category) => category.name)).toEqual(['Acessórios', 'Moda Praia', 'Biquíni'])
  })

  it('renders a subcategory path when parent_name is available', () => {
    expect(getCategoryDisplayName({ id: 2, name: 'Biquíni', parent: 1, parent_name: 'Moda Praia' }))
      .toBe('Moda Praia / Biquíni')
  })
})
