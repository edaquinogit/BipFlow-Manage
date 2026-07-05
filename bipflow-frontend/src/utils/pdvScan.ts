/**
 * Etapa C1 of the PDV camera-scanner evolution (see
 * docs/architecture/pdv-camera-scanner-refinement.md): the QR Code printed
 * on a product label doesn't encode the bare `public_code` -- it encodes the
 * full public storefront deep-link URL (`build_product_deep_link_url()` in
 * `bipdelivery/api/product_labels.py`), so a generic customer camera lands
 * on the product page. A camera-based scan in the PDV decodes that same QR,
 * so the raw decoded text is a URL, not a code -- this extracts the trailing
 * `/p/<code>` segment before handing it to the existing by-code lookup
 * (`ProductService.getByCode`), which only ever matched a bare code.
 */
const DEEP_LINK_CODE_PATTERN = /\/p\/([^/?#]+)(?:[/?#].*)?$/i;

/**
 * Normalizes whatever a scan produced (a decoded deep-link URL from the
 * camera, or a bare code from a USB HID scanner / manual typing) into the
 * `public_code` the by-code lookup expects. Falls back to the trimmed input
 * unchanged when it doesn't look like a deep-link URL, preserving today's
 * manual/HID behavior exactly.
 */
export function extractPublicCodeFromScan(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(DEEP_LINK_CODE_PATTERN);
  return match?.[1] ?? trimmed;
}
