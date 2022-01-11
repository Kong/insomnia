import { EnvironmentHighlightColorStyle, HttpVersion, HttpVersions, UpdateChannel } from 'insomnia-common';
import { Tooltip } from 'insomnia-components';
import React, { FC, Fragment, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { trackEvent } from '../../../common/analytics';
import {
  ACTIVITY_MIGRATION,
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
import { setActiveActivity } from '../../redux/modules/global';
import { selectSettings, selectStats } from '../../redux/selectors';
import { Link } from '../base/link';
import { CheckForUpdatesButton } from '../check-for-updates-button';
import { HelpTooltip } from '../help-tooltip';
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

  const onChangeLaunches = useCallback(async event => {
    const launches = parseInt(event.target.value, 10);
    await models.stats.update({ launches });
  }, []);

  if (!isDevelopment()) {
    return null;
  }

  return (
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
              onChange={onChangeLaunches}
              type={'number'}
            />
          </label>
        </div>
      </div>
    </>
  );
};

interface Props {
  hideModal: () => void;
}

export const General: FC<Props> = ({ hideModal }) => {
  const dispatch = useDispatch();
  const settings = useSelector(selectSettings);

  const handleStartMigration = useCallback(() => {
    trackEvent('Data', 'Migration', 'Manual');
    dispatch(setActiveActivity(ACTIVITY_MIGRATION));
    hideModal();
  }, [hideModal, dispatch]);

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
          label="Environment Highlight Style"
          help="Configures the appearance of environment's color indicator"
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
          label="Autocomplete popup delay"
          setting="autocompleteDelay"
          help="Configure the autocomplete popup delay in milliseconds (0 to disable)"
          min={0}
          max={3000}
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
            label="Interface Font"
            setting="fontInterface"
            help="Comma-separated list of fonts. If left empty, takes system defaults."
            placeholder="-- System Default --"
          />
          <NumberSetting
            label="Interface Font Size (px)"
            setting="fontSize"
            min={MIN_INTERFACE_FONT_SIZE}
            max={MAX_INTERFACE_FONT_SIZE}
          />
        </div>
      </div>

      <div className="form-row">
        <TextSetting
          label="Text Editor Font"
          setting="fontMonospace"
          help="Comma-separated list of monospace fonts. If left empty, takes system defaults."
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
          help="Preferred HTTP version to use for requests which will fall back if it cannot be negotiated"
        />
      </div>

      <div className="form-row pad-top-sm">
        <NumberSetting
          label="Maximum Redirects"
          setting="maxRedirects"
          help="-1 for infinity"
          min={-1}
        />
        <NumberSetting
          label="Request Timeout"
          setting="timeout"
          help="-1 for infinity"
          min={-1}
        />
      </div>

      <div className="form-row pad-top-sm">
        <NumberSetting
          label="Response History Limit"
          setting="maxHistoryResponses"
          help="Number of responses to keep for each request (-1 for infinity)"
          min={-1}
        />
        <NumberSetting
          label="Max Timeline Chunk Size (KB)"
          setting="maxTimelineDataSizeKB"
          help="Maximum size in kilobytes to show on timeline"
          min={0}
        />
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
        <MaskedSetting
          label='HTTP Proxy'
          setting='httpProxy'
          placeholder="localhost:8005"
          disabled={!settings.proxyEnabled}
        />
        <MaskedSetting
          label='HTTPS Proxy'
          setting='httpsProxy'
          placeholder="localhost:8005"
          disabled={!settings.proxyEnabled}
        />
        <TextSetting
          label="No Proxy"
          setting="noProxy"
          help="Comma-separated list of hostnames that do not require a proxy to be contacted"
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

          <div className="for-row pad-top-sm">
            <EnumSetting<UpdateChannel>
              label="Update Channel"
              setting="updateChannel"
              values={[
                { value: UpdateChannel.stable, name: 'Release (Recommended)' },
                { value: UpdateChannel.beta, name: 'Early Access (Beta)' },
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
      />

      <hr className="pad-top" />
      <h2>Plugins</h2>
      <TextSetting
        label="Additional Plugin Path"
        setting="pluginPath"
        help="Tell Insomnia to look for plugins in a different directory"
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

      <hr className="pad-top" />

      <h2>Migrate from Designer</h2>
      <div className="form-row--start pad-top-sm">
        <button className="btn btn--clicky pointer" onClick={handleStartMigration}>
          Show migration workflow
        </button>
      </div>

      <DevelopmentOnlySettings />
    </div>
  );
};
