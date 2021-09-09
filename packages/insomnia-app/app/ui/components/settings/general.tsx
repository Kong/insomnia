import { autoBindMethodsForReact } from 'class-autobind-decorator';
import * as fontScanner from 'font-scanner';
import React, { Fragment, PureComponent } from 'react';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';

import type { GlobalActivity, HttpVersion } from '../../../common/constants';
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
  MAX_EDITOR_FONT_SIZE,
  MAX_INTERFACE_FONT_SIZE,
  MIN_EDITOR_FONT_SIZE,
  MIN_INTERFACE_FONT_SIZE,
  UPDATE_CHANNEL_BETA,
  UPDATE_CHANNEL_STABLE,
  updatesSupported,
} from '../../../common/constants';
import { docsKeyMaps } from '../../../common/documentation';
import { restartApp } from '../../../common/electron-helpers';
import { snapNumberToLimits } from '../../../common/misc';
import { strings } from '../../../common/strings';
import type { Settings } from '../../../models/settings';
import { initNewOAuthSession } from '../../../network/o-auth-2/misc';
import { setFont } from '../../../plugins/misc';
import * as globalActions from '../../redux/modules/global';
import Link from '../base/link';
import CheckForUpdatesButton from '../check-for-updates-button';
import HelpTooltip from '../help-tooltip';
import { BooleanSetting } from './boolean-setting';

// Font family regex to match certain monospace fonts that don't get
// recognized as monospace

const FORCED_MONO_FONT_REGEX = /^fixedsys /i;

interface Props {
  settings: Settings;
  hideModal: () => void;
  updateSetting: (key: string, value: any) => Promise<Settings>;
  handleSetActiveActivity: (activity?: GlobalActivity) => void;
}

