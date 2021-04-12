// @flow
import * as React from 'react';
import * as fontScanner from 'font-scanner';
import * as electron from 'electron';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import {
  ACTIVITY_MIGRATION,
  AUTOBIND_CFG,
  EDITOR_KEY_MAP_DEFAULT,
  EDITOR_KEY_MAP_EMACS,
  EDITOR_KEY_MAP_SUBLIME,
  EDITOR_KEY_MAP_VIM,
  HttpVersions,
  isDevelopment,
  isMac,
  updatesSupported,
  UPDATE_CHANNEL_BETA,
  UPDATE_CHANNEL_STABLE,
  MIN_INTERFACE_FONT_SIZE,
  MAX_INTERFACE_FONT_SIZE,
  MIN_EDITOR_FONT_SIZE,
  MAX_EDITOR_FONT_SIZE,
} from '../../../common/constants';
import HelpTooltip from '../help-tooltip';
import type { GlobalActivity, HttpVersion } from '../../../common/constants';

import type { Settings } from '../../../models/settings';
import { setFont } from '../../../plugins/misc';
import Tooltip from '../tooltip';
import CheckForUpdatesButton from '../check-for-updates-button';
import { initNewOAuthSession } from '../../../network/o-auth-2/misc';
import { bindActionCreators } from 'redux';
import * as globalActions from '../../redux/modules/global';
import { connect } from 'react-redux';
import { stringsPlural } from '../../../common/strings';
import { snapNumberToLimits } from '../../../common/misc';

// Font family regex to match certain monospace fonts that don't get
// recognized as monospace
const FORCED_MONO_FONT_REGEX = /^fixedsys /i;

type Props = {
  settings: Settings,
  hideModal: () => void,
  updateSetting: Function,
  handleToggleMenuBar: Function,
  handleRootCssChange: Function,
  handleSetActiveActivity: (activity?: GlobalActivity) => void,
};

