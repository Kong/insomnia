import { showSettingsModal } from '~/ui/components/modals/settings-modal';

const PREF_SECURITY = 'Insomnia’s Preferences → Security';

const interactives = [{ text: PREF_SECURITY, handler: () => showSettingsModal({ tab: 'general' }) }];

export function buildInteractiveMessage(message: string) {
  const parts = [];
  let prev = '';
  for (let i = 0; i < message.length; i++) {
    let matched = false;
    for (const { text, handler } of interactives) {
      matched = message.startsWith(text, i);
      if (matched) {
        if (prev) {
          parts.push({ text: prev });
          prev = '';
        }
        parts.push({ text, handler });
        i += text.length - 1;
        break;
      }
    }
    if (!matched) {
      prev += message[i];
    }
  }
  if (prev) {
    parts.push({ text: prev });
  }
  return parts;
}
