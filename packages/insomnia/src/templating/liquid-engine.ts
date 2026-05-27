import type { Tag } from 'liquidjs';
import { Liquid } from 'liquidjs';

import type { Plugin } from '../plugins/index';
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
    strictFilters: false,
    // Match Nunjucks JS truthiness: '', 0, [] are falsy
    jsTruthy: true,
    // Allow prototype-chain access on context objects
    ownPropertyOnly: false,
  });

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
