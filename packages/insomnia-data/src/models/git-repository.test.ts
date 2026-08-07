import { models } from 'insomnia-data';
import { describe, expect, it } from 'vitest';

describe('getGitRepoFolderName', () => {
  it('returns the bare id when there is no folderSlug', () => {
    const folderName = models.gitRepository.getGitRepoFolderName({
      _id: 'git_57d071a646b34393929036c34dd0915e',
      folderSlug: null,
    });

    expect(folderName).toBe('git_57d071a646b34393929036c34dd0915e');
  });

  it('embeds the slug between the "git" prefix and the hex id when set', () => {
    const folderName = models.gitRepository.getGitRepoFolderName({
      _id: 'git_57d071a646b34393929036c34dd0915e',
      folderSlug: 'cams-project',
    });

    expect(folderName).toBe('git_cams-project_57d071a646b34393929036c34dd0915e');
  });

  it('falls back to the whole id if it somehow lacks the "git_" prefix', () => {
    const folderName = models.gitRepository.getGitRepoFolderName({
      _id: '57d071a646b34393929036c34dd0915e',
      folderSlug: 'cams-project',
    });

    expect(folderName).toBe('git_cams-project_57d071a646b34393929036c34dd0915e');
  });
});
