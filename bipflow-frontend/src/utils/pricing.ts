import type { Product } from '@/types/product'

type PricedVariant = {
  price?: string | number | null
  effective_price?: string | number | null
}

/**
 * Display-only price resolution for the storefront and PDV. The backend stays
 * the single authority at checkout / PDV sale (it recomputes everything from
 * product_id / variant_id / quantity); this only mirrors
 * `Product.get_effective_price(variant)` so the UI shows the right number.
 * See docs/architecture/product-variant-pricing.md.
 */
export function effectiveUnitPrice(
  product: { price: string | number },
  variant?: PricedVariant | null,
): string {
  if (variant) {
    if (variant.effective_price !== null && variant.effective_price !== undefined && variant.effective_price !== '') {
      return String(variant.effective_price)
    }
    if (variant.price !== null && variant.price !== undefined && variant.price !== '') {
      return String(variant.price)
    }
  }
  return String(product.price)
}

/**
 * The price to advertise on a card / detail header for a product, taking its
 * active variants into account. `from` is true when active variants disagree
 * on price (render as "A partir de …").
 */
export function displayPrice(
  product: Pick<Product, 'price' | 'variants'>,
): { amount: string; from: boolean } {
  const active = (product.variants ?? []).filter((variant) => variant.is_active)
  const rawPrices = active.length
    ? active.map((variant) => Number.parseFloat(effectiveUnitPrice(product, variant)))
    : [Number.parseFloat(product.price)]
  const prices = rawPrices.filter((value) => Number.isFinite(value))

  if (prices.length === 0) {
    return { amount: product.price, from: false }
  }

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return { amount: min.toFixed(2), from: max - min > 0.005 }
}
