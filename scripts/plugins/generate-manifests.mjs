// Generates every Claude Code and Codex plugin manifest from plugins/plugins.json (the single source of truth),
// so name/version/description/license are never edited by hand in four places. CI fails if the output is stale.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const readJson = file => JSON.parse(readFileSync(file, 'utf8'));
const { marketplace, plugins } = readJson('plugins/plugins.json');
const { license, author } = readJson('package.json');

// The repo's `author` field ("Name <email>") is the owner of the plugins too.
const [, ownerName, ownerEmail] = author.match(/^(.*?)\s*<(.+)>$/) ?? [];
if (!ownerName || !ownerEmail) {
  throw new Error(`Expected package.json "author" in the form "Name <email>", got: ${author}`);
}
const owner = { name: ownerName, email: ownerEmail };

// Deliberately dependency-free (no prettier): the CI job that runs this has no node_modules installed.
const writeJson = (file, data) => {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
};

const sourceOf = plugin => `./plugins/${plugin.name}`;

writeJson('.claude-plugin/marketplace.json', {
  name: marketplace.name,
  owner,
  metadata: { description: marketplace.description },
  plugins: plugins.map(plugin => ({
    name: plugin.name,
    source: sourceOf(plugin),
    description: plugin.description,
    version: plugin.version,
  })),
});

writeJson('.agents/plugins/marketplace.json', {
  name: marketplace.name,
  interface: { displayName: marketplace.displayName },
  plugins: plugins.map(plugin => ({
    name: plugin.name,
    source: { source: 'local', path: sourceOf(plugin) },
    policy: { installation: 'AVAILABLE', authentication: 'ON_INSTALL' },
    category: marketplace.category,
  })),
});

for (const plugin of plugins) {
  const dir = path.join('plugins', plugin.name);

  writeJson(path.join(dir, '.claude-plugin/plugin.json'), {
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    author: owner,
    license,
  });

  writeJson(path.join(dir, '.codex-plugin/plugin.json'), {
    name: plugin.name,
    version: plugin.version,
    interface: {
      shortDescription: plugin.codex.shortDescription,
      longDescription: plugin.codex.longDescription,
      displayName: plugin.codex.displayName,
      developerName: owner.name,
      category: marketplace.category,
      capabilities: plugin.codex.capabilities,
      defaultPrompt: plugin.codex.defaultPrompt,
    },
    description: `${plugin.description}.`,
    author: owner,
    license,
    keywords: plugin.keywords,
    skills: './skills/',
  });
}
