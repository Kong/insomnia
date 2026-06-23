import { Button } from 'react-aria-components';

import bgUrl from './bg.png';

interface KonnectSyncIntroProps {
  onConfigure: () => void;
}

export const KonnectSyncIntro = ({ onConfigure }: KonnectSyncIntroProps) => {
  return (
    <div className="m-2 flex flex-col overflow-hidden rounded-md bg-black text-center text-white">
      <img src={bgUrl} alt="" className="w-full object-cover" />
      <div className="flex flex-col items-center gap-5 px-4 pb-10">
        <span className="rounded-sm border border-[#b5f021] px-2 py-0.5 text-xs font-semibold text-[#b5f021]">NEW</span>
        <div className="flex flex-col gap-1">
          <h3 className="text-base leading-snug font-bold">Auto-sync your gateway service routes</h3>
          <p className="text-sm text-[#aaa]">
            Get right into testing your gateway configuration in Insomnia with the new Konnect platform integration.
          </p>
        </div>
        <Button
          onPress={onConfigure}
          className="flex h-full items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) px-4 py-2 text-sm text-(--color-font) transition-colors hover:bg-(--hl-xs) aria-pressed:bg-(--hl-xs)"
        >
          Configure
        </Button>
      </div>
    </div>
  );
};
