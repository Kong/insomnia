import React, { type FC, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Checkbox,
  FieldError,
  FileTrigger,
  GridList,
  GridListItem,
  Input,
  Label,
  Separator,
  TextField,
} from 'react-aria-components';

import type { SerializablePlugin } from '~/common/plugins/bridge-types';
import { resolvePluginExecutionMode } from '~/common/plugins/sandbox-mode';
import { validatePluginName } from '~/common/utils/plugin-name';
import { useRootLoaderData } from '~/root';
import { plugins as pluginsBridge } from '~/ui/plugins/renderer-bridge';
import { reload } from '~/ui/templating/renderer-safe';

import { ACCEPTED_NODE_CA_FILE_EXTS, PLUGIN_HUB_BASE } from '../../../common/constants';
import { docsPlugins } from '../../../common/documentation';
import { useSettingsPatcher } from '../../hooks/use-request';
import { CopyButton } from '../base/copy-button';
import { Link } from '../base/link';
import { Icon } from '../icon';
import { Tooltip } from '../tooltip';
import { CreatePluginModal } from './create-plugin-modal';

// Baseline grant for every template-tag plugin regardless of its manifest; kept as a local literal
// in sync with module-registry.ts's TEMPLATE_TAG_BASELINE_MODULES and host-bridge.ts's
// TEMPLATE_TAG_BASELINE_CAPABILITIES to avoid pulling the sandbox module graph into this bundle.
const TEMPLATE_TAG_BASELINE_MODULES = ['path', 'crypto'];
const TEMPLATE_TAG_BASELINE_CAPABILITIES = ['render', 'models.read', 'util', 'crypto'];

const getNpmRegistryUrlValidationError = (url: string): string | null => {
  if (!url) {
    return null;
  }

  try {
    const parsedUrl = new URL(url);

    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return 'Enter a valid HTTP or HTTPS URL.';
    }

    return null;
  } catch {
    return 'Enter a valid HTTP or HTTPS URL.';
  }
};

interface PluginRow extends SerializablePlugin {
  isDetailsExpanded: boolean;
}

interface State {
  plugins: SerializablePlugin[];
  npmPluginValue: string;
  error: Error | null;
  installPluginErrMsg: string;
  isInstallingFromNpm: boolean;
  isRefreshingPlugins: boolean;
  pluginNodeExtraCerts: string;
  npmRegistryUrl: string;
  npmRegistryUrlError: string | null;
}

