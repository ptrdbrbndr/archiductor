'use client';

/**
 * <DmnViewer> — read-only DMN 1.3 diagram viewer.
 *
 * Wraps dmn-js/lib/Viewer. Browser-only (dmn-js touches the DOM on import),
 * hence the 'use client' directive.
 *
 * dmn-js is een multi-view manager — importXML opent automatisch de eerste
 * beschikbare view (DRD, DecisionTable of LiteralExpression).
 *
 * The viewer mounts onto a div ref via useEffect and is destroyed on unmount.
 * Width/height fill the parent container; no hardcoded colours.
 *
 * dmn-js heeft geen TypeScript-types; we gebruiken een lokale interface.
 */

import { useEffect, useRef } from 'react';

/** Minimale interface voor dmn-js Viewer (geen @types beschikbaar). */
interface DmnViewerInstance {
  importXML(xml: string): Promise<{ warnings: unknown[] }>;
  destroy(): void;
}

export interface DmnViewerProps {
  /** DMN 1.3 XML string */
  xml: string;
  className?: string;
}

export function DmnViewer({ xml, className }: DmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<DmnViewerInstance | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: ViewerClass } = await import('dmn-js/lib/Viewer') as {
        default: new (opts: { container: HTMLElement }) => DmnViewerInstance;
      };
      if (cancelled || !containerRef.current) return;

      const viewer = new ViewerClass({ container: containerRef.current });
      viewerRef.current = viewer;

      try {
        await viewer.importXML(xml);
      } catch (err) {
        console.error('[DmnViewer] importXML mislukt', err);
      }
    })();

    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [xml]);

  return (
    <div
      ref={containerRef}
      data-testid="dmn-viewer-container"
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
