import { useState, useEffect } from 'react';
import type { Annotation, AnnotationFile, TocSection } from '../types/annotations';
import { parseAnnotations } from '../utils/parseAnnotations';

interface UseAnnotationsResult {
  annotations: Annotation[];
  sections: TocSection[];
  title: string;
  loading: boolean;
  error: string | null;
}

export function useAnnotations(annotationsUrl: string | undefined): UseAnnotationsResult {
  const [data, setData] = useState<AnnotationFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!annotationsUrl) {
      setData(null);
      return;
    }

    const loadAnnotations = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(annotationsUrl);

        if (response.status === 404) {
          setData(null);
          return;
        }

        if (!response.ok) {
          const errorMsg = `Failed to load annotations: ${response.status}`;
          console.warn('Error loading annotations:', errorMsg);
          setError(errorMsg);
          setData(null);
          return;
        }

        const markdown = await response.text();
        const parsed = parseAnnotations(markdown);
        setData(parsed);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        console.warn('Error loading annotations:', err);
        setError(errorMsg);
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    loadAnnotations();
  }, [annotationsUrl]);

  return {
    annotations: data?.annotations ?? [],
    sections: data?.sections ?? [],
    title: data?.title ?? 'Annotations',
    loading,
    error,
  };
}
