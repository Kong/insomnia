import * as path from 'path';
import React, { FC, useEffect, useState } from 'react';

import {
  NPM_PACKAGE_BASE,
  PLUGIN_HUB_BASE,
  PLUGIN_PATH,
} from '../../../common/constants';
import { docsPlugins } from '../../../common/documentation';
import { clickLink } from '../../../common/electron-helpers';
import * as models from '../../../models';
import type { Settings } from '../../../models/settings';
import { createPlugin } from '../../../plugins/create';
import type { Plugin } from '../../../plugins/index';
import { getPlugins } from '../../../plugins/index';
import { reload } from '../../../templating/index';
import { CopyButton } from '../base/copy-button';
import { Link } from '../base/link';
import { HelpTooltip } from '../help-tooltip';
import { showAlert, showPrompt } from '../modals';
import { Button } from '../themed-button';

interface Props {
  settings: Settings;
}

interface State {
  plugins: Plugin[];
  npmPluginValue: string;
  error: Error | null;
  installPluginErrMsg: string;
  isInstallingFromNpm: boolean;
  isRefreshingPlugins: boolean;
}
export const Plugins: FC<Props> = ({ settings }) => {
  const [state, setState] = useState<State>({
    plugins: [],
    npmPluginValue: '',
    error: null,
    installPluginErrMsg: '',
    isInstallingFromNpm: false,
    isRefreshingPlugins: false,
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

  async function refreshPlugins() {
    setState(state => ({ ...state, isRefreshingPlugins: true }));
    // Get and reload plugins
    const plugins = await getPlugins(true);
    reload();

    setState(state => ({ ...state, plugins, isRefreshingPlugins: false }));
  }

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
                        await models.settings.update(settings, {
                          pluginConfig: { ...settings.pluginConfig, [plugin.name]: newConfig },
                        });
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
                      size="small"
                      variant="contained"
                      onClick={() => window.shell.showItemInFolder(plugin.directory)}
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
            {'\n\nThere may be an issue with the plugin itself, as a note you can discover and install plugins from the '}
            <a href="https://insomnia.rest/plugins">Plugin Hub.</a>
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
          try {
            await window.main.installPlugin(npmPluginValue.trim());
            await refreshPlugins();
            newState.npmPluginValue = ''; // Clear input if successful install
          } catch (err) {
            newState.installPluginErrMsg = `Failed to install ${npmPluginValue}`;
            newState.error = err;
          }
          setState(state => ({ ...state, ...newState }));
        }}
      >
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
              placeholder="npm-package-name"
              value={npmPluginValue}
            />
          </div>
          <div className="form-control width-auto">
            <Button variant="contained" bg="surprise" disabled={isInstallingFromNpm}>
              {isInstallingFromNpm && <i className="fa fa-refresh fa-spin space-right" />}
              Install Plugin
            </Button>
          </div>
        </div>
      </form>
      <hr />
      <div className="text-right">
        <Button
          onClick={() => clickLink('https://insomnia.rest/plugins')}
        >
          Browse Plugin Hub
        </Button>
        <Button
          style={{
            marginLeft: '0.3em',
          }}
          onClick={() => showPrompt({
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
          style={{
            marginLeft: '0.3em',
          }}
          onClick={() => window.shell.showItemInFolder(PLUGIN_PATH)}
        >
          Reveal Plugins Folder
        </Button>
        <Button
          disabled={isRefreshingPlugins}
          style={{
            marginLeft: '0.3em',
          }}
          onClick={() => refreshPlugins()}
        >
          Reload Plugins
          {isRefreshingPlugins && <i className="fa fa-refresh fa-spin space-left" />}
        </Button>
      </div>
    </div>
  );
};
