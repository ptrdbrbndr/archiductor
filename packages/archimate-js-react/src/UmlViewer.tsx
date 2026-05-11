'use client';

/**
 * <UmlViewer> — read-only UML 2.5 diagram viewer.
 *
 * Wraps de Viewer class uit uml-js. Browser-only (uml-js / diagram-js raken
 * de DOM bij import), vandaar de 'use client' directive.
 *
 * De viewer mount op een div-ref via useEffect en wordt opgeruimd op unmount.
 * Breedte/hoogte vullen de parent-container; geen hardcoded kleuren.
 */

import { useEffect, useRef } from 'react';
import type { Viewer as UmlViewerInstance } from 'uml-js';

export interface UmlViewerProps {
  /** Eclipse UML2 XMI 2.5 XML string */
  xml: string;
  className?: string;
}

export function UmlViewer({ xml, className }: UmlViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<UmlViewerInstance | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const { Viewer } = await import('uml-js');
      if (cancelled || !containerRef.current) return;

      const viewer = new Viewer({ container: containerRef.current });
      viewerRef.current = viewer;

      try {
        await viewer.importXml(xml);
        const canvas = viewer.get<{ zoom: (level: 'fit-viewport') => void }>('canvas');
        canvas.zoom('fit-viewport');
      } catch (err) {
        console.error('[UmlViewer] importXml mislukt', err);
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
      data-testid="uml-viewer-container"
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
