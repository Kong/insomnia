import { isWindows } from 'insomnia-data/common';

import { CLICommandModal } from './cli-preview-modal';

// Wraps a path in double quotes for pasting into a terminal. POSIX shells still expand `$`, backticks and
// backslashes inside double quotes, so escape those. Windows paths use backslashes as separators (and can't contain `"`).
export const quotePathArgument = (value: string, windows = isWindows) =>
  windows ? `"${value}"` : `"${value.replace(/(["\\$`])/g, '\\$1')}"`;

export const LintCLIModal = ({
  onClose,
  apiSpecId,
  rulesetPath,
  workingDir,
}: {
  onClose: () => void;
  apiSpecId: string;
  rulesetPath?: string;
  workingDir?: string;
}) => {
  const workingDirArgument = workingDir ? ` -w ${quotePathArgument(workingDir)}` : '';
  const rulesetArgument = rulesetPath ? ` --ruleset ${quotePathArgument(rulesetPath)}` : '';
  const cliCommand = `inso lint spec${workingDirArgument} ${apiSpecId.slice(0, 10)}${rulesetArgument}`;

  return (
    <CLICommandModal
      onClose={onClose}
      title="Lint via CLI"
      description="Copy this command to lint your spec in the terminal"
      command={cliCommand}
    />
  );
};