interface State {
  fonts: {
    family: string;
    monospace: boolean;
  }[] | null;
  fontsMono: {
    family: string;
    monospace: boolean;
  }[] | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class General extends PureComponent<Props, State> {
  state: State = {
    fonts: null,
    fontsMono: null,
  };

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

  async _handleUpdateSetting(e: React.SyntheticEvent<HTMLInputElement>) {
    const el = e.currentTarget;
    let value = el.type === 'checkbox' ? el.checked : el.value;

    if (el.type === 'number') {
      // @ts-expect-error -- TSCONVERSION
      value = snapNumberToLimits(
        // @ts-expect-error -- TSCONVERSION
        parseInt(value, 10) || 0,
        parseInt(el.min, 10),
        parseInt(el.max, 10),
      );
    }

    if (el.value === '__NULL__') {
      // @ts-expect-error -- TSCONVERSION
      value = null;
    }

    return this.props.updateSetting(el.name, value);
  }

  async _handleUpdateSettingAndRestart(e: React.SyntheticEvent<HTMLInputElement>) {
    await this._handleUpdateSetting(e);
    restartApp();
  }

  async _handleFontChange(el: React.SyntheticEvent<HTMLInputElement>) {
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
    values: {
      name: string;
      value: any;
    }[],
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
          <select
            value={settings[name] || '__NULL__'}
            name={name}
            // @ts-expect-error -- TSCONVERSION
            onChange={onChange}
          >
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

  renderTextSetting(label: string, name: string, help: string, props: Record<string, any>) {
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

  renderNumberSetting(label: string, name: string, help: string, props: Record<string, any>) {
    return this.renderTextSetting(label, name, help, { ...props, type: 'number' });
  }

  render() {
    const { settings } = this.props;
    const { fonts, fontsMono } = this.state;
    return (
      <div className="pad-bottom">
        <div className="row-fill row-fill--top">
          <div>
            <BooleanSetting
              label="Use bulk header editor"
              setting="useBulkHeaderEditor"
            />
            <BooleanSetting
              label="Use vertical layout"
              setting="forceVerticalLayout"
              help="Stack application panels (e.g. request / response) vertically instead of horizontally."
            />
          </div>
          <div>
            <BooleanSetting
              label="Reveal passwords"
              setting="showPasswords"
            />
            {!isMac() && (
              <BooleanSetting
                label="Hide menu bar"
                setting="autoHideMenuBar"
              />
            )}
            <BooleanSetting
              label="Raw template syntax"
              setting="nunjucksPowerUserMode"
              forceRestart
            />
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
                // @ts-expect-error -- TSCONVERSION
                onChange={this._handleUpdateSetting}
              >
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
            <BooleanSetting
              label="Indent with tabs"
              setting="editorIndentWithTabs"
            />
            <BooleanSetting
              label="Wrap text editor lines"
              setting="editorLineWrapping"
            />
          </div>
          <div><BooleanSetting
            label="Font ligatures"
            setting="fontVariantLigatures"
          /></div>
        </div>

        <div className="form-row pad-top-sm">
          <div className="form-control form-control--outlined">
            <label>
              Interface Font
              {fonts ? (
                <select
                  name="fontInterface"
                  value={settings.fontInterface || '__NULL__'}
                  // @ts-expect-error -- TSCONVERSION
                  onChange={this._handleFontChange}
                >
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
            onBlur: this._handleFontChange,
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
                  // @ts-expect-error -- TSCONVERSION
                  onChange={this._handleFontChange}
                >
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
              {isMac() && settings.editorKeyMap === EDITOR_KEY_MAP_VIM && (
                <HelpTooltip className="space-left">
                  To enable key-repeating with Vim on macOS, see <Link href={docsKeyMaps}>
                    documentation <i className="fa fa-external-link-square" />
                  </Link>
                </HelpTooltip>
              )}
              <select
                defaultValue={settings.editorKeyMap}
                name="editorKeyMap"
                // @ts-expect-error -- TSCONVERSION
                onChange={this._handleUpdateSetting}
              >
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
            <BooleanSetting
              label="Validate certificates"
              setting="validateSSL"
              help="Indicates whether SSL certificates should be validated for API requests. This does not affect SSL certificate validation during authentication."
            />
            <BooleanSetting
              label="Follow redirects"
              setting="followRedirects"
            />
            <BooleanSetting
              label="Filter responses by environment"
              setting="filterResponsesByEnv"
              help="Only show responses that were sent under the currently-active environment. This adds additional separation when working with Development, Staging, Production environments, for example."
            />
          </div>
          <div>
            <BooleanSetting
              label="Disable JS in HTML preview"
              setting="disableHtmlPreviewJs"
            />
            <BooleanSetting
              label="Disable Links in response viewer"
              setting="disableResponsePreviewLinks"
            />
          </div>
        </div>

        <div className="form-row pad-top-sm">
          {this.renderEnumSetting(
            'Preferred HTTP version',
            'preferredHttpVersion',
            [
              {
                name: 'Default',
                value: HttpVersions.default,
              },
              {
                name: 'HTTP 1.0',
                value: HttpVersions.V1_0,
              },
              {
                name: 'HTTP 1.1',
                value: HttpVersions.V1_1,
              },
              {
                name: 'HTTP/2',
                value: HttpVersions.V2_0,
              }, // Enable when our version of libcurl supports HTTP/3
              // { name: 'HTTP/3', value: HttpVersions.v3 },
            ] as {
              name: string;
              value: HttpVersion;
            }[],
            'Preferred HTTP version to use for requests which will fall back if it cannot be ' +
            'negotiated',
          )}
        </div>

        <div className="form-row pad-top-sm">
          {this.renderNumberSetting('Maximum Redirects', 'maxRedirects', '-1 for infinity', {
            min: -1,
          })}
          {this.renderNumberSetting('Request Timeout', 'timeout', '-1 for infinity', {
            min: -1,
          })}
        </div>

        <div className="form-row pad-top-sm">
          {this.renderNumberSetting(
            'Response History Limit',
            'maxHistoryResponses',
            'Number of responses to keep for each request (-1 for infinity)',
            {
              min: -1,
            },
          )}
          {this.renderNumberSetting(
            'Max Timeline Chunk Size (KB)',
            'maxTimelineDataSizeKB',
            'Maximum size in kilobytes to show on timeline',
            {
              min: 0,
            },
          )}
        </div>

        <hr className="pad-top" />

        <h2>Security</h2>
        <div className="form-row pad-top-sm">
          <BooleanSetting
            label="Clear OAuth 2 session on start"
            setting="clearOAuth2SessionOnRestart"
            help="Clears the session of the OAuth2 popup window every time Insomnia is launched"
          />
          <button
            className="btn btn--clicky pointer"
            style={{
              padding: 0,
            }}
            onClick={initNewOAuthSession}
          >
            Clear OAuth 2 session
          </button>
        </div>
        <div className="form-row pad-top-sm">
          <BooleanSetting
            label="Validate certificates during authentication"
            setting="validateAuthSSL"
            help="Indicates whether SSL certificates should be validated during authentication flows"
          />
        </div>

        <hr className="pad-top" />

        <h2>
          HTTP Network Proxy
          <HelpTooltip
            className="space-left txt-md"
            style={{
              maxWidth: '20rem',
              // @ts-expect-error -- TSCONVERSION
              lineWrap: 'word',
            }}
          >
            Enable global network proxy. Supports authentication via Basic Auth, digest, or NTLM
          </HelpTooltip>
        </h2>

        <BooleanSetting
          label="Enable proxy"
          setting="proxyEnabled"
        />

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
          <Fragment>
            <hr className="pad-top" />
            <div>
              <div className="pull-right">
                <CheckForUpdatesButton className="btn btn--outlined btn--super-duper-compact">
                  Check Now
                </CheckForUpdatesButton>
              </div>
              <h2>Software Updates</h2>
            </div>
            <BooleanSetting
              label="Automatically download and install updates"
              setting="updateAutomatically"
              help="If disabled, you will receive a notification when a new update is available"
            />
            <div className="form-control form-control--outlined pad-top-sm">
              <label>
                Update Channel
                <select
                  value={settings.updateChannel}
                  name="updateChannel"
                  // @ts-expect-error -- TSCONVERSION
                  onChange={this._handleUpdateSetting}
                >
                  <option value={UPDATE_CHANNEL_STABLE}>Release (Recommended)</option>
                  <option value={UPDATE_CHANNEL_BETA}>Early Access (Beta)</option>
                </select>
              </label>
            </div>
          </Fragment>
        )}

        {!updatesSupported() && (
          <Fragment>
            <hr className="pad-top" />
            <h2>Software Updates</h2>
            <BooleanSetting
              label="Do not notify of new releases"
              setting="disableUpdateNotification"
            />
          </Fragment>
        )}

        <hr className="pad-top" />
        <h2>Plugins</h2>

        {this.renderTextSetting(
          'Additional Plugin Path',
          'pluginPath',
          'Tell Insomnia to look for plugins in a different directory',
          {
            placeholder: '~/.insomnia:/other/path',
          },
        )}

        <br />

        <hr className="pad-top" />
        <h2>Data Sharing</h2>
        <div className="form-control form-control--thin">
          <BooleanSetting
            label="Send Usage Statistics"
            setting="enableAnalytics"
          />
          <p className="txt-sm faint">
            Help Kong improve its products by sending anonymous data about features and plugins
            used, hardware and software configuration, statistics on number of requests,{' '}
            {strings.collection.plural.toLowerCase()}, {strings.document.plural.toLowerCase()}, etc.
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
              <BooleanSetting
                label="Has been prompted to migrate from Insomnia Designer"
                setting="hasPromptedToMigrateFromDesigner"
              />
            </div>
            <div className="form-row pad-top-sm">
              <BooleanSetting
                label="Has seen onboarding experience"
                setting="hasPromptedOnboarding"
              />
            </div>
            <div className="form-row pad-top-sm">
              <BooleanSetting
                label="Has seen analytics prompt"
                setting="hasPromptedAnalytics"
              />
            </div>
          </>
        )}
      </div>
    );
  }
}

function mapDispatchToProps(dispatch) {
  // @ts-expect-error -- TSCONVERSION
  const global = bindActionCreators(globalActions, dispatch);
  return {
    // @ts-expect-error -- TSCONVERSION
    handleSetActiveActivity: global.setActiveActivity,
  };
}

export default connect(null, mapDispatchToProps)(General);
