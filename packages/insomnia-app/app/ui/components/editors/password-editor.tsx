import React, { PureComponent } from 'react';
import classnames from 'classnames';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import Button from '../base/button';
import OneLineEditor from '../codemirror/one-line-editor';
import { AUTOBIND_CFG } from '../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';

interface Props {
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  nunjucksPowerUserMode: boolean;
  onChange: (value: string) => void;
  password: string;
  disabled: boolean;
  isVariableUncovered: boolean;
  showAllPasswords: boolean;
}

interface State {
  showPassword: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class PasswordEditor extends PureComponent<Props, State> {
  state: State = {
    showPassword: false,
  }

  _handleShowPassword() {
    this.setState({
      showPassword: !this.state.showPassword,
    });
  }

  render() {
    const { showPassword } = this.state;
    const {
      password,
      disabled,
      showAllPasswords,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
      onChange,
    } = this.props;
    return (
      <>
        <div
          className={classnames('form-control form-control--underlined no-margin', {
            'form-control--inactive': disabled,
          })}>
          <OneLineEditor
            type={showAllPasswords || showPassword ? 'text' : 'password'}
            id="password"
            onChange={onChange}
            defaultValue={password || ''}
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
            value={showPassword}>
            {showPassword ? <i className="fa fa-eye-slash" /> : <i className="fa fa-eye" />}
          </Button>
        )}
      </>
    );
  }
}

export default PasswordEditor;
