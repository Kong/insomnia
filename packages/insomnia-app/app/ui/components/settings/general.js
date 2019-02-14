// @flow
import * as React from 'react';
import * as fontManager from 'font-manager';
import autobind from 'autobind-decorator';
import HelpTooltip from '../help-tooltip';
import {
  isLinux,
  isMac,
  isWindows,
  UPDATE_CHANNEL_BETA,
  UPDATE_CHANNEL_STABLE,
} from '../../../common/constants';
import type { Settings } from '../../../models/settings';
import CheckForUpdatesButton from '../check-for-updates-button';
import { setFont } from '../../../plugins/misc';

type Props = {
  settings: Settings,
  updateSetting: Function,
  handleToggleMenuBar: Function,
  handleRootCssChange: Function,
};

type State = {
  fonts: [],
};

@autobind
class General extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      fonts: [],
    };
  }

  componentDidMount() {
    fontManager.getAvailableFonts(allFonts => {
      const fonts = allFonts
        .filter(i => i.style.toLowerCase() === 'regular' && !i.italic)
        .sort((a, b) => (a.family > b.family ? 1 : -1));

      this.setState({ fonts });
    });
  }

  async _handleUpdateSetting(e: SyntheticEvent<HTMLInputElement>): Promise<Settings> {
    const el = e.currentTarget;
    let value = el.type === 'checkbox' ? el.checked : el.value;

    if (e.currentTarget.type === 'number') {
      value = parseInt(value, 10);
    }

    if (e.currentTarget.value === '__NULL__') {
      value = null;
    }

    return this.props.updateSetting(el.name, value);
  }

  async _handleToggleMenuBar(e: SyntheticEvent<HTMLInputElement>) {
    const settings = await this._handleUpdateSetting(e);
    this.props.handleToggleMenuBar(settings.autoHideMenuBar);
  }

  async _handleFontLigatureChange(el: SyntheticEvent<HTMLInputElement>) {
    const settings = await this._handleUpdateSetting(el);
    setFont(settings);
  }

  async _handleFontSizeChange(el: SyntheticEvent<HTMLInputElement>) {
    const settings = await this._handleUpdateSetting(el);
    setFont(settings);
  }

  async _handleFontChange(el: SyntheticEvent<HTMLInputElement>) {
    const settings = await this._handleUpdateSetting(el);
    setFont(settings);
  }

  render() {
    const { settings } = this.props;
    const { fonts } = this.state;
    return (
      <div>
        <div className="form-control form-control--thin">
          <label className="inline-block">
            Follow redirects automatically
            <input
              type="checkbox"
              name="followRedirects"
              checked={settings.followRedirects}
              onChange={this._handleUpdateSetting}
            />
          </label>
        </div>

        <div className="form-control form-control--thin">
          <label className="inline-block">
            Validate SSL Certificates
            <input
              type="checkbox"
              name="validateSSL"
              checked={settings.validateSSL}
              onChange={this._handleUpdateSetting}
            />
          </label>
        </div>

        <div className="form-control form-control--thin">
          <label className="inline-block">
            Show passwords in plain-text
            <input
              type="checkbox"
              name="showPasswords"
              checked={settings.showPasswords}
              onChange={this._handleUpdateSetting}
            />
          </label>
        </div>

        <div className="form-control form-control--thin">
          <label className="inline-block">
            Use bulk header editor by default
            <input
              type="checkbox"
              name="useBulkHeaderEditor"
              checked={settings.useBulkHeaderEditor}
              onChange={this._handleUpdateSetting}
            />
          </label>
        </div>

        <div className="form-control form-control--thin">
          <label className="inline-block">
            Always use vertical layout
            <input
              type="checkbox"
              name="forceVerticalLayout"
              checked={settings.forceVerticalLayout}
              onChange={this._handleUpdateSetting}
            />
          </label>
        </div>

        {!isMac() && (
          <div className="form-control form-control--thin">
            <label className="inline-block">
              Hide Menu Bar
              <input
                type="checkbox"
                name="autoHideMenuBar"
                checked={settings.autoHideMenuBar}
                onChange={this._handleToggleMenuBar}
              />
            </label>
          </div>
        )}

        <div className="form-control form-control--thin">
          <label className="inline-block">
            Wrap Long Lines
            <input
              type="checkbox"
              name="editorLineWrapping"
              checked={settings.editorLineWrapping}
              onChange={this._handleUpdateSetting}
            />
          </label>
        </div>

        <div className="form-control form-control--thin">
          <label className="inline-block">
            Nunjucks Power User Mode{' '}
            <HelpTooltip>
              Disable tag editing interface in favor of raw Nunjucks syntax (requires restart)
            </HelpTooltip>
            <input
              type="checkbox"
              name="nunjucksPowerUserMode"
              checked={settings.nunjucksPowerUserMode}
              onChange={this._handleUpdateSetting}
            />
          </label>
        </div>

        <div className="form-control form-control--thin">
          <label className="inline-block">
            Indent With Tabs
            <input
              type="checkbox"
              name="editorIndentWithTabs"
              checked={settings.editorIndentWithTabs}
              onChange={this._handleUpdateSetting}
            />
          </label>
        </div>

        <div className="form-control form-control--thin">
          <label className="inline-block">
            Font Ligatures
            <input
              type="checkbox"
              name="fontVariantLigatures"
              checked={settings.fontVariantLigatures}
              onChange={this._handleFontLigatureChange}
            />
          </label>
        </div>

        <div className="form-row">
          <div className="form-control form-control--outlined pad-top-sm">
            <label>
              Environment Highlight Color Style{' '}
              <HelpTooltip>Configures the appearance of environment's color indicator</HelpTooltip>
              <select
                defaultValue={settings.environmentHighlightColorStyle}
                name="environmentHighlightColorStyle"
                onChange={this._handleUpdateSetting}>
                <option value="sidebar-indicator">Sidebar indicator</option>
                <option value="sidebar-edge">Sidebar edge</option>
                <option value="window-top">Window top</option>
                <option value="window-bottom">Window bottom</option>
                <option value="window-left">Window left</option>
                <option value="window-right">Window right</option>
              </select>
            </label>
          </div>
          <div className="form-control form-control--outlined pad-top-sm">
            <label>
              Autocomplete popup delay
              <HelpTooltip className="space-left">
                Configure the autocomplete popup delay in milliseconds (0 to disable)
              </HelpTooltip>
              <input
                type="number"
                name="autocompleteDelay"
                min={0}
                max={3000}
                defaultValue={settings.autocompleteDelay}
                onChange={this._handleUpdateSetting}
              />
            </label>
          </div>
        </div>

        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Interface Font
              <select
                name="fontInterface"
                value={settings.fontInterface || '__NULL__'}
                onChange={this._handleFontChange}>
                <option value="__NULL__">-- System Default --</option>
                {fonts.map((item, index) => (
                  <option key={index} value={item.family}>
                    {item.family}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              Interface Font Size (px)
              <input
                type="number"
                name="fontSize"
                min={8}
                max={20}
                defaultValue={settings.fontSize}
                onChange={this._handleFontSizeChange}
              />
            </label>
          </div>
        </div>

        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Text Editor Font
              <select
                name="fontMonospace"
                value={settings.fontMonospace || '__NULL__'}
                onChange={this._handleFontChange}>
                <option value="__NULL__">-- System Default --</option>
                {fonts.filter(i => i.monospace).map((item, index) => (
                  <option key={index} value={item.family}>
                    {item.family}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              Text Editor Font Size (px)
              <input
                type="number"
                name="editorFontSize"
                min={8}
                max={20}
                defaultValue={settings.editorFontSize}
                onChange={this._handleUpdateSetting}
              />
            </label>
          </div>
        </div>

        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Text Editor Indent Size
              <input
                type="number"
                name="editorIndentSize"
                min={1}
                max={16}
                defaultValue={settings.editorIndentSize}
                onChange={this._handleUpdateSetting}
              />
            </label>
          </div>

          <div className="form-control form-control--outlined">
            <label>
              Text Editor Key Map
              <select
                defaultValue={settings.editorKeyMap}
                name="editorKeyMap"
                onChange={this._handleUpdateSetting}>
                <option value="default">Default</option>
                <option value="vim">Vim</option>
                <option value="emacs">Emacs</option>
                <option value="sublime">Sublime</option>
              </select>
            </label>
          </div>
        </div>

        <hr className="pad-top" />

        <h2>
          HTTP Network Proxy
          <HelpTooltip
            className="space-left txt-md"
            style={{ maxWidth: '20rem', lineWrap: 'word' }}>
            Enable global network proxy. Supports authentication via Basic Auth, digest, or NTLM
          </HelpTooltip>
        </h2>

        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Maximum Redirects
              <HelpTooltip className="space-left">(-1 for unlimited)</HelpTooltip>
              <input
                type="number"
                name="maxRedirects"
                min={-1}
                defaultValue={settings.maxRedirects}
                onChange={this._handleUpdateSetting}
              />
            </label>
          </div>

          <div className="form-control form-control--outlined">
            <label>
              Network Request Timeout
              <HelpTooltip className="space-left">
                Request timeout in milliseconds (0 for no timeout)
              </HelpTooltip>
              <input
                type="number"
                name="timeout"
                min={-1}
                defaultValue={settings.timeout}
                onChange={this._handleUpdateSetting}
              />
            </label>
          </div>
        </div>

        <hr className="pad-top" />

        <h2>
          HTTP Network Proxy
          <HelpTooltip
            className="space-left txt-md"
            style={{ maxWidth: '20rem', lineWrap: 'word' }}>
            Enable global network proxy. Supports authentication via Basic Auth, digest, or NTLM
          </HelpTooltip>
        </h2>

        <div className="form-control form-control--thin">
          <label className="inline-block">
            Enable Proxy
            <input
              type="checkbox"
              name="proxyEnabled"
              checked={settings.proxyEnabled}
              onChange={this._handleUpdateSetting}
            />
          </label>
        </div>

        <div className="form-row pad-top-sm">
          <div className="form-control form-control--outlined">
            <label>
              HTTP Proxy
              <input
                type="text"
                name="httpProxy"
                disabled={!settings.proxyEnabled}
                placeholder="localhost:8005"
                defaultValue={settings.httpProxy}
                onChange={this._handleUpdateSetting}
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              HTTPS Proxy
              <input
                placeholder="localhost:8005"
                disabled={!settings.proxyEnabled}
                name="httpsProxy"
                type="text"
                defaultValue={settings.httpsProxy}
                onChange={this._handleUpdateSetting}
              />
            </label>
          </div>
          <div className="form-control form-control--outlined">
            <label>
              No Proxy{' '}
              <HelpTooltip>
                Comma-separated list of hostnames that do not require a proxy to be contacted
              </HelpTooltip>
              <input
                placeholder="localhost,127.0.0.1"
                disabled={!settings.proxyEnabled}
                name="noProxy"
                type="text"
                defaultValue={settings.noProxy}
                onChange={this._handleUpdateSetting}
              />
            </label>
          </div>
        </div>

        {(isWindows() || isMac()) && (
          <React.Fragment>
            <hr className="pad-top" />
            <div>
              <div className="pull-right">
                <CheckForUpdatesButton className="btn btn--outlined btn--super-duper-compact">
                  Check Now
                </CheckForUpdatesButton>
              </div>
              <h2>Software Updates</h2>
            </div>
            <div className="form-control form-control--thin">
              <label className="inline-block">
                Automatically download and install updates
                <HelpTooltip className="space-left">
                  If disabled, you will receive a notification when a new update is available
                </HelpTooltip>
                <input
                  type="checkbox"
                  name="updateAutomatically"
                  checked={settings.updateAutomatically}
                  onChange={this._handleUpdateSetting}
                />
              </label>
            </div>
            <div className="form-control form-control--outlined pad-top-sm">
              <label>
                Update Channel
                <select
                  value={settings.updateChannel}
                  name="updateChannel"
                  onChange={this._handleUpdateSetting}>
                  <option value={UPDATE_CHANNEL_STABLE}>Release (Recommended)</option>
                  <option value={UPDATE_CHANNEL_BETA}>Early Access (Beta)</option>
                </select>
              </label>
            </div>
          </React.Fragment>
        )}

        {isLinux() && (
          <React.Fragment>
            <hr className="pad-top" />
            <h2>Software Updates</h2>
            <div className="form-control form-control--thin">
              <label className="inline-block">
                Do not notify of new releases
                <input
                  type="checkbox"
                  name="disableUpdateNotification"
                  checked={settings.disableUpdateNotification}
                  onChange={this._handleUpdateSetting}
                />
              </label>
            </div>
          </React.Fragment>
        )}

        <hr className="pad-top" />
        <h2>Plugins</h2>

        <div className="form-control form-control--outlined">
          <label>
            Additional Plugin Path{' '}
            <HelpTooltip>Tell Insomnia to look for plugins in a different directory</HelpTooltip>
            <input
              placeholder="~/.insomnia:/other/path"
              name="pluginPath"
              type="text"
              defaultValue={settings.pluginPath}
              onChange={this._handleUpdateSetting}
            />
          </label>
        </div>

        <br />
      </div>
    );
  }
}

export default General;
