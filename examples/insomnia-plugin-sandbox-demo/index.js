// eslint-disable-next-line no-undef
module.exports.templateTags = [
  {
    name: 'sandboxprobe',
    displayName: 'Sandbox Probe',
    description: 'Reports whether it executed inside the QuickJS sandbox, and exercises an async bridge',
    args: [
      { displayName: 'Label', type: 'string', defaultValue: 'hello' },
    ],
    async run(context, label = 'hello') {
      // In the QuickJS sandbox, Node globals like `process` are absent; in the legacy main-process
      // path they exist. This makes the chosen execution path directly observable in the output.
      const ranIn = typeof process === 'undefined' ? 'sandbox' : 'main-process';

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
];
