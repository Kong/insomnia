// @flow
import * as React from 'react';
import * as fontScanner from 'font-scanner';
import * as electron from 'electron';
import autobind from 'autobind-decorator';
import HelpTooltip from '../help-tooltip';
import {
  EDITOR_KEY_MAP_DEFAULT,
  EDITOR_KEY_MAP_EMACS,
  EDITOR_KEY_MAP_SUBLIME,
  EDITOR_KEY_MAP_VIM,
  isLinux,
  isMac,
  isWindows,
  UPDATE_CHANNEL_BETA,
  UPDATE_CHANNEL_STABLE,
} from '../../../common/constants';
import type { Settings } from '../../../models/settings';
import CheckForUpdatesButton from '../check-for-updates-button';
import { setFont } from '../../../plugins/misc';
import * as session from '../../../account/session';
import Tooltip from '../tooltip';

type Props = {
  settings: Settings,
  updateSetting: Function,
  handleToggleMenuBar: Function,
  handleRootCssChange: Function,
};

type State = {
  fonts: Array<{ family: string, monospace: boolean }> | null,
};

@autobind
class General extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      fonts: null,
    };
  }

  async componentDidMount() {
    const allFonts = await fontScanner.getAvailableFonts();
    const fonts = allFonts
      .filter(i => ['regular', 'book'].includes(i.style.toLowerCase()) && !i.italic)
      .sort((a, b) => (a.family > b.family ? 1 : -1));

    this.setState({ fonts });
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

  async _handleUpdateSettingAndRestart(e: SyntheticEvent<HTMLInputElement>) {
    await this._handleUpdateSetting(e);
    const { app } = electron.remote || electron;
    app.relaunch();
    app.exit();
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

  renderBooleanSetting(label: string, name: string, help: string, forceRestart?: boolean) {
    const { settings } = this.props;

    if (!settings.hasOwnProperty(name)) {
      throw new Error(`Invalid boolean setting name ${name}`);
    }

    const onChange = forceRestart ? this._handleUpdateSettingAndRestart : this._handleUpdateSetting;

    return (
      <div className="form-control form-control--thin">
        <label className="inline-block">
          {label}
          {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
          {forceRestart && (
            <Tooltip message="Will restart app" className="space-left">
              <i className="fa fa-refresh super-duper-faint" />
            </Tooltip>
          )}
          <input type="checkbox" name={name} checked={settings[name]} onChange={onChange} />
        </label>
      </div>
    );
  }

  renderTextSetting(label: string, name: string, help: string, props: Object) {
    const { settings } = this.props;

    if (!settings.hasOwnProperty(name)) {
      throw new Error(`Invalid number setting name ${name}`);
    }

    return (
      <div className="form-control form-control--outlined">
        <label>
          {label}
          {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
          <input
            type={props.type || 'text'}
            name={name}
            defaultValue={settings[name]}
            {...props}
            onChange={props.onChange || this._handleUpdateSetting}
          />
        </label>
      </div>
    );
  }

  renderNumberSetting(label: string, name: string, help: string, props: Object) {
    return this.renderTextSetting(label, name, help, { ...props, type: 'number' });
  }

  render() {
    const { settings } = this.props;
    const { fonts } = this.state;
    return (
      <div>
        <div className="row-fill row-fill--top">
          <div>
            {this.renderBooleanSetting('Force bulk header editor', 'useBulkHeaderEditor', '')}
            {this.renderBooleanSetting(
              'Vertical request/response layout',
              'forceVerticalLayout',
              '',
            )}
          </div>
          <div>
            {this.renderBooleanSetting('Reveal passwords', 'showPasswords', '')}
            {!isMac() && this.renderBooleanSetting('Hide menu bar', 'autoHideMenuBar', '')}
            {this.renderBooleanSetting('Raw template syntax', 'nunjucksPowerUserMode', '', true)}
          </div>
        </div>
        <div className="row-fill row-fill--top pad-top-sm">
          <div className="form-control form-control--outlined">
            <label>
              Environment Highlight Style{' '}
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
          {this.renderNumberSetting(
            'Autocomplete popup delay',
            'autocompleteDelay',
            'Configure the autocomplete popup delay in milliseconds (0 to disable)',
            {
              min: 0,
              max: 3000,
            },
          )}
        </div>

        <hr className="pad-top" />

        <h2>Font</h2>

        <div className="row-fill row-fill--top">
          <div>
            {this.renderBooleanSetting('Indent with tabs', 'editorIndentWithTabs', '')}
            {this.renderBooleanSetting('Wrap text editor lines', 'editorLineWrapping', '')}
          </div>
          <div>{this.renderBooleanSetting('Font ligatures', 'fontVariantLigatures', '')}</div>
        </div>

        <div className="form-row pad-top-sm">
          <div className="form-control form-control--outlined">
            <label>
              Interface Font
              {fonts ? (
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
              ) : (
                <select disabled>
                  <option value="__NULL__">-- Unsupported Platform --</option>
                </select>
              )}
            </label>
          </div>
          {this.renderNumberSetting('Interface Font Size (px)', 'fontSize', '', {
            min: 8,
            max: 20,
            onChange: this._handleFontSizeChange,
          })}
        </div>

        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Text Editor Font
              {fonts ? (
                <select
                  name="fontMonospace"
                  value={settings.fontMonospace || '__NULL__'}
                  onChange={this._handleFontChange}>
                  <option value="__NULL__">-- System Default --</option>
                  {fonts
                    .filter(i => i.monospace)
                    .map((item, index) => (
                      <option key={index} value={item.family}>
                        {item.family}
                      </option>
                    ))}
                </select>
              ) : (
                <select disabled>
                  <option value="__NULL__">-- Unsupported Platform --</option>
                </select>
              )}
            </label>
          </div>
          {this.renderNumberSetting('Editor Font Size (px)', 'editorFontSize', '', {
            min: 8,
            max: 20,
          })}
        </div>

        <div className="form-row">
          {this.renderNumberSetting('Editor Indent Size', 'editorIndentSize', '', {
            min: 1,
            max: 16,
          })}
          <div className="form-control form-control--outlined">
            <label>
              Text Editor Key Map
              <select
                defaultValue={settings.editorKeyMap}
                name="editorKeyMap"
                onChange={this._handleUpdateSetting}>
                <option value={EDITOR_KEY_MAP_DEFAULT}>Default</option>
                <option value={EDITOR_KEY_MAP_VIM}>Vim</option>
                <option value={EDITOR_KEY_MAP_EMACS}>Emacs</option>
                <option value={EDITOR_KEY_MAP_SUBLIME}>Sublime</option>
              </select>
            </label>
          </div>
        </div>

        <hr className="pad-top" />

        <h2>Network</h2>

        {this.renderBooleanSetting('Validate certificates', 'validateSSL', '')}
        {this.renderBooleanSetting('Follow redirects', 'followRedirects', '')}

        <div className="form-row pad-top-sm">
          {this.renderNumberSetting('Maximum Redirects', 'maxRedirects', '-1 for infinite', {
            min: -1,
          })}
          {this.renderNumberSetting('Request Timeout', 'timeout', '-1 for infinite', { min: -1 })}
        </div>

        <div className="form-row pad-top-sm">
          {this.renderNumberSetting(
            'Response History Limit',
            'maxHistoryResponses',
            'Number of responses to keep for each request (-1 for infinity)',
            { min: -1 },
          )}
          {this.renderNumberSetting(
            'Max Timeline Chunk Size (KB)',
            'maxTimelineDataSizeKB',
            'Maximum size in kilobytes to show on timeline',
            { min: 0 },
          )}
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

        {this.renderBooleanSetting('Enable proxy', 'proxyEnabled', '')}

        <div className="form-row pad-top-sm">
          {this.renderTextSetting('HTTP Proxy', 'httpProxy', '', {
            placeholder: 'localhost:8005',
            disabled: !settings.proxyEnabled,
          })}
          {this.renderTextSetting('HTTPS Proxy', 'httpsProxy', '', {
            placeholder: 'localhost:8005',
            disabled: !settings.proxyEnabled,
          })}
          {this.renderTextSetting(
            'No Proxy',
            'noProxy',
            'Comma-separated list of hostnames that do not require a proxy to be contacted',
            {
              placeholder: 'localhost,127.0.0.1',
              disabled: !settings.proxyEnabled,
            },
          )}
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
            {this.renderBooleanSetting(
              'Automatically download and install updates',
              'updateAutomatically',
              'If disabled, you will receive a notification when a new update is available',
            )}
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
            {this.renderBooleanSetting(
              'Do not notify of new releases',
              'disableUpdateNotification',
              '',
            )}
          </React.Fragment>
        )}

        <hr className="pad-top" />
        <h2>Plugins</h2>

        {this.renderTextSetting(
          'Additional Plugin Path',
          'pluginPath',
          'Tell Insomnia to look for plugins in a different directory',
          { placeholder: '~/.insomnia:/other/path' },
        )}

        <br />

        {session.isLoggedIn() && (
          <React.Fragment>
            <hr />
            {this.renderBooleanSetting('Enable version control beta', 'enableSyncBeta', '', true)}
          </React.Fragment>
        )}
      </div>
    );
  }
}

export default General;
