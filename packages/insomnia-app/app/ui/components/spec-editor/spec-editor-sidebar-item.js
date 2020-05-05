// @flow
import * as React from 'react';
import classnames from 'classnames';
import autobind from 'autobind-decorator';

type Props = {|
  name: string,
  onClick: (SyntheticEvent<HTMLButtonElement>) => void,
  children?: React.Node,
|};

type State = {|
  open: boolean,
|};

@autobind
class SpecEditorSidebarItem extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      open: false,
    };
  }

  _handleExpand(e: SyntheticEvent<HTMLButtonElement>) {
    this.setState(state => ({ open: !state.open }));
  }

  render() {
    const { name, onClick, children } = this.props;
    const { open } = this.state;
    return (
      <li>
        <button onClick={this._handleExpand}>
          {children ? (
            <i className={classnames('fa', open ? 'fa-caret-down' : 'fa-caret-right')} />
          ) : (
            <i className="fa fa-empty" />
          )}
        </button>
        <button onClick={onClick}>{name}</button>
        {open ? children : null}
      </li>
    );
  }
}

export default SpecEditorSidebarItem;
