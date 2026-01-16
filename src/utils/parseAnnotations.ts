import type { Annotation, AnnotationFile, TocSection } from '../types/annotations';

function extractIdFromHeading(heading: string): { title: string; id: string } {
  const match = heading.match(/^(.+?)\s*\{#([^}]+)}\s*$/);
  if (match) {
    return { title: match[1].trim(), id: match[2] };
  }
  const id = heading.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { title: heading, id };
}

function parseSimpleYaml(yamlContent: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = yamlContent.split('\n');

  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value: string | number | boolean = line.slice(colonIndex + 1).trim();

      // Remove backticks if present (for color values like `#2196F3`)
      value = value.replace(/^`|`$/g, '');

      // Remove quotes if present
      value = value.replace(/^["']|["']$/g, '');

      // Parse booleans
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      // Parse numbers
      else if (/^\d+$/.test(value)) value = parseInt(value, 10);

      result[key] = value;
    }
  }
  return result;
}

function parseFrontmatter(markdown: string): { data: Record<string, unknown>; content: string } {
  // Check if the file starts with ---
  if (!markdown.startsWith('---')) {
    return { data: {}, content: markdown };
  }

  // Find the closing ---
  const endIndex = markdown.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { data: {}, content: markdown };
  }

  const yamlContent = markdown.slice(4, endIndex);
  const content = markdown.slice(endIndex + 4).trim();
  const data = parseSimpleYaml(yamlContent);

  return { data, content };
}

function parseYamlBlock(content: string): Record<string, unknown> {
  const yamlMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (!yamlMatch) return {};
  return parseSimpleYaml(yamlMatch[1]);
}

function extractDriverJsCode(content: string): string | undefined {
  const match = content.match(/```driverjs\n([\s\S]*?)```/);
  return match ? match[1].trim() : undefined;
}

function extractDescription(content: string): string | undefined {
  const text = content
    .replace(/^---\n[\s\S]*?\n---\n?/, '')
    .replace(/```driverjs\n[\s\S]*?```\n?/, '')
    .trim();

  return text || undefined;
}

export function parseAnnotations(markdown: string): AnnotationFile {
  const { data: frontmatter, content } = parseFrontmatter(markdown);

  const sections: TocSection[] = [];
  const allAnnotations: Annotation[] = [];

  let currentSection: TocSection | null = null;

  const lines = content.split('\n');
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check for section heading (## Section: ...)
    const sectionMatch = line.match(/^##\s+Section:\s*(.+)$/);
    if (sectionMatch) {
      const { title, id } = extractIdFromHeading(sectionMatch[1]);
      currentSection = { id, title, annotations: [] };
      sections.push(currentSection);
      i++;
      continue;
    }

    // Check for annotation heading (### Annotation: ...)
    const annotationMatch = line.match(/^###\s+Annotation:\s*(.+)$/);
    if (annotationMatch) {
      const { title, id } = extractIdFromHeading(annotationMatch[1]);

      // Collect all content until next heading
      i++;
      let annotationContent = '';
      while (i < lines.length && !lines[i].match(/^#{2,3}\s/)) {
        annotationContent += lines[i] + '\n';
        i++;
      }

      // Parse the annotation content
      const yamlData = parseYamlBlock(annotationContent);
      const driverJsCode = extractDriverJsCode(annotationContent);
      const description = extractDescription(annotationContent);

      const annotation: Annotation = {
        id,
        title,
        timestamp: typeof yamlData.timestamp === 'number' ? yamlData.timestamp : 0,
        color: typeof yamlData.color === 'string' ? yamlData.color : undefined,
        autopause: typeof yamlData.autopause === 'boolean' ? yamlData.autopause : undefined,
        description,
        driverJsCode,
        sectionId: currentSection?.id,
      };

      allAnnotations.push(annotation);

      if (currentSection) {
        currentSection.annotations.push(annotation);
      } else {
        // Annotation without a section - create a default section
        if (sections.length === 0 || sections[sections.length - 1].id !== '_default') {
          const defaultSection: TocSection = { id: '_default', title: 'Annotations', annotations: [] };
          sections.push(defaultSection);
          currentSection = defaultSection;
        }
        currentSection!.annotations.push(annotation);
      }

      continue;
    }

    i++;
  }

  // Sort annotations by timestamp
  allAnnotations.sort((a, b) => a.timestamp - b.timestamp);

  return {
    version: typeof frontmatter.version === 'number' ? frontmatter.version : 1,
    title: typeof frontmatter.title === 'string' ? frontmatter.title : 'Annotations',
    sections,
    annotations: allAnnotations,
  };
}
