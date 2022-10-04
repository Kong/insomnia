import path from 'path';
import { useEffect, useRef, useState } from 'react';

import * as models from '../../models';
import { GitRepository } from '../../models/git-repository';
import { fsClient } from '../../sync/git/fs-client';
import { GIT_CLONE_DIR, GIT_INSOMNIA_DIR, GIT_INTERNAL_DIR, GitVCS } from '../../sync/git/git-vcs';
import { NeDBClient } from '../../sync/git/ne-db-client';
import { routableFSClient } from '../../sync/git/routable-fs-client';
export function useGitVCS({
  workspaceId,
  projectId,
  gitRepository,
}: {
  workspaceId?: string;
  projectId: string;
  gitRepository?: GitRepository | null;
}) {
  const gitVCSInstanceRef = useRef<GitVCS | null>(null);
  const [gitVCS, setGitVCS] = useState<GitVCS | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Set the instance to null in the state while we update it
    if (gitVCSInstanceRef.current) {
      setGitVCS(null);
    }

    if (!gitVCSInstanceRef.current) {
      gitVCSInstanceRef.current = new GitVCS();
    }

    async function update() {
      if (workspaceId && gitRepository && gitVCSInstanceRef.current) {
        // Create FS client
        const baseDir = path.join(
          process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'),
          `version-control/git/${gitRepository._id}`,
        );

        /** All app data is stored within a namespaced GIT_INSOMNIA_DIR directory at the root of the repository and is read/written from the local NeDB database */
        const neDbClient = NeDBClient.createClient(workspaceId, projectId);

        /** All git metadata in the GIT_INTERNAL_DIR directory is stored in a git/ directory on the filesystem */
        const gitDataClient = fsClient(baseDir);

        /** All data outside the directories listed below will be stored in an 'other' directory. This is so we can support files that exist outside the ones the app is specifically in charge of. */
        const otherDatClient = fsClient(path.join(baseDir, 'other'));

        /** The routable FS client directs isomorphic-git to read/write from the database or from the correct directory on the file system while performing git operations. */
        const routableFS = routableFSClient(otherDatClient, {
          [GIT_INSOMNIA_DIR]: neDbClient,
          [GIT_INTERNAL_DIR]: gitDataClient,
        });
        // Init VCS
        const { credentials, uri } = gitRepository;
        if (gitRepository.needsFullClone) {
          await models.gitRepository.update(gitRepository, {
            needsFullClone: false,
          });
          await gitVCSInstanceRef.current.initFromClone({
            url: uri,
            gitCredentials: credentials,
            directory: GIT_CLONE_DIR,
            fs: routableFS,
            gitDirectory: GIT_INTERNAL_DIR,
          });
        } else {
          await gitVCSInstanceRef.current.init({
            directory: GIT_CLONE_DIR,
            fs: routableFS,
            gitDirectory: GIT_INTERNAL_DIR,
          });
        }

        // Configure basic info
        const { author, uri: gitUri } = gitRepository;
        await gitVCSInstanceRef.current.setAuthor(author.name, author.email);
        await gitVCSInstanceRef.current.addRemote(gitUri);
      } else {
        // Create new one to un-initialize it
        gitVCSInstanceRef.current = new GitVCS();
      }

      isMounted && setGitVCS(gitVCSInstanceRef.current);
    }

    update();

    return () => {
      isMounted = false;
    };
  }, [workspaceId, projectId, gitRepository]);

  return gitVCS;
}
