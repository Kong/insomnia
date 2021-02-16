// @flow
import * as React from 'react';
import classnames from 'classnames';
import autobind from 'autobind-decorator';
import Button from '../base/button';
import OneLineEditor from '../codemirror/one-line-editor';
import type { Request } from '../../../../models/request';

type State = {
  showPassword: boolean,
};

type Props = {
  render: Function,
  getRenderContext: Function,
  nunjucksPowerUserMode: boolean,
  onChange: Function,
  request: Request,
  isVariableUncovered: boolean,
  showAllPasswords: boolean,
};

@autobind
class PasswordEditor extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      showPassword: false,
    };
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
      onChange,
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
            onChange={onChange}
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

export default PasswordEditor;
