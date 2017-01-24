import React, {PropTypes} from 'react';

const SettingsGeneral = ({settings, updateSetting}) => (
  <div>
    <div className="form-control form-control--thin">
      <label>Follow redirects automatically
        <input type="checkbox"
               checked={settings.followRedirects}
               onChange={e => updateSetting('followRedirects', e.target.checked)}/>
      </label>
    </div>

    <div className="form-control form-control--thin">
      <label>Validate SSL Certificates
        <input type="checkbox"
               checked={settings.validateSSL}
               onChange={e => updateSetting('validateSSL', e.target.checked)}/>
      </label>
    </div>

    <div className="form-control form-control--thin">
      <label>Show passwords in plain-text
        <input type="checkbox"
               checked={settings.showPasswords}
               onChange={e => updateSetting('showPasswords', e.target.checked)}/>
      </label>
    </div>

    <div className="form-control form-control--thin">
      <label>Use bulk header editor by default
        <input type="checkbox"
               checked={settings.useBulkHeaderEditor}
               onChange={e => updateSetting('useBulkHeaderEditor', e.target.checked)}/>
      </label>
    </div>

    <div className="form-control form-control--thin">
      <label>Always use vertical layout
        <input type="checkbox"
               checked={settings.forceVerticalLayout}
               onChange={e => updateSetting('forceVerticalLayout', e.target.checked)}/>
      </label>
    </div>

    <div className="form-control form-control--thin">
      <label>Wrap Long Lines
        <input type="checkbox"
               checked={settings.editorLineWrapping}
               onChange={e => updateSetting('editorLineWrapping', e.target.checked)}/>
      </label>
    </div>

    <div className="form-row">
      <div className="form-control form-control--outlined pad-top-sm">
        <label>Text Editor Font Size (px)
          <input type="number"
                 min={8}
                 max={20}
                 defaultValue={settings.editorFontSize}
                 onChange={e => updateSetting('editorFontSize', parseInt(e.target.value, 10))}/>
        </label>
      </div>

      <div className="form-control form-control--outlined pad-top-sm">
        <label>
          Text Editor Key Map
          <select defaultValue={settings.editorKeyMap}
                  onChange={e => updateSetting('editorKeyMap', e.target.value)}>
            <option value="default">Default</option>
            <option value="vim">Vim</option>
            <option value="emacs">Emacs</option>
            <option value="sublime">Sublime</option>
          </select>
        </label>
      </div>
    </div>

    <div className="form-control form-control--outlined">
      <label>Request Timeout (ms) (0 for no timeout)
        <input type="number"
               min={0}
               defaultValue={settings.timeout}
               onChange={e => updateSetting('timeout', parseInt(e.target.value, 10))}/>
      </label>
    </div>
    <div className="form-row">
      <div className="form-control form-control--outlined">
        <label>HTTP Proxy
          <input type="text"
                 placeholder="localhost:8005"
                 defaultValue={settings.httpProxy}
                 onChange={e => updateSetting('httpProxy', e.target.value)}/>
        </label>
      </div>
      <div className="form-control form-control--outlined">
        <label>HTTPS Proxy
          <input placeholder="localhost:8005"
                 type="text"
                 defaultValue={settings.httpsProxy}
                 onChange={e => updateSetting('httpsProxy', e.target.value)}/>
        </label>
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
