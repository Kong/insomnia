import { EnvironmentHighlightColorStyle, HttpVersion, HttpVersions, UpdateChannel } from 'insomnia-common';
import React, { FC, Fragment } from 'react';
import { useSelector } from 'react-redux';

import {
  EditorKeyMap,
  isDevelopment,
  isMac,
  MAX_EDITOR_FONT_SIZE,
  MAX_INTERFACE_FONT_SIZE,
  MIN_EDITOR_FONT_SIZE,
  MIN_INTERFACE_FONT_SIZE,
  updatesSupported,
} from '../../../common/constants';
import { docsKeyMaps } from '../../../common/documentation';
import { strings } from '../../../common/strings';
import * as models from '../../../models';
import { initNewOAuthSession } from '../../../network/o-auth-2/misc';
import { selectSettings, selectStats } from '../../redux/selectors';
import { Link } from '../base/link';
import { CheckForUpdatesButton } from '../check-for-updates-button';
import { HelpTooltip } from '../help-tooltip';
import { Tooltip } from '../tooltip';
import { BooleanSetting } from './boolean-setting';
import { EnumSetting } from './enum-setting';
import { MaskedSetting } from './masked-setting';
import { NumberSetting } from './number-setting';
import { TextSetting } from './text-setting';

/**
 * We are attempting to move the app away from needing settings changes to restart the app.
 * For now, this component is a holdover until such a time as we are able to fix the underlying cases. (INS-1245)
 */
const RestartTooltip: FC<{ message: string }> = ({ message }) => (
  <Fragment>
    {message}{' '}
    <Tooltip message="Will restart the app" className="space-left">
      <i className="fa fa-refresh super-duper-faint" />
    </Tooltip>
  </Fragment>
);

const DevelopmentOnlySettings: FC = () => {
  const { launches } = useSelector(selectStats);

  if (!isDevelopment()) {
    return null;
  }

  return (
    <>
      <hr className="pad-top" />
      <h2>Development</h2>

      <div className="form-row pad-top-sm">
        <BooleanSetting
          label="Has seen analytics prompt"
          setting="hasPromptedAnalytics"
        />
      </div>

      <div className="form-row pad-top-sm">
        <div className="form-control form-control--outlined">
          <label>
            Stats.Launches
            <HelpTooltip className="space-left">If you need this to be a certain value after restarting the app, then just subtract one from your desired value before you restart.  For example, if you want to simulate first launch, set it to 0 and when you reboot it will be 1.  Note that Shift+F5 does not actually restart since it only refreshes the renderer and thus will not increment `Stats.launches`.  This is because Stats.launches is incremented in the main process whereas refreshing the app with Shift+F5 doesn't retrigger that code path.</HelpTooltip>
            <input
              value={String(launches)}
              min={0}
              name="launches"
              onChange={async event => {
                const launches = parseInt(event.target.value, 10);
                await models.stats.update({ launches });
              }}
              type={'number'}
            />
          </label>
        </div>
      </div>
    </>
  );
};

