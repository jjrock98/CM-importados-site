import '@testing-library/jest-dom';

// jsdom no implementa IntersectionObserver, y framer-motion lo usa para
// `whileInView` (AnimateIn y compañía). Sin este stub, cualquier test que
// renderice un componente animado con whileInView explota con
// "ReferenceError: IntersectionObserver is not defined" antes de llegar
// a la aserción real.
//
// No se usa "implements IntersectionObserver": lib.dom.d.ts le va
// agregando campos con el tiempo (ej. scrollMargin) y cada uno rompería
// esta clase de nuevo. Como test-double solo necesita cumplir la forma
// en tiempo de ejecución, no el contrato completo del tipo.
class MockIntersectionObserver {
  readonly root: Element | Document | null = null;
  readonly rootMargin: string = '';
  readonly scrollMargin: string = '';
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}

global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;