'use client';

/**
 * <CmmnViewer> — read-only CMMN 1.1 diagram viewer.
 *
 * Wraps cmmn-js/lib/Viewer. Browser-only (cmmn-js touches the DOM on import),
 * hence the 'use client' directive.
 *
 * The viewer mounts onto a div ref via useEffect and is destroyed on unmount.
 * Width/height fill the parent container; no hardcoded colours.
 *
 * cmmn-js importXML uses callback-style (not Promise) — we wrap it here.
 * cmmn-js heeft geen TypeScript-types; we gebruiken een lokale interface.
 */

import { useEffect, useRef } from 'react';

/** Minimale interface voor cmmn-js Viewer (geen @types beschikbaar). */
interface CmmnViewerInstance {
  importXML(xml: string, done: (err: Error | null, warnings?: unknown[]) => void): void;
  destroy(): void;
}

export interface CmmnViewerProps {
  /** CMMN 1.1 XML string */
  xml: string;
  className?: string;
}

export function CmmnViewer({ xml, className }: CmmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<CmmnViewerInstance | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      // cmmn-js gebruikt CommonJS module.exports — interop via mod.default ?? mod
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const mod = await import('cmmn-js/lib/Viewer') as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ViewerClass = (mod.default ?? mod) as new (opts: { container: HTMLElement }) => CmmnViewerInstance;
      if (cancelled || !containerRef.current) return;

      const viewer = new ViewerClass({ container: containerRef.current });
      viewerRef.current = viewer;

      await new Promise<void>((resolve, reject) => {
        viewer.importXML(xml, (err) => {
          if (err) {
            console.error('[CmmnViewer] importXML mislukt', err);
            reject(err);
          } else {
            resolve();
          }
        });
      }).catch(() => {
        // Fout gelogd in callback; geen verdere actie vereist
      });
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
      data-testid="cmmn-viewer-container"
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
