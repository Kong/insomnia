import React, {PropTypes, PureComponent} from 'react';
import autobind from 'autobind-decorator';
import OneLineEditor from '../../codemirror/one-line-editor';
import * as misc from '../../../../common/misc';

const GRANT_TYPE_CODE = 'code';
const GRANT_TYPE_IMPLICIT = 'implicit';
const GRANT_TYPE_PASSWORD = 'password';
const GRANT_TYPE_CREDENTIALS = 'credentials';

@autobind
class OAuth2 extends PureComponent {
  constructor (props) {
    super(props);
    this._handleChangeProperty = misc.debounce(this._handleChangeProperty, 500);
  }

  _handleChangeProperty (property, value) {
    const {authentication} = this.props;
    const newAuth = Object.assign({}, authentication, {[property]: value});
    this.props.onChange(newAuth);
  }

  _handleChangeClientId (value) {
    this._handleChangeProperty('clientId', value);
  }

  _handleChangeClientSecret (value) {
    this._handleChangeProperty('clientSecret', value);
  }

  _handleChangeAuthorizationUrl (value) {
    this._handleChangeProperty('authorizationUrl', value);
  }

  _handleChangeAccessTokenUrl (value) {
    this._handleChangeProperty('accessTokenUrl', value);
  }

  _handleChangeRedirectUrl (value) {
    this._handleChangeProperty('redirectUrl', value);
  }

  _handleChangeScope (value) {
    this._handleChangeProperty('scope', value);
  }

  _handleChangeState (value) {
    this._handleChangeProperty('state', value);
  }

  _handleChangeGrantType (e) {
    this._handleChangeProperty('grantType', e.target.value);
  }

  renderInputRow (label, property, onChange) {
    const {handleRender, handleGetRenderContext, authentication} = this.props;
    const id = label.replace(/ /g, '-');
    return (
      <tr className="height-md">
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={id} className="label--small no-pad">{label}</label>
        </td>
        <td className="wide">
          <div className="form-control form-control--underlined no-margin">
            <OneLineEditor
              id={id}
              onChange={onChange}
              defaultValue={authentication[property] || ''}
              render={handleRender}
              getRenderContext={handleGetRenderContext}
            />
          </div>
        </td>
      </tr>
    );
  }

  renderSelectRow (label, property, options, onChange) {
    const {authentication} = this.props;
    const id = label.replace(/ /g, '-');
    return (
      <tr className="height-md">
        <td className="pad-right no-wrap valign-middle">
          <label htmlFor={id} className="label--small no-pad">{label}</label>
        </td>
        <td className="wide">
          <div className="form-control form-control--outlined no-margin">
            <select id={id}
                    onChange={onChange}
                    value={authentication[property] || options[0].value}>
              {options.map(({name, value}) => (
                <option key={value} value={value}>
                  {name}
                </option>
              ))}
            </select>
          </div>
        </td>
      </tr>
    );
  }

  render () {
    return (
      <div className="pad-top-sm">
        <table>
          <tbody>
          {this.renderSelectRow('Grant Type', 'grantType', [
            {name: 'Authorization Code', value: GRANT_TYPE_CODE},
            {name: 'Implicit', value: GRANT_TYPE_IMPLICIT},
            {name: 'Resource Owner Password Credentials', value: GRANT_TYPE_PASSWORD},
            {name: 'Client Credentials', value: GRANT_TYPE_CREDENTIALS}
          ], this._handleChangeGrantType)}
          {this.renderInputRow('Client ID', 'clientId', this._handleChangeClientId)}
          {this.renderInputRow('Client Secret', 'clientSecret', this._handleChangeClientSecret)}
          {this.renderInputRow('Authorization URL', 'authorizationUrl', this._handleChangeAuthorizationUrl)}
          {this.renderInputRow('Access Token URL', 'accessTokenUrl', this._handleChangeAccessTokenUrl)}
          {this.renderInputRow('Redirect URL', 'redirectUrl', this._handleChangeRedirectUrl)}
          {this.renderInputRow('Scope', 'scope', this._handleChangeScope)}
          {this.renderInputRow('State', 'state', this._handleChangeState)}
          </tbody>
        </table>
      </div>
    );
  }
}

OAuth2.propTypes = {
  handleRender: PropTypes.func.isRequired,
  handleGetRenderContext: PropTypes.func.isRequired,
  handleUpdateSettingsShowPasswords: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  authentication: PropTypes.object.isRequired,
  showPasswords: PropTypes.bool.isRequired
};

export default OAuth2;
