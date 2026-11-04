import { describe, expect, it } from 'vitest';

import { parseGitConfigUser } from '../default-git-author';

describe('parseGitConfigUser', () => {
  it('reads name and email from the user section only', () => {
    const config = '[core]\n\tname = wrong\n[user]\n\tname = "Ada Lovelace"\n\temail = ada@example.com\n[alias]\n\tst = status\n';

    expect(parseGitConfigUser(config)).toEqual({ name: 'Ada Lovelace', email: 'ada@example.com' });
  });

  it('returns blanks when there is no user section', () => {
    expect(parseGitConfigUser('[core]\n\tbare = false\n')).toEqual({ name: '', email: '' });
  });
});
