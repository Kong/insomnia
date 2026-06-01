import type { Tag } from 'liquidjs';
import { Liquid, Tag as LiquidTag } from 'liquidjs';

import type { Plugin } from '../plugins/types';
import type { PluginTemplateTag } from './types';

export type TagFactory = (ext: PluginTemplateTag, plugin: Plugin) => typeof Tag;

/** Strip Nunjucks-compatible `{# ... #}` comments before parsing with LiquidJS. */
export function stripLiquidComments(text: string): string {
  return text.replace(/\{#[\s\S]*?#\}/g, '');
}

/**
 * Build a configured LiquidJS engine.
 *
 * tagFactory is injected per environment (main vs worker) so each can provide
 * the appropriate helper-context implementation.
 */
export function buildLiquidEngine(opts: {
  strictVariables?: boolean;
  tagFactory: TagFactory;
  tags: { templateTag: PluginTemplateTag; plugin: Plugin }[];
}): { engine: Liquid; tagMetadata: Map<string, PluginTemplateTag> } {
  const { strictVariables = true, tagFactory, tags } = opts;

  const engine = new Liquid({
    outputDelimiterLeft: '{{',
    outputDelimiterRight: '}}',
    tagDelimiterLeft: '{%',
    tagDelimiterRight: '%}',
    strictVariables,
    strictFilters: true, // Enabling for 13.0.0 to catch nonexistent filters.
    jsTruthy: true, // Required to match Nunjucks JS truthiness: '', 0, [] are falsy
    ownPropertyOnly: true, // Contexts are plain objects
    dynamicPartials: false, // Disable dynamic paths to prevent variable-interpolated includes.

    // hard-stop rendering after 10 s and cap object allocations.
    renderLimit: 10_000,
    memoryLimit: 10_000_000,
  });

  // Block built-in file-loading tags — file access must go through the `file` template tag
  // which routes through window.main.secureReadFile (path allowlist).
  class BlockedFileTag extends LiquidTag {
    render(): void {
      throw new Error(
        '{% include %}, {% render %}, and {% layout %} are disabled. Use the File template tag to read files.',
      );
    }
  }
  engine.registerTag('include', BlockedFileTag);
  engine.registerTag('render', BlockedFileTag);
  engine.registerTag('layout', BlockedFileTag);

  // No-op globals to maintain backwards compat with Nunjucks builtins
  engine.registerFilter('debug', (v: unknown) => v);

  const tagMetadata = new Map<string, PluginTemplateTag>();

  for (const { templateTag, plugin } of tags) {
    const TagClass = tagFactory(templateTag, plugin);
    const name = templateTag.name;
    engine.registerTag(name, TagClass as any);
    tagMetadata.set(name, templateTag);
  }

  return { engine, tagMetadata };
}
