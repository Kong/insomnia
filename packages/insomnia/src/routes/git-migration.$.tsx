import { useState } from 'react';
import { Link } from 'react-router';

import { Button } from '~/basic-components/button';
import { CopyButton } from '~/ui/components/base/copy-button';
import { InsomniaLogo } from '~/ui/components/insomnia-icon';
import { TrailLinesContainer } from '~/ui/components/trail-lines-container';
import git_migration from '~/ui/images/git-migration/git.png';

type MigrationStatus = 'default' | 'running' | 'completed' | 'partiallyCompleted' | 'error';

const MigrationView = () => {
  const [status, setStatus] = useState<MigrationStatus>('default');
  const [migrationLogs, setMigrationLogs] = useState<string[]>([]);
  const [failedProjects, setFailedProjects] = useState<{ id: string; name: string }[]>([]);

  const handleMigration = () => {
    setStatus('running');
    window.main.git
      .runAllGitRepoMigrations()
      .then((result: { logs: string[]; failedProjects: { id: string; name: string }[] }) => {
        setMigrationLogs(result.logs);
        setFailedProjects(result.failedProjects);
        setStatus(result.failedProjects.length > 0 ? 'partiallyCompleted' : 'completed');
      })
      .catch((err: unknown) => {
        const errorMsg = err instanceof Error ? err.message : 'An unexpected error occurred.';
        setMigrationLogs(prev => [...prev, `[ERROR] ${errorMsg}`]);
        setStatus('error');
      });
  };

  const isUpdateRunning = status === 'running';
  const isUpdateCompletedSuccessfully = status === 'completed';
  const isUpdateErrored = status === 'error';
  const isUpdateCompletedWithErrors = status === 'partiallyCompleted';

  return (
    <div className="flex h-full min-h-[500px] w-[600px] flex-col items-center justify-center">
      <div className="relative flex w-full flex-col items-center justify-center gap-(--padding-sm) rounded-md border border-solid border-(--hl-sm) bg-(--hl-xs) p-8">
        <div className="relative flex min-h-[150px] flex-col justify-between gap-4 text-left text-(--color-font)">
          <h1 className="text-xl">
            {isUpdateCompletedSuccessfully
              ? 'Update Successful'
              : isUpdateErrored
                ? 'Something went wrong'
                : isUpdateCompletedWithErrors
                  ? 'Update successful with some warnings'
                  : 'Required file system update'}
          </h1>

          {isUpdateCompletedSuccessfully ? (
            <p className="text-sm">
              Your file system has been successfully updated. Now you can explore all of your Insomnia files on your
              local system and use git on your CLI to manage changes.
            </p>
          ) : isUpdateCompletedWithErrors ? (
            <>
              <p className="text-sm">
                The following Git Sync projects were disconnected from remote as a result of the file system update:
              </p>
              <ol className="ml-3 list-disc text-sm">
                {failedProjects.map(p => (
                  <li key={p.id}>{p.name}</li>
                ))}
              </ol>
              <p className="text-sm">
                These projects will need to be reconnected to the git remote server to continue with push, pull, and
                fetch actions.
              </p>
            </>
          ) : isUpdateErrored ? (
            <>
              <p className="text-sm">We hit an unexpected error while updating your file system. Please try again.</p>
              <p className="text-sm text-[#828282]">
                Having trouble and need to contact us, or back up to an old version? See our docs
                <Link className="underline" to="https://developer.konghq.com/insomnia/git-sync/">
                  docs.
                </Link>
              </p>
            </>
          ) : (
            <>
              <p className="text-sm">
                In order to continue with this update, we need to adjust your local file system. This is required to
                enable managing Insomnia changes using git on the CLI.
              </p>
              <p className="text-sm">
                {isUpdateRunning
                  ? 'Note: Your data is safe and the update only takes seconds.'
                  : 'Note: This update does NOT change your data and only affects how your local Insomnia files are stored.'}
              </p>
            </>
          )}

          <div className="flex h-[32px] w-full justify-end">
            {isUpdateCompletedSuccessfully ? (
              <Link
                className="h-[32px] rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-sm text-(--color-font-surprise) transition-colors hover:bg-(--color-surprise)/90 hover:no-underline"
                to="/organization"
              >
                Open Insomnia
              </Link>
            ) : isUpdateCompletedWithErrors ? (
              <div className="flex h-[32px] w-full items-center justify-between gap-3">
                <CopyButton
                  className="flex h-[32px] w-[150px] items-center gap-2 rounded-xs p-2 text-sm"
                  content={migrationLogs.length > 0 ? migrationLogs.join('\n') : 'No logs available.'}
                  title="Copy error logs to clipboard"
                >
                  <i className="fa fa-copy" />
                  Copy Error Logs
                </CopyButton>
                <Link
                  className="h-[32px] rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-sm text-(--color-font-surprise) transition-colors hover:bg-(--color-surprise)/90 hover:no-underline"
                  to="/organization"
                >
                  Open Insomnia
                </Link>
              </div>
            ) : isUpdateErrored ? (
              <div className="flex h-[32px] w-full items-center justify-between gap-3">
                <CopyButton
                  className="flex h-[32px] w-[150px] items-center gap-2 rounded-xs p-2 text-sm"
                  content={migrationLogs.length > 0 ? migrationLogs.join('\n') : 'No logs available.'}
                  title="Copy error logs to clipboard"
                >
                  <i className="fa fa-copy" />
                  Copy Error Logs
                </CopyButton>
                <Button
                  className="h-[32px] rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-sm text-(--color-font-surprise) transition-colors hover:bg-(--color-surprise)/90 hover:no-underline"
                  onClick={handleMigration}
                  isDisabled={isUpdateRunning}
                >
                  {isUpdateRunning ? 'Updating...' : 'Retry Update'}
                </Button>
              </div>
            ) : (
              <Button
                className="h-[32px] rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-sm text-(--color-font-surprise) transition-colors hover:bg-(--color-surprise)/90 hover:no-underline"
                onClick={handleMigration}
                isDisabled={isUpdateRunning}
              >
                {isUpdateRunning ? 'Updating...' : 'Update Now'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const Component = () => {
  const [showMigrationView, setShowMigrationView] = useState(false);

  return (
    <div className="relative flex h-full w-full bg-(--color-bg) text-left">
      <TrailLinesContainer>
        {showMigrationView ? (
          <MigrationView />
        ) : (
          <div className="flex h-full min-h-[500px] w-[600px] flex-col items-center justify-center">
            <div className="relative flex w-full flex-col items-center justify-center gap-(--padding-sm) rounded-md border border-solid border-(--hl-sm) bg-(--hl-xs) p-(--padding-lg) pt-12">
              <InsomniaLogo className="absolute top-0 left-1/2 h-16 w-16 translate-x-[-50%] translate-y-[-50%] transform" />
              <div className="flex flex-col items-center gap-6 text-(--color-font)">
                <h1 className="text-center text-xl">What's new in v12.6.0</h1>
                <div className="relative flex h-96 flex-col gap-4 bg-(--color-bg) p-4 text-left">
                  <h1 className="flex justify-between text-lg">
                    <span>Manage Insomnia changes using git CLI actions</span>
                  </h1>
                  <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto">
                    <p className="text-sm text-[#828282]">
                      Now you can use traditional git actions on your CLI to manage changes to your Git Sync projects.
                    </p>
                    <div className="h-48 flex-1">
                      <img className="aspect-auto max-h-48" src={git_migration} />
                    </div>
                  </div>
                </div>
                <div className="flex w-full justify-end">
                  <Button
                    className="h-[32px] rounded-xs border border-solid border-(--hl-md) bg-(--color-surprise) px-3 py-2 text-sm text-(--color-font-surprise) transition-colors hover:bg-(--color-surprise)/90"
                    onClick={() => {
                      setShowMigrationView(true);
                    }}
                  >
                    Continue
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </TrailLinesContainer>
    </div>
  );
};

export default Component;
