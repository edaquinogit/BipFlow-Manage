import "@testing-library/jest-dom";

// jsdom has no IntersectionObserver -- components that use it for infinite
// scroll (e.g. ProductsView's load-more sentinel) throw a ReferenceError as
// soon as a test renders their trigger element, otherwise. A plain global
// assignment (not vi.stubGlobal) so an individual test file's own
// `vi.unstubAllGlobals()` cleanup can't wipe this shared polyfill out from
// under every other test.
class IntersectionObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

(globalThis as unknown as { IntersectionObserver: typeof IntersectionObserverStub }).IntersectionObserver =
  IntersectionObserverStub;
