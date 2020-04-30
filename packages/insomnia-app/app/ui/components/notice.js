// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';

const DISMISSED_VALUE = 'dismissed';

type Props = {|
  dismissKey?: string,
  color?: 'surprise' | 'success' | 'warning' | 'info' | 'error' | 'subtle',
  children: React.Node,
  className?: string,
|};

type State = {
  visible: boolean,
  localStorageKey: string | null,
};

@autobind
class Notice extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);

    const { dismissKey } = props;
    const localStorageKey = dismissKey ? 'insomnia::notice::' + dismissKey : null;

    // It's visible if it's not dismissible
    let visible = false;
    if (localStorageKey) {
      visible = window.localStorage.getItem(localStorageKey) !== DISMISSED_VALUE;
    } else {
      visible = true;
    }

    this.state = {
      visible,
      localStorageKey,
    };
  }

  _dismissNotification() {
    const { localStorageKey } = this.state;

    // Hide the currently showing notification
    this.setState({ visible: false });

    window.localStorage.setItem(localStorageKey, DISMISSED_VALUE);
  }

  render() {
    const { children, color, className } = this.props;
    const { visible, localStorageKey } = this.state;

    if (!visible) {
      return null;
    }

    return (
      <p className={classnames('notice', color, className)}>
        {localStorageKey && (
          <button className="icon pull-right" onClick={this._dismissNotification}>
            <i className="fa fa-times" />
          </button>
        )}
        {children}
      </p>
    );
  }
}

export default Notice;
