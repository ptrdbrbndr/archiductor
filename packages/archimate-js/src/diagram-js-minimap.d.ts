/**
 * Type-declaration shim voor diagram-js-minimap@5.x — package levert geen .d.ts.
 *
 * We exporteren alleen het didi-module-object (default export) waarmee diagram-js
 * de Minimap-service registreert. Het Minimap-object zelf hoeft niet getypeerd
 * te worden voor onze use-case (we callen `viewer.get<{open:()=>void}>("minimap")`
 * in de Viewer-implementatie).
 */
declare module "diagram-js-minimap" {
  const minimapModule: {
    __init__: string[];
    minimap: [string, unknown];
  };
  export default minimapModule;
}
