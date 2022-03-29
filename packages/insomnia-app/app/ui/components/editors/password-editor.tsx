import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { Button } from '../base/button';
import { OneLineEditor } from '../codemirror/one-line-editor';

interface Props {
  onChange: (...args: any[]) => any;
  password: string;
  disabled: boolean;
  showAllPasswords: boolean;
}

interface State {
  showPassword: boolean;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class PasswordEditor extends PureComponent<Props, State> {
  state: State = {
    showPassword: false,
  };

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
      onChange,
    } = this.props;
    return (
      <>
        <div
          className={classnames('form-control form-control--underlined no-margin', {
            'form-control--inactive': disabled,
          })}
        >
          <OneLineEditor
            type={showAllPasswords || showPassword ? 'text' : 'password'}
            id="password"
            onChange={onChange}
            defaultValue={password || ''}
          />
        </div>
        {!showAllPasswords && (
          <Button
            className="btn btn--super-duper-compact pointer"
            onClick={this._handleShowPassword}
            value={showPassword}
          >
            {showPassword ? <i className="fa fa-eye-slash" /> : <i className="fa fa-eye" />}
          </Button>
        )}
      </>
    );
  }
}
