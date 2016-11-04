import React, {PropTypes} from 'react';

const SettingsGeneral = ({settings, updateSetting}) => (
  <div>
    <h2 className="txt-md">
      <label className="label--small">General Settings</label>
    </h2>
    <div>
      <input
        id="setting-show-passwords"
        type="checkbox"
        checked={settings.showPasswords}
        onChange={e => updateSetting('showPasswords', e.target.checked)}
      />
      &nbsp;&nbsp;
      <label htmlFor="setting-show-passwords">
        Show passwords in plain-text
      </label>
    </div>

    <div className="pad-top">
      <input
        id="setting-bulk-header-editor"
        type="checkbox"
        checked={settings.useBulkHeaderEditor}
        onChange={e => updateSetting('useBulkHeaderEditor', e.target.checked)}
      />
      &nbsp;&nbsp;
      <label htmlFor="setting-bulk-header-editor">
        Use bulk header editor by default
      </label>
    </div>

    <div className="pad-top">
      <input
        id="setting-follow-redirects"
        type="checkbox"
        checked={settings.followRedirects}
        onChange={e => updateSetting('followRedirects', e.target.checked)}
      />
      &nbsp;&nbsp;
      <label htmlFor="setting-follow-redirects">
        Follow redirects automatically
      </label>
    </div>

    <div className="pad-top">
      <input
        id="setting-validate-ssl"
        type="checkbox"
        checked={settings.validateSSL}
        onChange={e => updateSetting('validateSSL', e.target.checked)}
      />
      &nbsp;&nbsp;
      <label htmlFor="setting-validate-ssl">
        Validate SSL Certificates
      </label>
    </div>

    <div>
      <label htmlFor="setting-request-timeout" className="pad-top">
        Request Timeout (ms) (0 for no timeout)
      </label>
      <div className="form-control form-control--outlined no-margin">
        <input
          id="setting-request-timeout"
          type="number"
          min={0}
          value={settings.timeout}
          onChange={e => updateSetting('timeout', parseInt(e.target.value, 10))}
        />
      </div>
    </div>

    <br/>
    <h2 className="txt-md pad-top-sm">
      <label className="label--small">Code Editors</label>
    </h2>
    <div>
      <input
        id="setting-editor-line-wrapping"
        type="checkbox"
        checked={settings.editorLineWrapping}
        onChange={e => updateSetting('editorLineWrapping', e.target.checked)}
      />
      &nbsp;&nbsp;
      <label htmlFor="setting-editor-line-wrapping">
        Wrap Long Lines
      </label>
    </div>
    <div>
      <label htmlFor="setting-editor-font-size" className="pad-top">
        Font Size (px)
      </label>
      <div className="form-control form-control--outlined no-margin">
        <input
          id="setting-editor-font-size"
          type="number"
          min={8}
          max={20}
          value={settings.editorFontSize}
          onChange={e => updateSetting('editorFontSize', parseInt(e.target.value, 10))}
        />
      </div>
    </div>

    <br/>
    <h2 className="txt-md pad-top-sm">
      <label className="label--small">Network Proxy (Experimental)</label>
    </h2>
    <div>
      <label htmlFor="setting-http-proxy">
        HTTP Proxy
      </label>
      <div className="form-control form-control--outlined no-margin">
        <input
          id="setting-http-proxy"
          type="string"
          placeholder="localhost:8005"
          defaultValue={settings.httpProxy}
          onChange={e => updateSetting('httpProxy', e.target.value)}
        />
      </div>
    </div>
    <div className="pad-top-sm">
      <label htmlFor="setting-https-proxy">
        HTTPS Proxy
      </label>
      <div className="form-control form-control--outlined no-margin">
        <input
          id="setting-https-proxy"
          placeholder="localhost:8005"
          type="string"
          defaultValue={settings.httpsProxy}
          onChange={e => updateSetting('httpsProxy', e.target.value)}
        />
      </div>
    </div>

    <br/>
    <h2 className="txt-md pad-top-sm">
      <label className="label--small">Other Settings</label>
    </h2>
    <div>
      <input
        id="setting-stacked-layout"
        type="checkbox"
        checked={settings.forceVerticalLayout}
        onChange={e => updateSetting('forceVerticalLayout', e.target.checked)}
      />
      &nbsp;&nbsp;
      <label htmlFor="setting-stacked-layout">
        Force stacked layout
      </label>
    </div>
  </div>
);

SettingsGeneral.propTypes = {
  settings: PropTypes.object.isRequired,
  updateSetting: PropTypes.func.isRequired
};

export default SettingsGeneral;
