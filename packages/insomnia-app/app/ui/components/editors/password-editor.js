// @flow
import * as React from 'react';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import autobind from 'autobind-decorator';
import Button from '../base/button';
import OneLineEditor from '../codemirror/one-line-editor';

@autobind
class PasswordEditor extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {
      showPassword: false,
    };
  }

  _handleChangePassword(value) {
    const { request, onChange } = this.props;
    onChange(request, { ...request.authentication, password: value });
  }

  _handleShowPassword() {
    this.setState({ showPassword: !this.state.showPassword });
  }

  render() {
    const { showPassword } = this.state;
    const {
      request,
      showAllPasswords,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
    } = this.props;

    const { authentication } = request;
    return (
      <>
        <div
          className={classnames('form-control form-control--underlined no-margin', {
            'form-control--inactive': authentication.disabled,
          })}>
          <OneLineEditor
            type={showAllPasswords || showPassword ? 'text' : 'password'}
            id="password"
            testId="password"
            onChange={this._handleChangePassword}
            defaultValue={authentication.password || ''}
            nunjucksPowerUserMode={nunjucksPowerUserMode}
            render={handleRender}
            getRenderContext={handleGetRenderContext}
            isVariableUncovered={isVariableUncovered}
          />
        </div>
        {!showAllPasswords && (
          <Button
            className="btn btn--super-duper-compact pointer"
            onClick={this._handleShowPassword}
            value={showPassword}
            testId="password-reveal">
            {showPassword ? <i className="fa fa-eye-slash" /> : <i className="fa fa-eye" />}
          </Button>
        )}
      </>
    );
  }
}
PasswordEditor.propTypes = {
  request: PropTypes.shape({
    authentication: PropTypes.shape({
      password: PropTypes.string,
    }).isRequired,
  }).isRequired,
  render: PropTypes.func.isRequired,
  onChange: PropTypes.func.isRequired,
  getRenderContext: PropTypes.func.isRequired,
  nunjucksPowerUserMode: PropTypes.bool.isRequired,
  showAllPasswords: PropTypes.bool.isRequired,
  isVariableUncovered: PropTypes.bool.isRequired,
};

export default PasswordEditor;
