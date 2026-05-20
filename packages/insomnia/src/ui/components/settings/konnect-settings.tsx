import { useState } from 'react';
import { Button } from 'react-aria-components';

import { validatePat } from '~/konnect/api';
import { useRootLoaderData } from '~/root';
import { AnalyticsEvent } from '~/ui/analytics';

import { useSettingsPatcher } from '../../hooks/use-request';

export const KonnectSettings = () => {
  const { settings } = useRootLoaderData()!;
  const patchSettings = useSettingsPatcher();

  const [pat, setPat] = useState('');
  const [status, setStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [validationError, setValidationError] = useState<string | null>(null);

  const handleValidate = async () => {
    const trimmed = pat.trim();
    if (!trimmed) {
      return;
    }
    setStatus('validating');
    setValidationError(null);
    const result = await validatePat(trimmed);
    setStatus(result.valid ? 'valid' : 'invalid');
    if (result.valid) {
      await window.main.secretStorage.setSecret('konnectPat', trimmed);
      patchSettings({ hasKonnectPat: true });
      setPat('');
      window.main.trackAnalyticsEvent({ event: AnalyticsEvent.kongKonnectPatValidated });
    } else {
      setValidationError(result.error ?? 'PAT is invalid or could not connect to Konnect.');
    }
  };

  const handleClear = async () => {
    await window.main.secretStorage.deleteSecret('konnectPat');
    patchSettings({ hasKonnectPat: false });
    setPat('');
    setStatus('idle');
  };

  return (
    <div className="p-4">
      <h2 className="sticky top-0 left-0 z-10 bg-(--color-bg) pt-2 pb-2 text-lg font-bold">Kong Konnect</h2>
      <p className="mb-4 text-sm text-(--hl)">
        Enter a Personal Access Token (PAT) to sync your Konnect control planes into Insomnia projects.
        Generate one at{' '}
        <a
          className="underline"
          href="https://cloud.konghq.com/global/account/tokens"
          onClick={e => {
            e.preventDefault();
            window.main.openInBrowser('https://cloud.konghq.com/global/account/tokens');
          }}
        >
          https://cloud.konghq.com/global/account/tokens
        </a>
        .
      </p>

      <div className="mb-4 flex flex-col gap-2">
        <label className="text-sm font-semibold" htmlFor="konnect-pat">
          Personal Access Token
        </label>
        {settings.hasKonnectPat ? (
          <div className="flex items-center gap-2">
            <span className="text-sm text-(--hl)">kpat_••••••••</span>
            <span className="text-xs text-(--color-success)">Saved</span>
          </div>
        ) : null}
        <input
          id="konnect-pat"
          type="password"
          className="rounded-xs border border-solid border-(--hl-sm) bg-(--color-bg) px-2 py-1 text-(--color-font) focus:ring-1 focus:ring-(--hl-md) focus:outline-hidden"
          placeholder={settings.hasKonnectPat ? 'Enter new PAT to replace existing' : 'kpat_...'}
          value={pat}
          onChange={e => {
            setPat(e.target.value);
            setStatus('idle');
            setValidationError(null);
          }}
          autoComplete="off"
        />
        {status === 'valid' && <p className="text-xs text-(--color-success)">PAT is valid and saved.</p>}
        {status === 'invalid' && <p className="text-xs text-(--color-danger)">{validationError}</p>}
      </div>

      <div className="flex gap-2">
        <Button
          className="rounded-xs bg-(--color-surprise) px-3 py-1 text-sm text-white hover:opacity-90 disabled:opacity-50"
          isDisabled={!pat.trim() || status === 'validating'}
          onPress={handleValidate}
        >
          {status === 'validating' ? 'Validating...' : 'Validate & Save'}
        </Button>
        {settings.hasKonnectPat && (
          <Button
            className="rounded-xs border border-solid border-(--hl-sm) px-3 py-1 text-sm text-(--color-font) hover:bg-(--hl-xs)"
            onPress={handleClear}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  );
};
