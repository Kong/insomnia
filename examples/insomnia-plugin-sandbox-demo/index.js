// eslint-disable-next-line no-undef
module.exports.templateTags = [
  {
    name: 'sandboxprobe',
    displayName: 'Sandbox Probe',
    description: 'Reports whether it executed inside the QuickJS sandbox, and exercises an async bridge',
    args: [{ displayName: 'Label', type: 'string', defaultValue: 'hello' }],
    async run(context, label = 'hello') {
      // The sandbox sets INSOMNIA_TEMPLATE_SANDBOX; the legacy main-process path does not. (Both now
      // have `process` — the sandbox provides a stub since M2 — so it can't be the discriminator.)
      // eslint-disable-next-line no-undef -- sandbox-only global; guarded by typeof
      const ranIn = typeof INSOMNIA_TEMPLATE_SANDBOX !== 'undefined' ? 'sandbox' : 'main-process';

      // Exercise an async host bridge — proves __hostBridge + the executePendingJobs driver loop
      // round-trip work end-to-end (context.util.nodeOS -> pluginToMainAPI['nodeOS']).
      let arch = 'n/a';
      try {
        const os = await context.util.nodeOS();
        arch = os.arch;
      } catch (err) {
        arch = 'bridge-error:' + err.message;
      }

      return `${label} | ran in: ${ranIn} | arch via bridge: ${arch}`;
    },
  },
  {
    name: 'requireprobe',
    displayName: 'Require Probe',
    description: 'Requires the named module to demo manifest-gated module resolution (M1)',
    args: [{ displayName: 'Module', type: 'string', defaultValue: 'path' }],
    async run(context, mod = 'path') {
      // With the sandbox on, baseline modules (path, crypto) resolve from the curated registry;
      // anything else fails with "Module 'X' not permitted by manifest".
      if (mod === 'path') {
        // eslint-disable-next-line no-undef, unicorn/prefer-node-protocol -- CJS plugin requiring the registry's canonical module name
        return require('path').join('a', 'b');
      }
      // eslint-disable-next-line no-undef -- CJS plugin
      return typeof require(mod);
    },
  },
  {
    name: 'eventsprobe',
    displayName: 'Events Probe',
    description: "Demos a manifest-granted module: this plugin declares insomnia.permissions.modules ['events']",
    args: [],
    async run() {
      // Works because package.json declares the `events` grant; a plugin without it would get
      // "Module 'events' not permitted by manifest".
      // eslint-disable-next-line no-undef, unicorn/prefer-node-protocol -- CJS plugin requiring the registry's canonical module name
      const EventEmitter = require('events').EventEmitter;
      // eslint-disable-next-line unicorn/prefer-event-target -- demoing the sandbox 'events' module, not browser EventTarget
      const emitter = new EventEmitter();
      let out = '';
      emitter.on('ping', value => {
        out = value;
      });
      emitter.emit('ping', 'events-ok');
      return out;
    },
  },
  {
    name: 'stdlibprobe',
    displayName: 'Stdlib Probe',
    description: 'Demos the ambient sandbox globals (Buffer/URL/process) seeded in M2',
    args: [{ displayName: 'API', type: 'string', defaultValue: 'buffer' }],
    async run(context, api = 'buffer') {
      // These globals are always present in the sandbox (not manifest-gated) as pure-JS/host-backed
      // safe equivalents. Output matches the legacy main-process render.
      if (api === 'url') {
        // eslint-disable-next-line no-undef -- URL is a sandbox-provided ambient global
        return new URL('https://example.com:8443/p?a=1').host;
      }
      if (api === 'platform') {
        // eslint-disable-next-line no-undef -- process stub is a sandbox-provided ambient global
        return process.platform;
      }
      // eslint-disable-next-line no-undef -- Buffer is a sandbox-provided ambient global
      return Buffer.from('hi 👋').toString('base64');
    },
  },
];
