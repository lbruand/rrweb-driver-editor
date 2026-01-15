import { useEffect, useRef, useCallback } from 'react';
import { driver, type Driver } from 'driver.js';
import 'driver.js/dist/driver.css';
import type { Annotation } from '../types/annotations';

interface AnnotationOverlayProps {
  activeAnnotation: Annotation | null;
  iframeElement: HTMLIFrameElement | null;
  onDismiss: () => void;
}

export function AnnotationOverlay({
  activeAnnotation,
  iframeElement,
  onDismiss,
}: AnnotationOverlayProps) {
  const driverRef = useRef<Driver | null>(null);

  const cleanup = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      driverRef.current = null;
    }
    // Clean up any phantom elements
    document.querySelectorAll('[data-annotation-phantom]').forEach((el) => el.remove());
  }, []);

  useEffect(() => {
    if (!activeAnnotation?.driverJsCode || !iframeElement) {
      cleanup();
      return;
    }

    const iframeDoc = iframeElement.contentDocument;
    if (!iframeDoc) {
      console.warn('Cannot access iframe document');
      onDismiss();
      return;
    }

    // Create driver instance
    driverRef.current = driver({
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.7)',
      popoverClass: 'annotation-popover',
      allowClose: true,
      onDestroyed: () => {
        onDismiss();
      },
    });

    // Create a helper to create phantom elements for iframe elements
    const createPhantom = (selector: string): HTMLElement | null => {
      const targetElement = iframeDoc.querySelector(selector);
      if (!targetElement) {
        console.warn(`Element not found for selector: ${selector}`);
        return null;
      }

      const iframeRect = iframeElement.getBoundingClientRect();
      const elementRect = targetElement.getBoundingClientRect();

      // Calculate scale factor - the iframe content may be scaled by rrweb player
      // Compare the iframe's visual size to its internal document size
      const iframeInternalWidth = iframeElement.contentWindow?.innerWidth || iframeDoc.documentElement.scrollWidth;
      const iframeInternalHeight = iframeElement.contentWindow?.innerHeight || iframeDoc.documentElement.scrollHeight;
      const scaleX = iframeRect.width / iframeInternalWidth;
      const scaleY = iframeRect.height / iframeInternalHeight;

      const phantom = document.createElement('div');
      phantom.style.cssText = `
        position: fixed;
        left: ${iframeRect.left + elementRect.left * scaleX}px;
        top: ${iframeRect.top + elementRect.top * scaleY}px;
        width: ${elementRect.width * scaleX}px;
        height: ${elementRect.height * scaleY}px;
        pointer-events: none;
        z-index: -1;
      `;
      phantom.setAttribute('data-annotation-phantom', 'true');
      document.body.appendChild(phantom);
      return phantom;
    };

    // Execute the driver.js code
    // The code has access to `driverObj` (the driver instance) and `createPhantom` helper
    try {
      const executeCode = new Function(
        'driverObj',
        'createPhantom',
        'iframeDoc',
        activeAnnotation.driverJsCode
      );
      executeCode(driverRef.current, createPhantom, iframeDoc);
    } catch (err) {
      console.error('Error executing driver.js code:', err);
      onDismiss();
    }

    return cleanup;
  }, [activeAnnotation, iframeElement, onDismiss, cleanup]);

  return null;
}
