import { getKonnectRegionalApiBase, type KonnectPlugin } from './api';

export interface DeckCommandContext {
  controlPlaneName: string;
  region: string;
  routeId: string;
}

const shellSingleQuote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;

const yamlScalar = (value: string) => JSON.stringify(value);

function konnectFlags({ controlPlaneName, region }: DeckCommandContext): string {
  return [
    `--konnect-control-plane-name ${shellSingleQuote(controlPlaneName)}`,
    '--konnect-token "$KONNECT_TOKEN"',
    `--konnect-addr ${shellSingleQuote(getKonnectRegionalApiBase(region))}`,
  ].join(' \\\n  ');
}

// Generated from the decK CLI reference:
// - https://developer.konghq.com/deck/gateway/dump/
// - https://developer.konghq.com/deck/gateway/apply/
// - https://developer.konghq.com/deck/gateway/konnect-configuration/
function dumpCommand(context: DeckCommandContext, includeIds = false): string {
  const lines = ['deck gateway dump', `  ${konnectFlags(context)}`];
  if (includeIds) {
    // Without --with-id the dump omits entity ids, so the commented plugin id
    // below would not exist in kong.yaml.
    lines.push('  --with-id');
  }
  lines.push('  -o kong.yaml');
  return lines.join(' \\\n');
}

function applyCommand(context: DeckCommandContext): string {
  return `deck gateway apply kong.yaml \\\n  ${konnectFlags(context)}`;
}

/**
 * Applied plugins are edited in place. The plugin's config values are
 * deliberately not rendered here: plugin configs can contain credentials, and
 * the request Plugins tab only needs to surface metadata.
 */
export function buildDeckEditCommand(plugin: KonnectPlugin, context: DeckCommandContext): string {
  const label = plugin.instance_name ? `${plugin.name} (${plugin.instance_name})` : plugin.name;
  return [
    '# 1. Export the current control plane configuration',
    dumpCommand(context, true),
    '',
    `# 2. Edit the plugin with id ${plugin.id} in kong.yaml.`,
    `#    Plugin: ${label}`,
    '',
    '# 3. Apply the change without deleting other entities',
    applyCommand(context),
  ].join('\n');
}

/**
 * Suggested plugins are not applied yet, so there is no existing config to
 * expose. The snippet is a starting point; required config fields must be
 * filled in from the plugin docs.
 */
export function buildDeckAddCommand(pluginName: string, context: DeckCommandContext): string {
  const snippet = [
    '_format_version: "3.0"',
    'plugins:',
    `  - name: ${yamlScalar(pluginName)}`,
    `    route: ${yamlScalar(context.routeId)}`,
    '    config: {}',
  ].join('\n');
  return [
    '# 1. Export the current control plane configuration',
    // The snippet references the route by id, so the dump must retain ids.
    dumpCommand(context, true),
    '',
    '# 2. Add this plugin to kong.yaml and fill in its required config:',
    snippet,
    '',
    '# 3. Apply the change without deleting other entities',
    applyCommand(context),
  ].join('\n');
}
