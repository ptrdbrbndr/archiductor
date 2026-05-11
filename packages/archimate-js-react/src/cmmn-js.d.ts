/**
 * Minimale type-declaraties voor cmmn-js (geen @types/cmmn-js beschikbaar).
 */
declare module 'cmmn-js/lib/Viewer' {
  interface ViewerOptions {
    container: HTMLElement;
    width?: string | number;
    height?: string | number;
  }

  class Viewer {
    constructor(options: ViewerOptions);
    importXML(xml: string, done: (err: Error | null, warnings?: unknown[]) => void): void;
    destroy(): void;
    detach(): void;
  }

  export = Viewer;
}
