import React, { type FC, useState } from 'react';
import { Button, Link } from 'react-aria-components';
import * as reactUse from 'react-use';

import { AnalyticsEvent } from '../../analytics';
import { CopyButton } from '../base/copy-button';
import { Icon } from '../icon';

const AI_PLUGINS_REPO = 'Kong/insomnia';
const AI_PLUGINS_URL = `https://github.com/${AI_PLUGINS_REPO}/tree/develop/plugins`;
const MARKETPLACE_NAME = 'insomnia-ai-plugins';
const PLUGIN_NAME = 'insomnia-scripts';

const AGENTS = {
  claude: {
    label: 'Claude Code',
    command: `claude plugin marketplace add ${AI_PLUGINS_REPO} && claude plugin install ${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
  },
  codex: {
    label: 'Codex',
    command: `codex plugin marketplace add ${AI_PLUGINS_REPO} && codex plugin add ${PLUGIN_NAME}@${MARKETPLACE_NAME}`,
  },
} as const;

type Agent = keyof typeof AGENTS;

// Where the tip is shown. Sent as the shared `source` property so more skill prompts can be added and grouped later.
type TipSource = 'Request Scripts' | 'Folder Scripts';

/**
 * Tip shown above the script editors of a git project, pointing users at the AI plugins that
 * teach a coding agent how to edit the project's script files.
 */
export const ScriptsAIPluginTip: FC<{ source: TipSource }> = ({ source }) => {
  const [dismissed, setDismissed] = reactUse.useLocalStorage('dismissScriptsAIPluginTip', '');
  const [agent, setAgent] = useState<Agent>('claude');

  if (dismissed) {
    return null;
  }

  return (
    <div
      className="flex shrink-0 flex-col gap-2 border-b border-solid border-b-(--hl-md) bg-(--hl-xs) px-3 py-2 text-sm text-(--color-font)"
      data-testid="scripts-ai-plugin-tip"
    >
      <div className="flex items-center gap-2">
        <Icon icon="lightbulb" className="text-(--color-surprise)" />
        <span>
          Tip: write scripts for this git project with an AI coding agent. Install the plugin from{' '}
          <Link
            className="cursor-pointer underline"
            onPress={() => window.main.openInBrowser(AI_PLUGINS_URL)}
            aria-label="Open Insomnia AI Plugins"
          >
            Insomnia AI Plugins
          </Link>
          :
        </span>
        <Button
          className="ml-auto flex aspect-square h-6 shrink-0 items-center justify-center rounded-xs text-(--color-font) hover:bg-(--hl-xs) aria-pressed:bg-(--hl-sm)"
          aria-label="Dismiss tip"
          onPress={() => setDismissed('true')}
        >
          <Icon icon="close" />
        </Button>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex shrink-0 overflow-hidden rounded-xs border border-solid border-(--hl-md)" role="group">
          {(Object.keys(AGENTS) as Agent[]).map(key => (
            <Button
              key={key}
              className="px-2 py-1 text-xs font-semibold transition-colors aria-pressed:bg-(--color-surprise) aria-pressed:text-(--color-font-surprise)"
              aria-pressed={agent === key}
              onPress={() => setAgent(key)}
            >
              {AGENTS[key].label}
            </Button>
          ))}
        </div>
        <code
          className="min-w-0 flex-1 rounded-xs border border-solid border-(--hl-md) bg-(--color-bg) px-2 py-1 font-mono text-xs break-all select-text"
          data-testid="scripts-ai-plugin-command"
        >
          {AGENTS[agent].command}
        </code>
        <CopyButton
          size="small"
          content={AGENTS[agent].command}
          title="Copy install command"
          onClick={() => {
            window.main.trackAnalyticsEvent({
              event: AnalyticsEvent.skillCopyPromptClicked,
              properties: { source, model: agent },
            });
          }}
        >
          Copy
        </CopyButton>
      </div>
    </div>
  );
};
