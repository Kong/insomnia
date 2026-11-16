import { describe, expect, it } from 'vitest';

import type { KonnectPlugin } from '../api';
import { getKonnectRegionalApiBase } from '../api';
import { buildDeckAddCommand, buildDeckEditCommand } from '../deck';

const context = { controlPlaneName: 'Insomnia Airlines', region: 'us', routeId: 'route-1' };

function plugin(overrides: Partial<KonnectPlugin> = {}): KonnectPlugin {
  return {
    id: 'plugin-1',
    name: 'rate-limiting',
    instance_name: null,
    enabled: true,
    config: null,
    protocols: null,
    tags: null,
    condition: null,
    ordering: null,
    route: null,
    service: null,
    consumer: null,
    consumer_group: null,
    ...overrides,
  };
}

describe('buildDeckEditCommand', () => {
  it('exports, locates the plugin by id, and applies without deleting other entities', () => {
    const command = buildDeckEditCommand(plugin(), context);

    expect(command).toContain('deck gateway dump');
    expect(command).toContain('--konnect-control-plane-name');
    expect(command).toContain(`'Insomnia Airlines'`);
    expect(command).toContain(`'${getKonnectRegionalApiBase('us')}'`);
    expect(command).toContain('id plugin-1');
    expect(command).toContain('Plugin: rate-limiting');
    expect(command).toContain('--with-id');
    expect(command).toContain('deck gateway apply kong.yaml');
    expect(command).not.toContain('deck gateway sync');
  });

  it('does not render plugin config values', () => {
    const command = buildDeckEditCommand(plugin({ config: { client_secret: 'super-secret' } }), context);

    expect(command).not.toContain('super-secret');
  });

  it('includes the instance name when present', () => {
    const command = buildDeckEditCommand(plugin({ instance_name: 'primary-auth' }), context);

    expect(command).toContain('Plugin: rate-limiting (primary-auth)');
  });

  it('escapes single quotes in shell arguments', () => {
    const command = buildDeckEditCommand(plugin(), { ...context, controlPlaneName: "Bob's CP" });

    expect(command).toContain(`'Bob'\\''s CP'`);
  });
});

describe('buildDeckAddCommand', () => {
  it('builds a route-scoped template with empty config', () => {
    const command = buildDeckAddCommand('cors', context);

    expect(command).toContain('  - name: "cors"');
    expect(command).toContain('    route: "route-1"');
    expect(command).toContain('    config: {}');
    expect(command).toContain('deck gateway apply kong.yaml');
    expect(command).toContain('--with-id');
  });
});
