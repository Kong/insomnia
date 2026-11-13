import { app, dialog, shell } from 'electron';

const QUIT = 0;
const SHOW_DATA_FOLDER = 1;

interface StartupErrorDeps {
  showMessageBox: (options: Electron.MessageBoxOptions) => Promise<{ response: number }>;
  openPath: (path: string) => Promise<string>;
  exit: (exitCode: number) => void;
}

/**
 * Tells the user that the local database could not be loaded and ends the app. It is for a failed start, when there is no
 * window yet: without it the process would stay alive with nothing on screen. The data files that failed to load are left
 * as they are, so nothing is lost, and the dialog says which datastores failed. Resolves after the app was told to exit.
 */
export const reportDatabaseStartupFailure = async (
  error: unknown,
  dataPath: string,
  {
    showMessageBox = options => dialog.showMessageBox(options),
    openPath = path => shell.openPath(path),
    exit = exitCode => app.exit(exitCode),
  }: Partial<StartupErrorDeps> = {},
) => {
  console.error('[main] The local database could not be loaded:', error);
  const reason = error instanceof Error ? error.message : String(error);
  try {
    let response: number;
    // Set when "Show Data Folder" did not work, so that the next dialog says so instead of looking like nothing happened
    let openFailure = '';
    do {
      ({ response } = await showMessageBox({
        type: 'error',
        title: 'Insomnia cannot start',
        message: 'Insomnia could not load its local database.',
        detail:
          `${reason}\n\n` +
          'The data files that could not be loaded were not changed, so your data is still there. ' +
          'Restoring them from a backup, or moving them aside, usually solves this.\n\n' +
          `Data folder: ${dataPath}` +
          (openFailure ? `\n\nThe folder could not be opened: ${openFailure}` : ''),
        buttons: ['Quit', 'Show Data Folder'],
        defaultId: QUIT,
        cancelId: QUIT,
        noLink: true,
      }));
      if (response === SHOW_DATA_FOLDER) {
        // Resolves an error message when it fails, instead of rejecting
        openFailure = await openPath(dataPath);
        if (openFailure) {
          console.error('[main] Could not open the data folder:', openFailure);
        }
      }
    } while (response === SHOW_DATA_FOLDER);
  } finally {
    // Whatever happened to the dialog, do not leave a process without a window behind
    exit(1);
  }
};
