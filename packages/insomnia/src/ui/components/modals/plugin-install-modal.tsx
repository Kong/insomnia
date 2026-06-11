import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import type { SerializablePlugin } from '~/plugins/bridge-types';
import { plugins as pluginsBridge } from '~/plugins/renderer-bridge';
import { safeImageSrc } from '~/utils/safe-image-src';

import { Link } from '../base/link';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';
import { MarkdownPreview } from '../markdown-preview';
import { Tooltip } from '../tooltip';
import { showError, showModal } from '.';
import { SettingsModal } from './settings-modal';

// Derive the preview shape from the IPC bridge so we never import main-process code into the renderer.
type PluginPreview = Awaited<ReturnType<typeof window.main.getPluginPreview>>;

// Above this many dependencies the list is collapsed behind a toggle to keep the panel compact.
const DEPENDENCY_COLLAPSE_THRESHOLD = 5;

const formatDate = (iso?: string): string | undefined => {
  if (!iso) {
    return undefined;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export interface PluginInstallModalOptions {
  // The package the user wants to install. Must already be validated by the caller.
  name: string;
  // When true, reopen Settings → Plugins after this modal closes (used when launched from Settings
  // so we can close Settings first to avoid stacking two dimmed overlays).
  returnToSettings?: boolean;
}

export interface PluginInstallModalHandle {
  show: (options: PluginInstallModalOptions) => void;
  hide: () => void;
}

interface State {
  name: string;
  isLoading: boolean;
  isInstalling: boolean;
  preview: PluginPreview | null;
  error: string;
  returnToSettings: boolean;
  depsExpanded: boolean;
  // Publisher icons are arbitrary author-provided URLs; track load failures so we can fall back.
  iconError: boolean;
  // Installed version of this package, or null when it isn't installed.
  installedVersion: string | null;
}

const VerificationRow: React.FC<{ label: string; help?: string; children: React.ReactNode }> = ({ label, help, children }) => (
  <div className="flex gap-3 border-b border-solid border-(--hl-sm) py-1.5 text-xs last:border-b-0">
    <div className="flex w-28 shrink-0 items-center gap-1 font-semibold whitespace-nowrap text-(--hl)">
      {label}
      {help && <HelpTooltip info>{help}</HelpTooltip>}
    </div>
    {/* Values come from untrusted npm metadata and are rendered as auto-escaped text nodes. */}
    <div className="min-w-0 flex-1 break-all font-mono text-(--color-font)">{children}</div>
  </div>
);

export const PluginInstallModal = forwardRef<PluginInstallModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const requestIdRef = useRef(0);
  const installedRef = useRef(false);
  const [state, setState] = useState<State>({
    name: '',
    isLoading: false,
    isInstalling: false,
    preview: null,
    error: '',
    returnToSettings: false,
    depsExpanded: false,
    iconError: false,
    installedVersion: null,
  });

  useImperativeHandle(
    ref,
    () => ({
      hide: () => modalRef.current?.hide(),
      show: ({ name, returnToSettings = false }) => {
        const requestId = ++requestIdRef.current;
        setState({
          name,
          isLoading: true,
          isInstalling: false,
          preview: null,
          error: '',
          returnToSettings,
          depsExpanded: false,
          iconError: false,
          installedVersion: null,
        });
        modalRef.current?.show();

        // No-install metadata fetch. Verifies the package and surfaces what would be installed.
        window.main
          .getPluginPreview(name, true)
          .then(async preview => {
            // Ignore responses from a superseded request (modal reopened for another plugin).
            if (requestIdRef.current !== requestId) {
              return;
            }
            // Reload from disk so the installed check reflects the real filesystem state (not the
            // startup-time in-memory cache, which won't know about manually deleted plugin folders).
            await pluginsBridge.reloadPlugins().catch(() => {});
            const installed = await pluginsBridge.getPlugins().catch((): SerializablePlugin[] => []);
            if (requestIdRef.current !== requestId) {
              return;
            }
            const installedVersion = installed.find(p => p.name === preview.name)?.version ?? null;
            setState(prev => ({ ...prev, isLoading: false, preview, installedVersion }));
          })
          .catch(err => {
            if (requestIdRef.current === requestId) {
              setState(prev => ({ ...prev, isLoading: false, error: err instanceof Error ? err.message : String(err) }));
            }
          });
      },
    }),
    [],
  );

  const { name, isLoading, isInstalling, preview, error, returnToSettings, depsExpanded, iconError, installedVersion } =
    state;

  // Reopen Settings → Plugins after a successful install (so the user sees the new plugin) or when
  // this modal was launched from Settings (so Cancel returns there). Settings is closed before this
  // modal opens, so only one dimmed overlay is shown at a time.
  const handleHidden = () => {
    const shouldReopenSettings = installedRef.current || returnToSettings;
    installedRef.current = false;
    if (shouldReopenSettings) {
      showModal(SettingsModal, { tab: 'plugins' });
    }
  };

  const handleInstall = async () => {
    if (!preview) {
      return;
    }
    setState(prev => ({ ...prev, isInstalling: true }));
    try {
      // installPlugin re-fetches and re-verifies server-side, so what's shown is what's installed.
      await window.main.installPlugin(preview.name, true);
      installedRef.current = true;
      modalRef.current?.hide();
    } catch (err) {
      showError({
        title: 'Plugin Install',
        message: 'Failed to install plugin',
        error: err instanceof Error ? err : new Error(String(err)),
      });
    } finally {
      setState(prev => ({ ...prev, isInstalling: false }));
    }
  };

  // Use the author's Gravatar profile image; if there's none (or it fails to load) we fall back to
  // the plug icon below.
  const iconSrc = safeImageSrc(preview?.avatarUrl);
  const dependencyEntries = Object.entries(preview?.dependencies || {});

  // Install button reflects whether the package is already installed (and at which version).
  const isUpToDate = !!preview && installedVersion === preview.version;
  const isUpgrade = !!installedVersion && !isUpToDate;
  const installDisabled = isLoading || isInstalling || !preview || !preview.tarballHostAllowed || isUpToDate;
  const installLabel = isUpgrade ? `Update to v${preview?.version}` : 'Install';
  const installIconName = isInstalling ? 'spinner' : 'download';

  return (
    <Modal ref={modalRef} wide onHide={handleHidden}>
      <ModalHeader>Install Plugin</ModalHeader>
      {/* Right padding keeps content clear of the floating (overlay) scrollbar on macOS, where
          scrollbar-gutter has no effect. */}
      <ModalBody className="max-h-[70vh] overflow-y-auto pr-3">
        {isLoading && (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-(--hl)">
            <Icon icon="spinner" className="animate-spin" />
            {/* Plain text, auto-escaped */}
            <span className="font-mono text-sm">{name}</span>
          </div>
        )}

        {!isLoading && (error || !preview) && (
          <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 p-6 text-center">
            <Icon icon="triangle-exclamation" className="h-7 w-7 text-(--color-danger)" />
            <h2 className="text-lg font-bold text-(--color-font)">Unable to load plugin</h2>
            <p className="max-w-xl text-(--hl)">{error || 'No plugin metadata was returned.'}</p>
          </div>
        )}

        {!isLoading && preview && (
          <div className="flex flex-col gap-4">
            {/* Header / identity */}
            <div className="flex items-start gap-4">
              {/* Left column: avatar + install button, both the same width */}
              <div className="flex w-20 shrink-0 flex-col items-stretch gap-2">
                {iconSrc && !iconError ? (
                  // Square Gravatar profile photo; fall back to the plug icon if the author has no
                  // Gravatar (404) or it otherwise fails to load.
                  <img
                    src={iconSrc}
                    alt=""
                    onError={() => setState(prev => ({ ...prev, iconError: true }))}
                    className="h-20 w-20 rounded-md bg-(--hl-xs) object-cover"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-md bg-(--hl-xs)">
                    <Icon icon="plug" className="h-7 w-7 text-(--hl)" />
                  </div>
                )}
                <button
                  title={installLabel}
                  className="flex w-full items-center justify-center gap-1.5 overflow-hidden rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-2 py-1.5 text-xs font-semibold text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset disabled:opacity-50"
                  disabled={installDisabled}
                  onClick={handleInstall}
                >
                  <Icon icon={installIconName} className={`shrink-0 ${isInstalling ? 'animate-spin' : ''}`} />
                  {!isInstalling && <span className="truncate">{installLabel}</span>}
                </button>
              </div>

              {/* Right column: title, subline, stats, description */}
              <div className="min-w-0 flex-1">
                {/* displayName / name / publisher are untrusted plain text */}
                <h2 className="truncate text-xl font-bold text-(--color-font)">{preview.displayName || preview.name}</h2>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-(--color-surprise)">
                  <span className="font-mono">{preview.name}</span>
                  <span>·</span>
                  <span>v{preview.version}</span>
                  {preview.publisher?.name && (
                    <>
                      <span>·</span>
                      <span>by {preview.publisher.name}</span>
                    </>
                  )}
                  <span>·</span>
                  <Link href={preview.npmUrl} noTheme className="text-(--color-surprise) underline">
                    View on npm
                  </Link>
                </div>

                {/* npm stats (best-effort; any field may be missing) */}
                {(typeof preview.downloads === 'number' || preview.releaseDate || preview.lastUpdatedAt) && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-(--hl)">
                    {typeof preview.downloads === 'number' && (
                      <span className="inline-flex items-center gap-1">
                        <Icon icon="download" /> {preview.downloads.toLocaleString()} / month
                      </span>
                    )}
                    {formatDate(preview.releaseDate) && (
                      <span className="inline-flex items-center gap-1">
                        <Icon icon="calendar" /> Released {formatDate(preview.releaseDate)}
                      </span>
                    )}
                    {formatDate(preview.lastUpdatedAt) && (
                      <span className="inline-flex items-center gap-1">
                        <Icon icon="arrows-rotate" /> Updated {formatDate(preview.lastUpdatedAt)}
                      </span>
                    )}
                  </div>
                )}

                {preview.description && <p className="mt-2 text-sm text-(--color-font)">{preview.description}</p>}
              </div>
            </div>

            {!preview.tarballHostAllowed && (
              <div className="flex items-center gap-2 rounded-md bg-(--color-warning) px-3 py-2 text-sm text-(--color-font-warning)">
                <Icon icon="triangle-exclamation" className="h-4 w-4" />
                This plugin's package is hosted on a registry that is not on the allowlist. Installation is blocked.
              </div>
            )}

            {/* Verification */}
            <div className="rounded-md border border-solid border-(--hl-md) p-4">
              <h3 className="mb-1 text-sm font-bold tracking-wide text-(--hl) uppercase">Package verification</h3>
              <p className="mb-3 text-xs text-(--hl)">Here's exactly what will be installed. Take a look before continuing.</p>
              <VerificationRow label="Version">{preview.version}</VerificationRow>
              <VerificationRow label="Package">
                <span className="inline-flex items-start gap-1.5">
                  <Tooltip
                    message={
                      preview.tarballHostAllowed
                        ? 'This comes from your allowed package repositories.'
                        : "This package's host is not on your allowlist."
                    }
                  >
                    {preview.tarballHostAllowed ? (
                      <Icon icon="circle-check" className="mt-0.5 shrink-0 text-(--color-surprise)" />
                    ) : (
                      <Icon icon="circle-xmark" className="mt-0.5 shrink-0 text-(--color-danger)" />
                    )}
                  </Tooltip>
                  <span className="min-w-0 break-all">{preview.dist.tarball}</span>
                </span>
              </VerificationRow>
              {/* Show the strongest available hash: modern SHA-512 integrity if present, else the
                  legacy SHA-1 checksum. Both verify the same archive against tampering. */}
              <VerificationRow label="File hash">{preview.dist.integrity || preview.dist.shasum || '—'}</VerificationRow>
              <VerificationRow label={`Dependencies (${dependencyEntries.length})`}>
                {dependencyEntries.length === 0 ? (
                  'None'
                ) : (
                  (() => {
                    const isCollapsible = dependencyEntries.length > DEPENDENCY_COLLAPSE_THRESHOLD;
                    const isOpen = !isCollapsible || depsExpanded;
                    return (
                      <div>
                        {isCollapsible && (
                          <button
                            type="button"
                            aria-expanded={depsExpanded}
                            onClick={() => setState(prev => ({ ...prev, depsExpanded: !prev.depsExpanded }))}
                            className="flex items-center gap-1 font-sans text-(--color-surprise) hover:underline"
                          >
                            {depsExpanded ? 'Hide' : 'Show all'}
                            <Icon
                              icon="chevron-down"
                              className={`transition-transform duration-300 ${depsExpanded ? 'rotate-180' : ''}`}
                            />
                          </button>
                        )}
                        {/* Animate height via a 0fr -> 1fr grid row so the list opens/closes smoothly. */}
                        <div
                          className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
                        >
                          <ul className={`space-y-1 overflow-hidden ${isCollapsible ? 'pt-1' : ''}`}>
                            {dependencyEntries.map(([dep, range]) => (
                              <li key={dep}>
                                {dep}@{range}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    );
                  })()
                )}
              </VerificationRow>
            </div>

            {/* README */}
            {preview.readme && (
              <div className="rounded-md border border-solid border-(--hl-md) p-4">
                <h3 className="mb-3 text-sm font-bold tracking-wide text-(--hl) uppercase">Readme</h3>
                {/* Untrusted README content: strip embedded images (often broken relative paths,
                    and a remote-load/tracking vector) and render text/code/links only. */}
                <MarkdownPreview markdown={preview.readme} forbidImages />
              </div>
            )}
          </div>
        )}
      </ModalBody>
    </Modal>
  );
});

PluginInstallModal.displayName = 'PluginInstallModal';
