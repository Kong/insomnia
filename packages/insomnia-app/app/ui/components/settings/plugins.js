// @flow
import * as path from 'path';
import type { Plugin } from '../../../plugins/index';
import { getPlugins } from '../../../plugins/index';
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import {
  AUTOBIND_CFG,
  NPM_PACKAGE_BASE,
  PLUGIN_HUB_BASE,
  PLUGIN_PATH,
} from '../../../common/constants';
import * as electron from 'electron';
import CopyButton from '../base/copy-button';
import { reload } from '../../../templating/index';
import installPlugin from '../../../plugins/install';
import HelpTooltip from '../help-tooltip';
import Link from '../base/link';
import { delay } from '../../../common/misc';

import type { PluginConfig, Settings } from '../../../models/settings';
import { Button, ToggleSwitch } from 'insomnia-components';
import { createPlugin } from '../../../plugins/create';
import { showAlert, showPrompt } from '../modals';
import { docsPlugins } from '../../../common/documentation';

type State = {
  plugins: Array<Plugin>,
  npmPluginValue: string,
  error: Object,
  installPluginErrMsg: string,
  isInstallingFromNpm: boolean,
  isRefreshingPlugins: boolean,
};

type Props = {
  settings: Settings,
  updateSetting: Function,
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class Plugins extends React.PureComponent<Props, State> {
  _isMounted: boolean;

  constructor(props: Props) {
    super(props);
    this.state = {
      plugins: [],
      npmPluginValue: '',
      error: null,
      installPluginErrMsg: '',
      isInstallingFromNpm: false,
      isRefreshingPlugins: false,
    };
  }

  _handleClearError() {
    this.setState({ error: null });
  }

  _handleAddNpmPluginChange(e: Event) {
    if (e.target instanceof HTMLInputElement) {
      this.setState({ npmPluginValue: e.target.value });
    }
  }

  async _handleAddFromNpm(e: Event): Promise<void> {
    e.preventDefault();

    this.setState({ isInstallingFromNpm: true });

    const newState: $Shape<State> = {
      isInstallingFromNpm: false,
      error: null,
      installPluginErrMsg: '',
    };
    try {
      await installPlugin(this.state.npmPluginValue.trim());
      await this._handleRefreshPlugins();
      newState.npmPluginValue = ''; // Clear input if successful install
    } catch (err) {
      newState.installPluginErrMsg = `Failed to install ${this.state.npmPluginValue}`;
      newState.error = err;
    }

    this.setState(newState);
  }

  static _handleOpenDirectory(directory: string): void {
    electron.remote.shell.showItemInFolder(directory);
  }

  async _handleRefreshPlugins(): Promise<void> {
    const start = Date.now();

    this.setState({ isRefreshingPlugins: true });

    // Get and reload plugins
    const plugins = await getPlugins(true);
    reload();

    // Delay loading for at least 500ms. UX FTW!
    const delta = Date.now() - start;
    await delay(500 - delta);

    if (this._isMounted) {
      this.setState({
        plugins,
        isRefreshingPlugins: false,
      });
    }
  }

  async _handleClickRefreshPlugins() {
    await this._handleRefreshPlugins();
  }

  static _handleClickShowPluginsFolder() {
    electron.remote.shell.showItemInFolder(PLUGIN_PATH);
  }

  _handleCreatePlugin() {
    showPrompt({
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
        await this._handleRefreshPlugins();
      },
    });
  }

  componentDidMount() {
    this._isMounted = true;
    this._handleRefreshPlugins();
  }

  componentWillUnmount() {
    this._isMounted = false;
  }

  async _handleUpdatePluginConfig(pluginName: string, config: PluginConfig) {
    const { updateSetting, settings } = this.props;

    await updateSetting('pluginConfig', {
      ...settings.pluginConfig,
      [pluginName]: config,
    });
  }

  async _togglePluginEnabled(name: string, enabled: boolean, config: PluginConfig) {
    const newConfig = {
      ...config,
      disabled: !enabled,
    };

    if (this._isMounted) {
      this.setState({ isRefreshingPlugins: true });
    }

    await this._handleUpdatePluginConfig(name, newConfig);
    await this._handleRefreshPlugins();
  }

  renderToggleSwitch(plugin: Plugin) {
    return (
      <ToggleSwitch
        className="valign-middle"
        checked={!plugin.config.disabled}
        disabled={this.state.isRefreshingPlugins}
        onChange={async checked => {
          await this._togglePluginEnabled(plugin.name, checked, plugin.config);
        }}
      />
    );
  }

  renderLink(plugin: Plugin) {
    const { name } = plugin;

    const base = /^insomnia-plugin-/.test(name) ? PLUGIN_HUB_BASE : NPM_PACKAGE_BASE;
    const link = path.join(base, name);

    return (
      <a className="space-left" href={link} title={link}>
        <i className="fa fa-external-link-square" />
      </a>
    );
  }

  render() {
    const {
      plugins,
      error,
      installPluginErrMsg,
      isInstallingFromNpm,
      isRefreshingPlugins,
      npmPluginValue,
    } = this.state;

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
              {plugins.map(plugin =>
                !plugin.directory ? null : (
                  <tr key={plugin.name}>
                    <td style={{ width: '4rem' }}>{this.renderToggleSwitch(plugin)}</td>
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
                      {this.renderLink(plugin)}
                    </td>
                    <td className="no-wrap" style={{ width: '10rem' }}>
                      <CopyButton
                        size="small"
                        variant="contained"
                        title={plugin.directory}
                        content={plugin.directory}>
                        Copy Path
                      </CopyButton>{' '}
                      <Button
                        size="small"
                        variant="contained"
                        onClick={Plugins._handleOpenDirectory.bind(this, plugin.directory)}>
                        Reveal Folder
                      </Button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        )}

        {error && (
          <div className="notice error text-left margin-bottom">
            <button className="pull-right icon" onClick={this._handleClearError}>
              <i className="fa fa-times" />
            </button>
            <div className="selectable force-pre-wrap">
              <b>{installPluginErrMsg}</b>
              {`\n\nThere may be an issue with the plugin itself, as a note you can discover and install plugins from the `}
              <a href="https://insomnia.rest/plugins">Plugin Hub.</a>
              <details>
                <summary>Additionl Information</summary>
                <pre className="pad-top-sm force-wrap selectable">
                  <code>{error.stack || error}</code>
                </pre>
              </details>
            </div>
          </div>
        )}

        <form onSubmit={this._handleAddFromNpm}>
          <div className="form-row">
            <div className="form-control form-control--outlined">
              <input
                onChange={this._handleAddNpmPluginChange}
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
          <Button onClick={this._handleCreatePlugin}>Generate New Plugin</Button>
          <Button className="space-left" onClick={Plugins._handleClickShowPluginsFolder}>
            Reveal Plugins Folder
          </Button>
          <Button
            disabled={isRefreshingPlugins}
            className="space-left"
            onClick={this._handleClickRefreshPlugins}>
            Reload Plugins
            {isRefreshingPlugins && <i className="fa fa-refresh fa-spin space-left" />}
          </Button>
        </div>
      </div>
    );
  }
}

export default Plugins;
