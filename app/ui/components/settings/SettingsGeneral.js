import React, {PropTypes} from 'react';

const SettingsGeneral = ({settings, updateSetting}) => (
  <div>
    <div>
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

    <div>
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

    <div>
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

    <div>
      <input
        id="setting-stacked-layout"
        type="checkbox"
        checked={settings.forceVerticalLayout}
        onChange={e => updateSetting('forceVerticalLayout', e.target.checked)}
      />
      &nbsp;&nbsp;
      <label htmlFor="setting-stacked-layout">
        Always use vertical layout
      </label>
    </div>

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

    <div className="form-control form-control--outlined">
      <label>Request/Response Font Size (px)
        <input
          type="number"
          min={8}
          max={20}
          value={settings.editorFontSize}
          onChange={e => updateSetting('editorFontSize', parseInt(e.target.value, 10))}
        />
      </label>
    </div>

    <div className="form-control form-control--outlined">
      <label>Request Timeout (ms) (0 for no timeout)
        <input
          type="number"
          min={0}
          value={settings.timeout}
          onChange={e => updateSetting('timeout', parseInt(e.target.value, 10))}
        />
      </label>
      <div className="inline-block" style={{width: '50%'}}>
        <div className="form-control form-control--outlined">
          <label>HTTP Proxy
            <input
              type="text"
              placeholder="localhost:8005"
              defaultValue={settings.httpProxy}
              onChange={e => updateSetting('httpProxy', e.target.value)}
            />
          </label>
        </div>
      </div>
      <div className="inline-block" style={{width: '50%'}}>
        <div className="pad-left-sm">
          <div className="form-control form-control--outlined">
            <label>HTTPS Proxy
              <input
                placeholder="localhost:8005"
                type="text"
                defaultValue={settings.httpsProxy}
                onChange={e => updateSetting('httpsProxy', e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>
    </div>
    <br/>
  </div>
);

SettingsGeneral.propTypes = {
  settings: PropTypes.object.isRequired,
  updateSetting: PropTypes.func.isRequired
};

export default SettingsGeneral;
