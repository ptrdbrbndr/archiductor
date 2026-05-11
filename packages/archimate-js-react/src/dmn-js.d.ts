/**
 * Minimale type-declaraties voor dmn-js (geen @types/dmn-js beschikbaar).
 */
declare module 'dmn-js/lib/Viewer' {
  interface ViewerOptions {
    container: HTMLElement;
    width?: string | number;
    height?: string | number;
  }

  interface ImportResult {
    warnings: unknown[];
  }

  class Viewer {
    constructor(options: ViewerOptions);
    importXML(xml: string): Promise<ImportResult>;
    destroy(): void;
  }

  export default Viewer;
}