type State = {
  fonts: Array<{ family: string, monospace: boolean }> | null,
  fontsMono: Array<{ family: string, monospace: boolean }> | null,
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class General extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      fonts: null,
      fontsMono: null,
    };
  }

  async componentDidMount() {
    const allFonts = await fontScanner.getAvailableFonts();

    // Find regular fonts
    const fonts = allFonts
      .filter(i => ['regular', 'book'].includes(i.style.toLowerCase()) && !i.italic)
      .sort((a, b) => (a.family > b.family ? 1 : -1));

    // Find monospaced fonts
    // NOTE: Also include some others:
    //  - https://github.com/Kong/insomnia/issues/1835
    const fontsMono = fonts.filter(i => i.monospace || i.family.match(FORCED_MONO_FONT_REGEX));

    this.setState({
      fonts,
      fontsMono,
    });
  }

  async _handleUpdateSetting(e: SyntheticEvent<HTMLInputElement>): Promise<Settings> {
    const el = e.currentTarget;
    let value = el.type === 'checkbox' ? el.checked : el.value;

    if (el.type === 'number') {
      value = snapNumberToLimits(
        parseInt(value, 10) || 0,
        parseInt(el.min, 10),
        parseInt(el.max, 10),
      );
    }

    if (el.value === '__NULL__') {
      value = null;
    }

    return this.props.updateSetting(el.name, value);
  }

  async _handleUpdateSettingAndRestart(e: SyntheticEvent<HTMLInputElement>) {
    await this._handleUpdateSetting(e);
    const { app } = electron.remote || electron;
    app.relaunch();
    app.exit();
  }

  async _handleFontSizeChange(el: SyntheticEvent<HTMLInputElement>) {
    const settings = await this._handleUpdateSetting(el);

    setFont(settings);
  }

  async _handleFontChange(el: SyntheticEvent<HTMLInputElement>) {
    const settings = await this._handleUpdateSetting(el);
    setFont(settings);
  }

  _handleStartMigration() {
    this.props.handleSetActiveActivity(ACTIVITY_MIGRATION);
    this.props.hideModal();
  }

  renderEnumSetting(
    label: string,
    name: string,
    values: Array<{ name: string, value: any }>,
    help: string,
    forceRestart?: boolean,
  ) {
    const { settings } = this.props;
    const onChange = forceRestart ? this._handleUpdateSettingAndRestart : this._handleUpdateSetting;
    return (
      <div className="form-control form-control--outlined pad-top-sm">
        <label>
          {label}
          {help && <HelpTooltip className="space-left">{help}</HelpTooltip>}
          <select value={settings[name] || '__NULL__'} name={name} onChange={onChange}>
            {values.map(({ name, value }) => (
              <option key={value} value={value}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
    );
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
    return this.renderTextSetting(label, name, help, {
      ...props,
      type: 'number',
    });
  }

  render() {
    const { settings } = this.props;
    const { fonts, fontsMono } = this.state;
    return (
      <div className="pad-bottom">
        <div className="row-fill row-fill--top">
          <div>
            {this.renderBooleanSetting('Use bulk header editor', 'useBulkHeaderEditor', '')}
            {this.renderBooleanSetting(
              'Vertical request/response layout',
              'forceVerticalLayout',
              '',
            )}
          </div>
          <div>
            {this.renderBooleanSetting('Reveal passwords', 'showPasswords', '')}
            {!isMac() && this.renderBooleanSetting('Hide menu bar', 'autoHideMenuBar', '', true)}
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
            min: MIN_INTERFACE_FONT_SIZE,
            max: MAX_INTERFACE_FONT_SIZE,
            onBlur: this._handleFontSizeChange,
          })}
        </div>

        <div className="form-row">
          <div className="form-control form-control--outlined">
            <label>
              Text Editor Font
              {fontsMono ? (
                <select
                  name="fontMonospace"
                  value={settings.fontMonospace || '__NULL__'}
                  onChange={this._handleFontChange}>
                  <option value="__NULL__">-- System Default --</option>
                  {fontsMono.map((item, index) => (
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
            min: MIN_EDITOR_FONT_SIZE,
            max: MAX_EDITOR_FONT_SIZE,
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

        <h2>Request / Response</h2>

        <div className="row-fill row-fill--top">
          <div>
            {this.renderBooleanSetting('Validate certificates', 'validateSSL', '')}
            {this.renderBooleanSetting('Follow redirects', 'followRedirects', '')}
            {this.renderBooleanSetting(
              'Filter responses by environment',
              'filterResponsesByEnv',
              'Only show responses that were sent under the currently-active environment. This ' +
                'adds additional separation when working with Development, Staging, Production ' +
                'environments, for example.',
            )}
          </div>
          <div>
            {this.renderBooleanSetting('Disable JS in HTML preview', 'disableHtmlPreviewJs', '')}
            {this.renderBooleanSetting(
              'Disable Links in response viewer',
              'disableResponsePreviewLinks',
              '',
            )}
          </div>
        </div>

        <div className="form-row pad-top-sm">
          {this.renderEnumSetting(
            'Preferred HTTP version',
            'preferredHttpVersion',
            ([
              { name: 'Default', value: HttpVersions.default },
              { name: 'HTTP 1.0', value: HttpVersions.V1_0 },
              { name: 'HTTP 1.1', value: HttpVersions.V1_1 },
              { name: 'HTTP/2', value: HttpVersions.V2_0 },

              // Enable when our version of libcurl supports HTTP/3
              // { name: 'HTTP/3', value: HttpVersions.v3 },
            ]: Array<{ name: string, value: HttpVersion }>),
            'Preferred HTTP version to use for requests which will fall back if it cannot be' +
              'negotiated',
          )}
        </div>

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

        <h2>Security</h2>
        <div className="form-row pad-top-sm">
          {this.renderBooleanSetting(
            'Clear OAuth 2 session on start',
            'clearOAuth2SessionOnRestart',
            'Clears the session of the OAuth2 popup window every time Insomnia is launched',
          )}
          <button
            className="btn btn--clicky pointer"
            style={{ padding: 0 }}
            onClick={initNewOAuthSession}>
            Clear OAuth 2 session
          </button>
        </div>

        <hr className="pad-top" />

        <h2>
          HTTP Network Proxy
          <HelpTooltip
            className="space-left txt-md"
            style={{
              maxWidth: '20rem',
              lineWrap: 'word',
            }}>
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

        {updatesSupported() && (
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

        {!updatesSupported() && (
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

        <hr className="pad-top" />
        <h2>Data Sharing</h2>
        <div className="form-control form-control--thin">
          <label className="inline-block">
            Send Usage Statistics{' '}
            <input
              type="checkbox"
              name="enableAnalytics"
              checked={!!settings.enableAnalytics}
              onChange={this._handleUpdateSetting}
            />
          </label>
          <p className="txt-sm faint">
            Help Kong improve its products by sending anonymous data about features and plugins
            used, hardware and software configuration, statistics on number of requests,{' '}
            {stringsPlural.collection.toLowerCase()}, {stringsPlural.document.toLowerCase()}, etc.
          </p>
          <p className="txt-sm faint">
            Please note that this will not include personal data or any sensitive information, such
            as request data, names, etc.
          </p>
        </div>

        <hr className="pad-top" />

        <h2>Migrate from Designer</h2>
        <div className="form-row--start pad-top-sm">
          <button className="btn btn--clicky pointer" onClick={this._handleStartMigration}>
            Show migration workflow
          </button>
        </div>

        {isDevelopment() && (
          <>
            <hr className="pad-top" />
            <h2>Development</h2>
            <div className="form-row pad-top-sm">
              {this.renderBooleanSetting(
                'Has been prompted to migrate from Insomnia Designer',
                'hasPromptedToMigrateFromDesigner',
              )}
            </div>
            <div className="form-row pad-top-sm">
              {this.renderBooleanSetting('Has seen onboarding experience', 'hasPromptedOnboarding')}
            </div>
          </>
        )}
      </div>
    );
  }
}

function mapDispatchToProps(dispatch) {
  const global = bindActionCreators(globalActions, dispatch);
  return {
    handleSetActiveActivity: global.setActiveActivity,
  };
}

export default connect(null, mapDispatchToProps)(General);
