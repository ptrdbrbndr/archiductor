'use client';

/**
 * <BpmnViewer> — read-only BPMN 2.0 diagram viewer.
 *
 * Wraps bpmn-js/lib/Viewer. Browser-only (bpmn-js touches the DOM on import),
 * hence the 'use client' directive.
 *
 * The viewer mounts onto a div ref via useEffect and is destroyed on unmount.
 * Width/height fill the parent container; no hardcoded colours.
 */

import { useEffect, useRef } from 'react';
import type Viewer from 'bpmn-js/lib/Viewer';

export interface BpmnViewerProps {
  /** BPMN 2.0 XML string */
  xml: string;
  className?: string;
}

export function BpmnViewer({ xml, className }: BpmnViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<InstanceType<typeof Viewer> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const { default: ViewerClass } = await import('bpmn-js/lib/Viewer');
      if (cancelled || !containerRef.current) return;

      const viewer = new ViewerClass({ container: containerRef.current });
      viewerRef.current = viewer;

      try {
        await viewer.importXML(xml);
        const canvas = viewer.get<{ zoom: (level: 'fit-viewport') => void }>('canvas');
        canvas.zoom('fit-viewport');
      } catch (err) {
        console.error('[BpmnViewer] importXML mislukt', err);
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
      data-testid="bpmn-viewer-container"
      className={className}
      style={{ width: '100%', height: '100%' }}
    />
  );
}