export const Plugins: FC = () => {
  const { settings } = useRootLoaderData()!;
  const [showCreatePluginModal, setShowCreatePluginModal] = useState(false);
  const [expandedPluginDetails, setExpandedPluginDetails] = useState<Set<string>>(new Set());

  const [
    {
      plugins,
      error,
      installPluginErrMsg,
      isInstallingFromNpm,
      isRefreshingPlugins,
      npmPluginValue,
      pluginNodeExtraCerts,
      npmRegistryUrl,
      npmRegistryUrlError,
    },
    setState,
  ] = useState<State>({
    plugins: [],
    npmPluginValue: '',
    error: null,
    installPluginErrMsg: '',
    isInstallingFromNpm: false,
    isRefreshingPlugins: false,
    pluginNodeExtraCerts: settings.pluginNodeExtraCerts,
    npmRegistryUrl: settings.npmRegistryUrl,
    npmRegistryUrlError: null,
  });

  // If all plugins are enabled, we show the checked state
  const isAllPluginsSelected = plugins.every(plugin => plugin.config.disabled === false);

  // If some plugins are enabled, we show the indeterminate state
  const isIndeterminate = plugins.some(plugin => plugin.config.disabled === false);

  // GridList caches each row's render by item identity, so give each plugin a fresh object on
  // expansion changes to force a re-render.
  const pluginRows: PluginRow[] = useMemo(
    () => plugins.map(plugin => ({ ...plugin, isDetailsExpanded: expandedPluginDetails.has(plugin.directory) })),
    [plugins, expandedPluginDetails],
  );

  useEffect(() => {
    setState(state => ({ ...state, pluginNodeExtraCerts: settings.pluginNodeExtraCerts }));
  }, [settings.pluginNodeExtraCerts]);

  useEffect(() => {
    setState(state => ({ ...state, npmRegistryUrl: settings.npmRegistryUrl, npmRegistryUrlError: null }));
  }, [settings.npmRegistryUrl]);

  useEffect(() => {
    handleReloadPlugins();
  }, [settings.pluginConfig]);

  async function handleReloadPlugins() {
    setState(state => ({ ...state, isRefreshingPlugins: true }));
    await pluginsBridge.reloadPlugins();
    const allPlugins = (await pluginsBridge.getPlugins()) as SerializablePlugin[];
    const plugins = allPlugins.filter(
      // Filter out pre-bundled plugins
      p => p.directory,
    );

    reload();

    setState(state => ({ ...state, plugins, isRefreshingPlugins: false }));
  }

  const patchSettings = useSettingsPatcher();

  return (
    <div>
      <p className="notice info no-margin-top">
        Plugins are built and maintained by third-party developers. Thank you! Insomnia does not review, endorse, or
        support any particular plugin unless explicitly noted. Plugins are still an experimental feature. See{' '}
        <Link href={docsPlugins}>Documentation</Link> for more info.
      </p>

      <div className="flex flex-col gap-6">
        {(error || installPluginErrMsg) && (
          <div className="notice error margin-bottom text-left">
            <Button
              className="pull-right icon"
              onPress={() => setState(state => ({ ...state, error: null, installPluginErrMsg: '' }))}
            >
              <i className="fa fa-times" />
            </Button>
            <div className="selectable force-pre-wrap">
              <b>{installPluginErrMsg}</b>
              <br />
              Try using the install button on <a href={PLUGIN_HUB_BASE}>Plugin Hub.</a>
              {error && (error.stack || error.message) && (
                <details>
                  <summary>Additional Information</summary>
                  <pre className="pad-top-sm force-wrap selectable">
                    <code>{error.stack || error.message}</code>
                  </pre>
                </details>
              )}
            </div>
          </div>
        )}
        <div className="flex w-full flex-col">
          <Label className="text-lg font-bold" slot="label">
            Install Plugin
          </Label>

          <div className="mt-2 flex flex-col gap-2">
            <div className="flex gap-2">
              <div className="flex w-full gap-2">
                <TextField
                  aria-label='"Plugin Name"'
                  isRequired
                  className="group relative flex max-w-full shrink-0 grow flex-col gap-2 overflow-hidden"
                  isDisabled={isInstallingFromNpm}
                  type="text"
                  value={npmPluginValue}
                  onChange={value => {
                    setState(state => ({ ...state, npmPluginValue: value }));
                  }}
                >
                  <Input
                    placeholder="e.g. insomnia-plugin-example"
                    autoFocus
                    className="flex h-(--line-height-xs) w-full items-center rounded-md border border-solid border-(--hl-md) bg-(--hl-xxs) p-(--padding-sm) text-(--color-font) focus:border-(--hl-lg) focus:bg-transparent"
                  />
                </TextField>
                <Button
                  className="flex h-full min-w-[13ch] shrink-0 items-center justify-center gap-2 rounded-md border border-solid border-(--hl-md) bg-(--color-surprise) px-4 py-2 text-center text-sm font-semibold whitespace-nowrap text-(--color-font-surprise) ring-1 ring-transparent transition-all hover:bg-(--color-surprise)/80 focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--color-surprise)/80"
                  isDisabled={isInstallingFromNpm}
                  type="submit"
                  onPress={async () => {
                    setState(state => ({ ...state, isInstallingFromNpm: true }));

                    const idleState: Partial<State> = {
                      isInstallingFromNpm: false,
                      error: null,
                      installPluginErrMsg: '',
                    };

                    const validationError = validatePluginName(npmPluginValue.trim());

                    if (validationError) {
                      setState(state => ({
                        ...state,
                        isInstallingFromNpm: false,
                        error: null,
                        installPluginErrMsg: `Failed to install ${npmPluginValue}. ${validationError}`,
                      }));

                      return;
                    }

                    try {
                      await window.main.installPlugin(npmPluginValue.trim());
                      await handleReloadPlugins();
                      setState(state => ({ ...state, ...idleState, npmPluginValue: '' }));
                    } catch (err) {
                      console.error(err);
                      setState(state => ({
                        ...state,
                        ...idleState,
                        error: err,
                        installPluginErrMsg: `Failed to install ${npmPluginValue}. Please contact the plugin author sharing the below stack trace to help them to ensure compatibility with the latest Insomnia.`,
                      }));
                    }
                  }}
                >
                  {isInstallingFromNpm ? 'Installing...' : 'Install Plugin'}
                </Button>
              </div>
            </div>
            <Label slot="description" className="p-0 text-sm text-(--hl)">
              Plugin name must start with insomnia-plugin-
            </Label>
          </div>
        </div>
        <div className="flex w-full flex-col">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Label className="text-lg font-bold" slot="label">
                Certification
              </Label>

              <Tooltip
                className="cursor-pointer pt-2"
                message={
                  <span>
                    You can bundle multiple root certificates into a single file.{' '}
                    <a
                      className="underline"
                      href="https://github.com/Kong/insomnia/wiki/Combining-Multiple-Root-CAs-into-a-single-file"
                    >
                      See instructions <i className="fa fa-external-link" />
                    </a>
                  </span>
                }
              >
                <i className="fa fa-info-circle" />
              </Tooltip>
            </div>
            <Label className="p-0 text-sm font-semibold" slot="description">
              <span className="text-(--hl)">Plugin installation trusted certificates file</span>
            </Label>
          </div>

          {pluginNodeExtraCerts === '' && (
            <div className="mt-2 flex flex-col gap-2">
              <div className="flex w-full items-center justify-center">
                <label
                  htmlFor="dropzone-file"
                  className="flex h-20 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-(--hl-md) bg-(--hl-xxs) hover:bg-transparent focus:border-(--hl-lg)"
                >
                  <FileTrigger
                    allowsMultiple={false}
                    acceptedFileTypes={ACCEPTED_NODE_CA_FILE_EXTS}
                    onSelect={fileList => {
                      if (!fileList) {
                        return;
                      }
                      const files = Array.from(fileList);
                      if (files.length === 0) {
                        return;
                      }
                      patchSettings({ pluginNodeExtraCerts: window.webUtils.getPathForFile(files[0]) });
                    }}
                  >
                    <Button>
                      <div className="pointer-events-none flex flex-col items-center justify-center p-8 text-(--hl-xl)">
                        <Icon icon="upload" className="mb-2 h-5 w-5" />
                        <p className="text pointer-events-none mb-2 text-sm">
                          <span className="font-bold">Click to upload</span> or drag and drop
                        </p>
                      </div>
                    </Button>
                  </FileTrigger>
                </label>
              </div>
              <Label slot="description" className="p-0 text-sm text-(--hl)">
                Supported Formats: ({ACCEPTED_NODE_CA_FILE_EXTS.join(', ')})
              </Label>
            </div>
          )}

          {pluginNodeExtraCerts !== '' && (
            <div className="mt-4 flex flex-col justify-between gap-2">
              <div className="flex h-20 w-full gap-2">
                <TextField
                  name="name"
                  isRequired
                  className="group relative flex max-w-full shrink-0 grow flex-col gap-2 overflow-hidden"
                >
                  <Input
                    value={pluginNodeExtraCerts}
                    className="flex h-(--line-height-xs) w-full items-center rounded-md border border-solid border-(--hl-md) bg-(--hl-xxs) p-(--padding-sm) text-(--color-font) focus:border-(--hl-lg) focus:bg-transparent"
                  />
                </TextField>
                <Button
                  className="flex h-(--line-height-xs) items-center justify-center rounded-md border border-solid border-(--hl-lg) px-(--padding-md) text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={() => {
                    patchSettings({ pluginNodeExtraCerts: '' });
                  }}
                >
                  Clear
                </Button>
              </div>
            </div>
          )}
        </div>
        <div className="flex w-full flex-col">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <Label className="text-lg font-bold" slot="label">
                npm Registry
              </Label>

              <Tooltip
                className="cursor-pointer pt-2"
                message="Set a custom npm registry URL (mirror) for plugin installation. Useful in corporate environments where direct npm access is restricted."
              >
                <i className="fa fa-info-circle" />
              </Tooltip>
            </div>
            <Label className="p-0 text-sm font-semibold" slot="description">
              <span className="text-(--hl)">Custom npm registry URL for plugin installation</span>
            </Label>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            <div className="flex w-full gap-2">
              <TextField
                aria-label="npm Registry URL"
                className="group relative flex max-w-full shrink-0 grow flex-col gap-2 overflow-hidden"
                isInvalid={!!npmRegistryUrlError}
                value={npmRegistryUrl}
                onChange={value => {
                  setState(state => ({ ...state, npmRegistryUrl: value, npmRegistryUrlError: null }));
                }}
              >
                <Input
                  placeholder="https://registry.npmjs.org/"
                  className={({ isInvalid }) =>
                    `flex h-(--line-height-xs) w-full items-center rounded-md border border-solid bg-(--hl-xxs) p-(--padding-sm) text-(--color-font) focus:border-(--hl-lg) focus:bg-transparent ${isInvalid ? 'border-(--color-danger)' : 'border-(--hl-md)'}`
                  }
                  onBlur={() => {
                    const trimmedRegistryUrl = npmRegistryUrl.trim();
                    const validationError = getNpmRegistryUrlValidationError(trimmedRegistryUrl);

                    if (validationError) {
                      setState(state => ({ ...state, npmRegistryUrlError: validationError }));
                      return;
                    }

                    setState(state => ({
                      ...state,
                      npmRegistryUrl: trimmedRegistryUrl,
                      npmRegistryUrlError: null,
                    }));
                    patchSettings({ npmRegistryUrl: trimmedRegistryUrl });
                  }}
                />
                <FieldError className="text-xs text-(--color-danger)">{npmRegistryUrlError}</FieldError>
              </TextField>
              {npmRegistryUrl && (
                <Button
                  className="flex h-(--line-height-xs) items-center justify-center rounded-md border border-solid border-(--hl-lg) px-(--padding-md) text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={() => {
                    setState(state => ({ ...state, npmRegistryUrl: '', npmRegistryUrlError: null }));
                    patchSettings({ npmRegistryUrl: '' });
                  }}
                >
                  Clear
                </Button>
              )}
            </div>
            <Label slot="description" className="p-0 text-sm text-(--hl)">
              Leave empty to use the default npm registry (https://registry.npmjs.org/)
            </Label>
          </div>
        </div>
        <Separator className="my-4" />
        <div className="flex w-full flex-col">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-lg font-bold" slot="label">
              Plugins ({plugins.length})
            </Label>

            {plugins.length > 0 && (
              <div className="flex flex-1 items-center justify-end gap-2">
                <Button
                  className="flex h-(--line-height-xs) items-center justify-center gap-2 rounded-md border border-solid border-(--hl-lg) px-(--padding-md) py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  isDisabled={isRefreshingPlugins}
                  onPress={() => {
                    handleReloadPlugins();
                  }}
                >
                  Reload
                </Button>

                <Button
                  className="flex h-(--line-height-xs) items-center justify-center gap-2 rounded-md border border-solid border-(--hl-lg) px-(--padding-md) py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                  onPress={() => setShowCreatePluginModal(true)}
                  isDisabled={isRefreshingPlugins}
                >
                  New Plugin
                </Button>
              </div>
            )}
          </div>
          <div className="mt-4 flex flex-col">
            {plugins.length > 0 && (
              <div className="flex flex-col">
                <div className="flex items-center gap-2 pl-2">
                  <div className="flex flex-1 items-center gap-3">
                    <Checkbox
                      isSelected={isAllPluginsSelected}
                      isIndeterminate={isIndeterminate}
                      onChange={isSelected => {
                        const config = plugins.reduce(
                          (acc, plugin) => {
                            acc[plugin.name] = { ...plugin.config, disabled: !isSelected };
                            return acc;
                          },
                          {} as Record<string, SerializablePlugin['config']>,
                        );

                        patchSettings({ pluginConfig: { ...settings.pluginConfig, ...config } });
                      }}
                      className="group flex h-full items-center p-0"
                    >
                      <div className="flex h-4 w-4 items-center justify-center rounded-sm ring-1 ring-(--hl-sm) transition-colors group-focus:ring-2 group-data-selected:bg-(--hl-xs)">
                        <Icon
                          icon={!isAllPluginsSelected ? 'minus' : 'check'}
                          className="h-3 w-3 opacity-0 group-data-indeterminate:text-(--color-success) group-data-indeterminate:opacity-100 group-data-selected:text-(--color-success) group-data-selected:opacity-100"
                        />
                      </div>
                    </Checkbox>
                    <span className="text-xs font-bold text-(--hl-xl) uppercase">Name</span>
                  </div>
                  <div className="flex items-center gap-6">
                    <span className="w-[10ch] text-center text-xs font-bold text-(--hl-xl) uppercase">Version</span>
                    <span className="w-[10ch] text-center text-xs font-bold text-(--hl-xl) uppercase">Folder</span>
                  </div>
                </div>
                <Separator className="mt-2" />
              </div>
            )}
            <GridList
              aria-label="Installed Plugins"
              selectionMode="multiple"
              items={pluginRows}
              className="flex flex-col divide-y divide-(--hl-sm)"
              renderEmptyState={() => (
                <div className="flex h-36 flex-col items-center">
                  <h3 className="mt-2 font-semibold text-(--hl-xl)">No plugins</h3>
                  <p className="mt-1 text-sm text-(--hl-xl)">Get started by creating a new project.</p>
                  <Button
                    className="mt-4 flex h-(--line-height-xs) items-center justify-center gap-2 rounded-md border border-solid border-(--hl-lg) px-(--padding-md) py-1 text-sm font-semibold text-(--color-font) ring-1 ring-transparent transition-all hover:bg-(--hl-xs) focus:ring-(--hl-md) focus:ring-inset aria-pressed:bg-(--hl-sm)"
                    onPress={() => setShowCreatePluginModal(true)}
                    isDisabled={isRefreshingPlugins}
                  >
                    New Plugin
                  </Button>
                </div>
              )}
            >
              {plugin => {
                // Effective grant is always baseline ∪ declared, so list the full set rather than a vague "default access" message.
                const { modules, capabilities } = plugin.permissions ?? { modules: [], capabilities: [] };
                const effectiveModules = [...new Set([...TEMPLATE_TAG_BASELINE_MODULES, ...modules])];
                const effectiveCapabilities = [...new Set([...TEMPLATE_TAG_BASELINE_CAPABILITIES, ...capabilities])];
                const hasExtraPermissions = modules.length > 0 || capabilities.length > 0;
                const baselineOnlyNote = plugin.permissionsDeclared
                  ? 'Baseline only — declared an empty permissions block'
                  : 'Baseline only — no permissions manifest declared';

                const isDetailsExpanded = plugin.isDetailsExpanded;
                const applyToggleDetails = () => {
                  setExpandedPluginDetails(prev => {
                    const next = new Set(prev);
                    next.has(plugin.directory) ? next.delete(plugin.directory) : next.add(plugin.directory);
                    return next;
                  });
                };
                // react-aria's usePress can re-fire a synthetic, untrusted click after a real one on a slow render; ignore untrusted clicks to avoid a double toggle.
                const handleToggleClick = (e: React.MouseEvent) => {
                  if (!e.nativeEvent.isTrusted) {
                    return;
                  }
                  applyToggleDetails();
                };
                // Controls with their own click behavior (checkbox, copy, folder) opt out of the row's click-to-expand.
                const stopPropagation = (e: React.SyntheticEvent) => e.stopPropagation();

                // T1: this plugin's resolved execution mode + the per-plugin "elevated" escape hatch.
                // Only user plugins reach this list (bundle plugins are filtered out above). Read
                // `elevated` from live settings (not the load-time plugin.config snapshot) so the toggle
                // and badge update immediately, before the plugin list reloads.
                const isElevated = settings.pluginConfig?.[plugin.name]?.elevated === true;
                const executionMode = resolvePluginExecutionMode(settings, {
                  directory: plugin.directory,
                  config: { elevated: isElevated },
                });
                const modeLabel =
                  executionMode === 'sandboxed'
                    ? 'Sandboxed'
                    : executionMode === 'elevated'
                      ? 'Elevated'
                      : 'In-process';
                const modeTitle =
                  executionMode === 'sandboxed'
                    ? 'Runs in the QuickJS sandbox (default-deny host access).'
                    : executionMode === 'elevated'
                      ? 'Runs in the main process with full host access (you granted this).'
                      : 'Sandbox is off — runs in the main process with full host access.';

                return (
                  <GridListItem
                    textValue={plugin.name}
                    // `directory` is unique per folder even when two plugins collide on `name`.
                    id={plugin.directory}
                    className={`flex flex-col py-1 ${plugin.loadError ? 'opacity-50' : ''}`}
                    data-testid={plugin.name}
                  >
                    {/* Highlight lives on this inner wrapper so the item's own py-1 gap stays transparent. */}
                    <div
                      className={`flex flex-col rounded-xs transition-colors ${isDetailsExpanded ? 'bg-(--hl-xs)' : ''}`}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={isDetailsExpanded}
                        className={`flex h-(--line-height-sm) cursor-pointer items-center gap-2 rounded-xs px-2 transition-colors ${isDetailsExpanded ? '' : 'hover:bg-(--hl-xs)'}`}
                        data-testid={`plugin-details-toggle-${plugin.name}`}
                        onClick={handleToggleClick}
                        onKeyDown={e => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            applyToggleDetails();
                          }
                        }}
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          {plugin.loadError ? (
                            <Icon icon="triangle-exclamation" className="h-3 w-3 shrink-0 text-(--color-danger)" />
                          ) : (
                            <div onClick={stopPropagation} className="cursor-auto">
                              <Checkbox
                                isSelected={!plugin.config.disabled}
                                isDisabled={isRefreshingPlugins}
                                className="group flex h-full items-center p-0 disabled:animate-pulse"
                                onChange={isSelected => {
                                  patchSettings({
                                    pluginConfig: {
                                      ...settings.pluginConfig,
                                      [plugin.name]: { ...plugin.config, disabled: !isSelected },
                                    },
                                  });
                                }}
                              >
                                <div className="flex h-4 w-4 items-center justify-center rounded-sm ring-1 ring-(--hl-sm) transition-colors group-focus:ring-2 group-data-selected:bg-(--hl-xs)">
                                  <Icon
                                    icon="check"
                                    className="h-3 w-3 opacity-0 group-data-indeterminate:opacity-100 group-data-selected:text-(--color-success) group-data-selected:opacity-100"
                                  />
                                </div>
                              </Checkbox>
                            </div>
                          )}
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="max-w-[24ch] truncate" title={plugin.name}>
                              {plugin.name}
                            </span>
                            {plugin.loadError && (
                              <span className="truncate text-xs font-bold text-(--color-danger)">
                                Failed to load plugin
                              </span>
                            )}
                            {!plugin.loadError && (
                              <span
                                data-testid={`plugin-mode-${plugin.name}`}
                                className="rounded-sm bg-(--hl-xs) px-1.5 text-xs whitespace-nowrap text-(--hl)"
                                title={modeTitle}
                              >
                                {modeLabel}
                              </span>
                            )}
                            <Icon
                              icon={isDetailsExpanded ? 'chevron-up' : 'chevron-down'}
                              className="h-3 w-3 shrink-0 text-(--hl)"
                              data-testid={`plugin-details-chevron-${plugin.name}`}
                            />
                          </div>
                        </div>

                        <div className="flex items-center gap-6" onClick={stopPropagation}>
                          {!plugin.loadError && (
                            <Checkbox
                              data-testid={`plugin-elevated-${plugin.name}`}
                              isSelected={isElevated}
                              isDisabled={isRefreshingPlugins}
                              className="group flex cursor-auto items-center gap-1.5 p-0 text-xs disabled:animate-pulse"
                              onChange={isSelected => {
                                patchSettings({
                                  pluginConfig: {
                                    ...settings.pluginConfig,
                                    [plugin.name]: {
                                      ...plugin.config,
                                      ...settings.pluginConfig?.[plugin.name],
                                      elevated: isSelected,
                                    },
                                  },
                                });
                              }}
                            >
                              <div className="flex h-4 w-4 items-center justify-center rounded-sm ring-1 ring-(--hl-sm) transition-colors group-focus:ring-2 group-data-selected:bg-(--hl-xs)">
                                <Icon
                                  icon="check"
                                  className="h-3 w-3 opacity-0 group-data-selected:text-(--color-warning) group-data-selected:opacity-100"
                                />
                              </div>
                              <span
                                className="whitespace-nowrap text-(--hl)"
                                title="Run this plugin in the main process with full host access instead of the sandbox."
                              >
                                Full host access
                              </span>
                            </Checkbox>
                          )}
                          <div className="flex w-[8ch] cursor-auto items-center justify-center">{plugin.version}</div>
                          <div className="flex w-[8ch] cursor-auto items-center gap-1">
                            <CopyButton
                              size="small"
                              variant="text"
                              title={plugin.directory}
                              content={plugin.directory}
                              confirmMessage=""
                              className="px-[calc(var(--padding-md) * 0.8)] w-[40px] border border-solid border-transparent"
                            >
                              <Icon icon="copy" className="h-4 w-4 text-white" />
                            </CopyButton>
                            <Button onPress={() => window.shell.showItemInFolder(plugin.directory)}>
                              <Icon icon="folder-open" className="h-4 w-4 text-white" />
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Grid-rows trick animates open/close smoothly since height: auto can't be transitioned. */}
                      <div
                        className="grid transition-[grid-template-rows] duration-200 ease-in-out"
                        style={{ gridTemplateRows: isDetailsExpanded ? '1fr' : '0fr' }}
                      >
                        {/* This overflow-hidden wrapper, not its child, is what collapses to zero height. */}
                        <div className="overflow-hidden" data-testid={`plugin-details-${plugin.name}`}>
                          <div className="flex flex-col gap-2 pb-2 pl-9 text-xs text-(--hl)">
                            {plugin.loadError && (
                              <div className="selectable force-pre-wrap text-(--color-danger)">
                                <code>{plugin.loadError}</code>
                              </div>
                            )}
                            {plugin.displayName && plugin.displayName !== plugin.name && (
                              <div
                                data-testid={`plugin-display-name-${plugin.name}`}
                                className="font-semibold text-(--hl-xl)"
                              >
                                {plugin.displayName}
                              </div>
                            )}
                            <div data-testid={`plugin-description-${plugin.name}`} className="text-(--hl) italic">
                              {plugin.description || 'A non-descriptive Insomnia plugin.'}
                            </div>
                            <div data-testid={`plugin-permissions-${plugin.name}`}>
                              <span className="font-bold text-(--hl-xl)">Permissions</span>
                              {!hasExtraPermissions && <span> ({baselineOnlyNote})</span>}
                              <div className="flex flex-col gap-0.5 border-l border-(--hl-sm) pl-2">
                                <div>Modules: {effectiveModules.join(', ')}</div>
                                <div>Capabilities: {effectiveCapabilities.join(', ')}</div>
                              </div>
                            </div>
                            {plugin.permissionWarnings && plugin.permissionWarnings.length > 0 && (
                              <div
                                data-testid={`plugin-permission-warning-${plugin.name}`}
                                className="text-(--color-warning)"
                              >
                                {plugin.permissionWarnings.join(' ')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </GridListItem>
                );
              }}
            </GridList>
          </div>
        </div>

        <div className="mt-2 flex w-full justify-center">
          <span className="text-sm text-(--hl)">
            Need more plugins?{' '}
            <Button
              className="text-(--color-surprise) underline"
              onPress={() => window.main.openInBrowser(PLUGIN_HUB_BASE)}
            >
              Browse Plugin Hub
            </Button>{' '}
            or{' '}
            <Button
              className="text-(--color-surprise) underline"
              onPress={async () => {
                await window.main.readOrCreateDataDir({ folder: 'plugins' });
                window.shell.showItemInFolder(window.path.resolve(window.app.getPath('userData'), 'plugins'));
              }}
            >
              Reveal Plugins Folder
            </Button>{' '}
            to manage installed ones.
            {showCreatePluginModal && (
              <CreatePluginModal
                onClose={() => setShowCreatePluginModal(false)}
                onComplete={() => {
                  setShowCreatePluginModal(false);
                  handleReloadPlugins();
                }}
              />
            )}
          </span>
        </div>
      </div>
    </div>
  );
};
