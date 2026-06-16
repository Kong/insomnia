// Renderer-safe templating utilities — no Node.js imports.
// Use this module from renderer code instead of templating/index.

export { NUNJUCKS_TEMPLATE_GLOBAL_PROPERTY_NAME, LIQUID_TEMPLATE_GLOBAL_PROPERTY_NAME } from '~/common/templating/constants';

// No-op in renderer: the web worker manages its own engine lifecycle.
export function reload(): void {}

// Return text as-is for renderer linting; the worker handles actual rendering.
export async function render(text: string, _config: Record<string, unknown> = {}): Promise<string | null> {
  return text;
}

// Get template tag definitions without loading Node-dependent plugin code.
// Return type intentionally untyped (same as index.ts original) so callers can access
// extra fields like liveDisplayName that live on the tag metadata but not on NunjucksParsedTag.

export async function getTagDefinitions(): Promise<any[]> {
  const [{ localTemplateTags }, { plugins }] = await Promise.all([
    import('~/common/templating/local-template-tags'),
    import('~/ui/plugins/renderer-bridge'),
  ]);

  const pluginTags = await plugins.getTemplateTags();

  const allTags: { templateTag: Record<string, any> }[] = [
    ...localTemplateTags,
    ...pluginTags.map((t: any) => ({ templateTag: t.templateTag as Record<string, any> })),
  ];

  allTags.forEach((ext, i) => {
    ext.templateTag.priority = ext.templateTag.priority ?? i;
  });

  return allTags
    .filter(ext => !ext.templateTag.deprecated)
    .sort((a, b) => (a.templateTag.priority > b.templateTag.priority ? 1 : -1))
    .map(ext => ({
      name: ext.templateTag.name || '',
      displayName:
        typeof ext.templateTag.displayName === 'string' ? ext.templateTag.displayName : ext.templateTag.name || '',
      liveDisplayName: ext.templateTag.liveDisplayName || (() => ''),
      description: ext.templateTag.description,
      disablePreview: ext.templateTag.disablePreview || (() => false),
      args: ext.templateTag.args || [],
      actions: ext.templateTag.actions || [],
    }));
}
