import * as path from 'path';
import React, { type FC, useEffect, useState } from 'react';
import { Button, FileTrigger } from 'react-aria-components';

import {
  ACCEPTED_NODE_CA_FILE_EXTS,
  NPM_PACKAGE_BASE,
  PLUGIN_HUB_BASE,
} from '../../../common/constants';
import { docsPlugins } from '../../../common/documentation';
import { createPlugin } from '../../../plugins/create';
import type { Plugin } from '../../../plugins/index';
import { getPlugins } from '../../../plugins/index';
import { reload } from '../../../templating/index';
import { useSettingsPatcher } from '../../hooks/use-request';
import { useRootLoaderData } from '../../routes/root';
import { CopyButton } from '../base/copy-button';
import { Link } from '../base/link';
import { HelpTooltip } from '../help-tooltip';
import { Icon } from '../icon';
import { showAlert, showPrompt } from '../modals';
import { Tooltip } from '../tooltip';
interface State {
  plugins: Plugin[];
  npmPluginValue: string;
  error: Error | null;
  installPluginErrMsg: string;
  isInstallingFromNpm: boolean;
  isRefreshingPlugins: boolean;
  pluginNodeExtraCerts: string;
}

export const Plugins: FC = () => {
  const {
    settings,
  } = useRootLoaderData();
  const [state, setState] = useState<State>({
    plugins: [],
    npmPluginValue: '',
    error: null,
    installPluginErrMsg: '',
    isInstallingFromNpm: false,
    isRefreshingPlugins: false,
    pluginNodeExtraCerts: settings.pluginNodeExtraCerts,
  });
  const {
    plugins,
    error,
    installPluginErrMsg,
    isInstallingFromNpm,
    isRefreshingPlugins,
    npmPluginValue,
  } = state;

  useEffect(() => {
    refreshPlugins();
  }, []);

  useEffect(() => {
    setState(state => ({ ...state, pluginNodeExtraCerts: settings.pluginNodeExtraCerts }));
  }, [settings.pluginNodeExtraCerts]);

  async function refreshPlugins() {
    setState(state => ({ ...state, isRefreshingPlugins: true }));
    // Get and reload plugins
    const plugins = await getPlugins(true);
    reload();

    setState(state => ({ ...state, plugins, isRefreshingPlugins: false }));
  }
  const patchSettings = useSettingsPatcher();

  return (
    <div>
      <p className="notice info no-margin-top">
        Plugins is still an experimental feature. See{' '}
        <Link href={docsPlugins}>Documentation</Link> for more info.
      </p>
      {plugins.length === 0 ? (
        <div className="text-center faint italic pad">No Plugins Added</div>
      ) : (
        <table className="table--fancy table--striped table--valign-middle margin-top margin-bottom">
          <thead>
            <tr>
              <th>Enable?</th>
              <th>Name</th>
              <th>Version</th>
              <th>Folder</th>
            </tr>
          </thead>
          <tbody>
            {plugins.map(plugin => {
              const link = path.join(/^insomnia-plugin-/.test(plugin.name) ? PLUGIN_HUB_BASE : NPM_PACKAGE_BASE, plugin.name);
              return !plugin.directory ? null : (
                <tr key={plugin.name}>
                  <td style={{ width: '4rem' }}>
                    <input
                      type="checkbox"
                      checked={!plugin.config.disabled}
                      disabled={isRefreshingPlugins}
                      onChange={async event => {
                        const newConfig = { ...plugin.config, disabled: !event.target.checked };
                        setState(state => ({ ...state, isRefreshingPlugins: true }));
                        patchSettings({ pluginConfig: { ...settings.pluginConfig, [plugin.name]: newConfig } });
                        refreshPlugins();
                      }}
                    />
                  </td>
                  <td>
                    {plugin.name}
                    {plugin.description && (
                      <HelpTooltip info className="space-left">
                        {plugin.description}
                      </HelpTooltip>
                    )}
                  </td>
                  <td>
                    {plugin.version}
                    <a className="space-left" href={link} title={link}>
                      <i className="fa fa-external-link-square" />
                    </a>
                  </td>
                  <td
                    className="no-wrap"
                    style={{
                      width: '10rem',
                    }}
                  >
                    <CopyButton
                      size="small"
                      variant="contained"
                      title={plugin.directory}
                      content={plugin.directory}
                    >
                      Copy Path
                    </CopyButton>{' '}
                    <Button
                      onPress={() => window.shell.showItemInFolder(plugin.directory)}
                    >
                      Reveal Folder
                    </Button>
                  </td>
                </tr>
              );
            }
            )}
          </tbody>
        </table>
      )}

      {error && (
        <div className="notice error text-left margin-bottom">
          <button className="pull-right icon" onClick={() => setState(state => ({ ...state, error: null }))}>
            <i className="fa fa-times" />
          </button>
          <div className="selectable force-pre-wrap">
            <b>{installPluginErrMsg}</b>
            <br />
            Try using the install button on <a href={PLUGIN_HUB_BASE}>Plugin Hub.</a>
            <details>
              <summary>Additional Information</summary>
              <pre className="pad-top-sm force-wrap selectable">
                <code>{error.stack || error.message}</code>
              </pre>
            </details>
          </div>
        </div>
      )}

      <form
        onSubmit={async event => {
          event.preventDefault();
          setState(state => ({ ...state, isInstallingFromNpm: true }));
          const newState: Partial<State> = {
            isInstallingFromNpm: false,
            error: null,
            installPluginErrMsg: '',
          };
          if (!npmPluginValue.startsWith('insomnia-plugin-')) {
            newState.installPluginErrMsg = 'Please enter a plugin name starting with insomnia-plugin-';
            newState.error = new Error('Invalid plugin name');
            setState(state => ({ ...state, ...newState }));
            return;
          }
          try {
            await window.main.installPlugin(npmPluginValue.trim());
            await refreshPlugins();
            newState.npmPluginValue = ''; // Clear input if successful install
          } catch (err) {
            newState.installPluginErrMsg = `Failed to install ${npmPluginValue}. Please contact the plugin author sharing the below stack trace to help them to ensure compatibility with the latest Insomnia.`;
            newState.error = err;
          }
          setState(state => ({ ...state, ...newState }));
        }}
      >
        <div className="form-row">
          <div className="form-control">
            <Icon icon='info-circle' className='px-2' />
            <span>Enter the full name of an npm package beginning with insomnia-plugin-*</span>
          </div>
        </div>
        <div className="form-row">
          <div className="form-control form-control--outlined">
            <input
              onChange={event => {
                if (event.target instanceof HTMLInputElement) {
                  setState(state => ({ ...state, npmPluginValue: event.target.value }));
                }
              }}
              disabled={isInstallingFromNpm}
              type="text"
              placeholder="insomnia-plugin-placeholder"
              value={npmPluginValue}
            />
          </div>
          <div className="form-control width-auto">
            <Button
              className="m-1 px-[--padding-md] h-[--line-height-xs] py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all border border-solid border-[--hl-lg] rounded-[--radius-md]"
              isDisabled={isInstallingFromNpm}
              type="submit"
            >
              {isInstallingFromNpm && <i className="fa fa-refresh fa-spin space-right" />}
              Install Plugin
            </Button>
          </div>
        </div>
      </form >
      <div className="w-full flex flex-row justify-center mt-2">
        <Button
          className="m-1 px-[--padding-md] h-[--line-height-xs] py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all border border-solid border-[--hl-lg] rounded-[--radius-md]"
          onPress={() => window.main.openInBrowser(PLUGIN_HUB_BASE)}
        >
          Browse Plugin Hub
        </Button>
        <Button
          className="m-1 px-[--padding-md] h-[--line-height-xs] py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all border border-solid border-[--hl-lg] rounded-[--radius-md]"
          onPress={() => showPrompt({
            title: 'New Plugin',
            defaultValue: 'demo-example',
            placeholder: 'example-name',
            submitName: 'Generate',
            label: 'Plugin Name',
            selectText: true,
            validate: name =>
              name.match(/^[a-z][a-z-]*[a-z]$/) ? '' : 'Plugin name must be of format my-plugin-name',
            onComplete: async name => {
              // Remove insomnia-plugin- prefix if they accidentally typed it
              name = name.replace(/^insomnia-plugin-/, '');
              try {
                await createPlugin(
                  `insomnia-plugin-${name}`,
                  '0.0.1',
                  [
                    '// For help writing plugins, visit the documentation to get started:',
                    `//   ${docsPlugins}`,
                    '',
                    '// TODO: Add plugin code here...',
                  ].join('\n'),
                );
              } catch (err) {
                console.error(err);
                showAlert({
                  title: 'Failed to Create Plugin',
                  message: err.message,
                });
              }
              refreshPlugins();
            },
          })}
        >Generate New Plugin</Button>
        <Button
          className="m-1 px-[--padding-md] h-[--line-height-xs] py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all border border-solid border-[--hl-lg] rounded-[--radius-md]"
          onPress={() => window.shell.showItemInFolder(path.join(process.env['INSOMNIA_DATA_PATH'] || window.app.getPath('userData'), 'plugins'))}
        >
          Reveal Plugins Folder
        </Button>
        <Button
          isDisabled={isRefreshingPlugins}
          className="m-1 px-[--padding-md] h-[--line-height-xs] py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all border border-solid border-[--hl-lg] rounded-[--radius-md]"
          onPress={() => refreshPlugins()}
        >
          Reload Plugins
          {isRefreshingPlugins && <i className="fa fa-refresh fa-spin space-left" />}
        </Button>
      </div>

      <div className="form-row mt-6">
        <div className="form-control">
          <span className="mr-2">Plugin Installation Trusted Certificates File ({ACCEPTED_NODE_CA_FILE_EXTS.join(', ')})</span>
          <Tooltip
            className="cursor-pointer"
            message={
              <span>You can bundle multiple root certificates into a single file. <a className="underline" href="https://github.com/Kong/insomnia/wiki/Combining-Multiple-Root-CAs-into-a-single-file">See instructions <i className="fa fa-external-link" /></a></span>
            }
          >
            <i className="fa fa-info-circle" />
          </Tooltip>
        </div>
      </div>
      <div className="form-row">
        <div className="form-control form-control--outlined">
          <input
            disabled={true}
            type="text"
            value={state.pluginNodeExtraCerts}
          />
        </div>
        <div className="form-control width-auto">
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
            <Button
              className="m-1 px-[--padding-md] h-[--line-height-xs] py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all border border-solid border-[--hl-lg] rounded-[--radius-md]"
            >
              Browse...
            </Button>
          </FileTrigger>
        </div>
        <div className="form-control width-auto">
          <Button
            className="m-1 px-[--padding-md] h-[--line-height-xs] py-1 flex items-center justify-center gap-2 aria-pressed:bg-[--hl-sm] text-[--color-font] hover:bg-[--hl-xs] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all border border-solid border-[--hl-lg] rounded-[--radius-md]"
            onPress={() => {
              patchSettings({ pluginNodeExtraCerts: '' });
            }}
            isDisabled={state.pluginNodeExtraCerts === ''}
          >Clear</Button>
        </div>
      </div>
    </div >
  );
};
