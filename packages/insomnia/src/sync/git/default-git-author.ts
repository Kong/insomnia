import { readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const parseGitConfigUser = (content: string) => {
  const user = { name: '', email: '' };
  let inUserSection = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.startsWith('[')) {
      inUserSection = /^\[user\]$/i.test(line);
    } else if (inUserSection) {
      const match = /^(name|email)\s*=\s*"?(.*?)"?\s*$/i.exec(line);
      if (match) {
        user[match[1].toLowerCase() as 'name' | 'email'] = match[2];
      }
    }
  }
  return user;
};

// isomorphic-git only reads the repository's own config, so a repo with no sign-in needs this
export const getDefaultGitAuthor = async () => {
  const home = os.homedir();
  for (const file of [path.join(home, '.gitconfig'), path.join(home, '.config', 'git', 'config')]) {
    const user = parseGitConfigUser(await readFile(file, 'utf8').catch(() => ''));
    if (user.name && user.email) {
      return user;
    }
  }
  const { username } = os.userInfo();
  return { name: username, email: `${username}@localhost` };
};
