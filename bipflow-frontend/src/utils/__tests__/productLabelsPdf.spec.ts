import { describe, it, expect } from 'vitest'
import { buildProductLabelsPdf } from '../productLabelsPdf'
import type { ProductBulkLabel } from '@/types/productLabel'

function buildLabel(overrides: Partial<ProductBulkLabel> = {}): ProductBulkLabel {
  return {
    id: 1,
    public_code: 'ABCD2345',
    name: 'Produto teste',
    price: '19.90',
    size: null,
    url: 'https://loja.bipflow.app/l/loja-b/p/ABCD2345',
    // jsPDF's addImage() actually decodes the PNG bytes in this test
    // environment (unlike ProductLabelModal.spec.ts/BulkQrLabelsModal.spec.ts,
    // which only ever render this string as an <img src>, never decode it) --
    // a placeholder like "AAAA" fails fast-png's signature check, so this
    // needs a real (if minimal) 1x1 transparent PNG.
    qr_code:
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
    ...overrides,
  }
}

describe('buildProductLabelsPdf', () => {
  it('builds a single page for up to 10 labels', () => {
    const labels = Array.from({ length: 10 }, (_, index) => buildLabel({ id: index + 1 }))

    const doc = buildProductLabelsPdf(labels)

    expect(doc.getNumberOfPages()).toBe(1)
  })

  it('adds a second page once labels exceed one page capacity', () => {
    const labels = Array.from({ length: 11 }, (_, index) => buildLabel({ id: index + 1 }))

    const doc = buildProductLabelsPdf(labels)

    expect(doc.getNumberOfPages()).toBe(2)
  })

  it('produces an A4-sized page regardless of label count', () => {
    const doc = buildProductLabelsPdf([buildLabel()])

    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(210, 0)
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(297, 0)
  })

  it('does not throw with an empty labels array', () => {
    expect(() => buildProductLabelsPdf([])).not.toThrow()
  })

  it('does not throw when a product name is very long', () => {
    const labels = [
      buildLabel({
        name: 'Produto com um nome extremamente longo que certamente ultrapassa a largura da celula da etiqueta',
      }),
    ]

    expect(() => buildProductLabelsPdf(labels)).not.toThrow()
  })

  it('returns a document whose raw output is a valid PDF', () => {
    const doc = buildProductLabelsPdf([buildLabel()])

    const dataUri = doc.output('datauristring')
    const base64 = dataUri.split(',')[1] ?? ''
    const decoded = atob(base64.slice(0, 8))
    expect(decoded.startsWith('%PDF')).toBe(true)
  })
})