export const General: FC = () => {
  const settings = useSelector(selectSettings);
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
            help="If checked, stack request and response panels vertically."
          />
          <BooleanSetting
            label={<RestartTooltip message="Show variable source and value" />}
            help="If checked, reveals the environment variable source and value in the template tag. Otherwise, hover over the template tag to see the source and value."
            setting="showVariableSourceAndValue"
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
            label={<RestartTooltip message="Raw template syntax" />}
            setting="nunjucksPowerUserMode"
          />
        </div>
      </div>

      <div className="row-fill row-fill--top pad-top-sm">
        <EnumSetting<EnvironmentHighlightColorStyle>
          label="Environment highlight style"
          help="Select the sub-environment highlight area. Configure the highlight color itself in your environment settings."
          setting="environmentHighlightColorStyle"
          values={[
            { value:'sidebar-indicator', name: 'Sidebar indicator' },
            { value:'sidebar-edge', name: 'Sidebar edge' },
            { value:'window-top', name: 'Window top' },
            { value:'window-bottom', name: 'Window bottom' },
            { value:'window-left', name: 'Window left' },
            { value:'window-right', name: 'Window right' },
          ]}
        />

        <NumberSetting
          label="Autocomplete popup delay (ms)"
          setting="autocompleteDelay"
          help="Delay the autocomplete popup by milliseconds. Enter 0 to disable the autocomplete delay."
          min={0}
          max={3000}
          step={100}
        />
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
        <div>
          <BooleanSetting
            label="Font ligatures"
            setting="fontVariantLigatures"
          />
        </div>
      </div>

      <div className="form-row pad-top-sm">
        <div className="form-row">
          <TextSetting
            label="Interface font"
            setting="fontInterface"
            help="Enter a comma-separated list of fonts. If left empty, uses system defaults."
            placeholder="-- System Default --"
          />
          <NumberSetting
            label="Interface font size (px)"
            setting="fontSize"
            min={MIN_INTERFACE_FONT_SIZE}
            max={MAX_INTERFACE_FONT_SIZE}
          />
        </div>
      </div>

      <div className="form-row">
        <TextSetting
          label="Text editor font"
          setting="fontMonospace"
          help="Enter a comma-separated list of monospace fonts. If left empty, uses system defaults."
          placeholder="-- System Default --"
        />
        <NumberSetting
          label="Editor Font Size (px)"
          setting="editorFontSize"
          min={MIN_EDITOR_FONT_SIZE}
          max={MAX_EDITOR_FONT_SIZE}
        />
      </div>

      <div className="form-row">
        <NumberSetting
          label="Editor Indent Size"
          setting="editorIndentSize"
          help=""
          min={1}
          max={16}
        />

        <EnumSetting<EditorKeyMap>
          label="Text Editor Key Map"
          setting="editorKeyMap"
          help={isMac() && settings.editorKeyMap === EditorKeyMap.vim && (
            <Fragment>
              To enable key-repeating with Vim on macOS, see <Link href={docsKeyMaps}>
                documentation <i className="fa fa-external-link-square" /></Link>
            </Fragment>
          )}
          values={[
            { value: EditorKeyMap.default, name: 'Default' },
            { value: EditorKeyMap.vim, name: 'Vim' },
            { value: EditorKeyMap.emacs, name: 'Emacs' },
            { value: EditorKeyMap.sublime, name: 'Sublime' },
          ]}
        />
      </div>

      <hr className="pad-top" />

      <h2>Request / Response</h2>

      <div className="row-fill row-fill--top">
        <div>
          <BooleanSetting
            label="Validate certificates"
            setting="validateSSL"
            help="If checked, validate SSL certificates for API requests. This does not affect SSL certificate validation during authentication."
          />
          <BooleanSetting
            label="Follow redirects"
            setting="followRedirects"
          />
          <BooleanSetting
            label="Filter responses by environment"
            setting="filterResponsesByEnv"
            help="If checked, only show responses sent under the active environment. "
          />
        </div>
        <div>
          <BooleanSetting
            label="Disable JS in HTML preview"
            setting="disableHtmlPreviewJs"
          />
          <BooleanSetting
            label="Disable links in response viewer"
            setting="disableResponsePreviewLinks"
          />
        </div>
      </div>

      <div className="form-row pad-top-sm">
        <EnumSetting<HttpVersion>
          label="Preferred HTTP version"
          setting="preferredHttpVersion"
          values={[
            { value: HttpVersions.default, name: 'Default' },
            { value: HttpVersions.V1_0, name: 'HTTP 1.0' },
            { value: HttpVersions.V1_1, name: 'HTTP 1.1' },
            { value: HttpVersions.V2PriorKnowledge, name: 'HTTP/2 PriorKnowledge' },
            { value: HttpVersions.V2_0, name: 'HTTP/2' },
            // Enable when our version of libcurl supports HTTP/3
            // see: https://github.com/JCMais/node-libcurl/issues/233
            // { value: HttpVersions.v3, name: 'HTTP/3' },
          ]}
          help="Select the preferred HTTP version for requests. The version will fall back if it can’t be negotiated."
        />
      </div>

      <div className="form-row pad-top-sm">
        <NumberSetting
          label="Maximum Redirects"
          setting="maxRedirects"
          help="Enter the maximum amount of redirects to follow. Enter -1 for unlimited redirects."
          min={-1}
        />
        <NumberSetting
          label="Request timeout (ms)"
          setting="timeout"
          help="Enter the maximum milliseconds allotted before a request will timeout. Enter 0 to disable timeouts. "
          min={0}
          step={100}
        />
      </div>

      <div className="form-row pad-top-sm">
        <NumberSetting
          label="Response history limit"
          setting="maxHistoryResponses"
          help="Enter the number of responses to keep for each request. Enter -1 to keep all response history."
          min={-1}
        />
        <NumberSetting
          label="Max timeline chunk size (KiB)"
          setting="maxTimelineDataSizeKB"
          help="Enter the maximum size in kibibytes to show on the response timeline. Decrease the number for less detailed responses."
          min={0}
        />
      </div>

      <hr className="pad-top" />

      <h2>Security</h2>
      <div className="form-row pad-top-sm">
        <BooleanSetting
          label="Clear OAuth 2 session on start"
          setting="clearOAuth2SessionOnRestart"
          help="If checked, clears the OAuth session every time Insomnia is relaunched."
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
          help="If checked, validates SSL certificates during authentication flows."
        />
      </div>

      <hr className="pad-top" />

      <h2>HTTP Network Proxy</h2>

      <BooleanSetting
        label="Enable proxy"
        setting="proxyEnabled"
        help="If checked, enables a global network proxy on all requests sent through Insomnia. This proxy supports Basic Auth, digest, and NTLM authentication."
      />

      <div className="form-row pad-top-sm">
        <MaskedSetting
          label='HTTP proxy'
          setting='httpProxy'
          placeholder="localhost:8005"
          disabled={!settings.proxyEnabled}
        />
        <MaskedSetting
          label='HTTPS proxy'
          setting='httpsProxy'
          placeholder="localhost:8005"
          disabled={!settings.proxyEnabled}
        />
        <TextSetting
          label="No proxy"
          setting="noProxy"
          help="Enter a comma-separated list of hostnames that don’t require a proxy."
          placeholder="localhost,127.0.0.1"
          disabled={!settings.proxyEnabled}
        />
      </div>

      {updatesSupported() && (
        <Fragment>
          <hr className="pad-top" />
          <div>
            <div className="pull-right">
              <CheckForUpdatesButton className="btn btn--outlined btn--super-duper-compact">
                Check now
              </CheckForUpdatesButton>
            </div>
            <h2>Software Updates</h2>
          </div>
          <BooleanSetting
            label="Automatically download and install updates"
            setting="updateAutomatically"
            help="If disabled, receive a notification in-app when a new update is available."
          />

          <div className="for-row pad-top-sm">
            <EnumSetting<UpdateChannel>
              label="Update channel"
              setting="updateChannel"
              values={[
                { value: UpdateChannel.stable, name: 'Release (recommended)' },
                { value: UpdateChannel.beta, name: 'Early access (beta)' },
              ]}
            />
          </div>
        </Fragment>
      )}

      <hr className="pad-top" />
      <h2>Notifications</h2>
      {!updatesSupported() && (
        <BooleanSetting
          label="Do not notify of new releases"
          setting="disableUpdateNotification"
        />
      )}
      <BooleanSetting
        label="Do not tell me about premium features"
        setting="disablePaidFeatureAds"
        help="If checked, mute in-app notifications and other messaging about premium features."
      />

      <hr className="pad-top" />
      <h2>Plugins</h2>
      <TextSetting
        label="Additional Plugin Path"
        setting="pluginPath"
        help="Add a custom path to direct Insomnia to a different plugin directory."
        placeholder="~/.insomnia:/other/path"
      />

      <hr className="pad-top" />
      <h2>Network Activity</h2>
      <BooleanSetting
        descriptions={[
          'In incognito mode, Insomnia will not make any network requests other than the requests you ask it to send.  You\'ll still be able to log in and manually sync collections, but any background network requests that are not the direct result of your actions will be disabled.',
          'Note that, similar to incognito mode in Chrome, Insomnia cannot control the network behavior of any plugins you have installed.',
        ]}
        label="Incognito Mode"
        setting="incognitoMode"
      />

      <BooleanSetting
        descriptions={[
          `Help Kong improve its products by sending anonymous data about features and plugins used, hardware and software configuration, statistics on number of requests, ${strings.collection.plural.toLowerCase()}, ${strings.document.plural.toLowerCase()}, etc.`,
          'Please note that this will not include personal data or any sensitive information, such as request data, names, etc.',
        ]}
        label="Send Usage Statistics"
        setting="enableAnalytics"
      />

      <BooleanSetting
        descriptions={['Insomnia periodically makes background requests to api.insomnia.rest/notifications for things like email verification, out-of-date billing information, trial information.']}
        label="Allow Notification Requests"
        setting="allowNotificationRequests"
      />

      <DevelopmentOnlySettings />
    </div>
  );
};
