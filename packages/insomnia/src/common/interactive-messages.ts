import { showSettingsModal } from '~/ui/components/modals/settings-modal';

const PREF_SECURITY = 'Insomnia’s Preferences → Security';

interface InteractiveItem {
  text: string;
  handler?: () => void;
  Component?: any;
}

const interactives: InteractiveItem[] = [
  { text: PREF_SECURITY, handler: () => showSettingsModal({ tab: 'general' }) },
  { text: '<br/>', Component: 'br' },
];

export function buildInteractiveMessage(message: string) {
  const parts = [];
  let prev = '';
  for (let i = 0; i < message.length; i++) {
    let matched = false;
    for (const item of interactives) {
      const { text } = item;
      matched = message.startsWith(text, i);
      if (matched) {
        if (prev) {
          parts.push({ text: prev });
          prev = '';
        }
        parts.push(item);
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
