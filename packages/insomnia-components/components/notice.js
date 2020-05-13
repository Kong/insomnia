// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import SvgIcon from './svg-icon';
import styled from 'styled-components';

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

const StyledNotice: React.ComponentType<{}> = styled.p`
  text-align: center;
  color: var(--color-font) !important;
  padding: calc(var(--padding-sm) * 1.5);
  margin-bottom: var(--padding-md);
  border: 1px dotted var(--hl);
  border-radius: var(--radius-md);
  position: relative;
  z-index: 0;
  overflow: auto;

  .pre {
    line-height: 1.3em;
    white-space: pre;
  }

  p {
    min-width: 8rem;
    padding: 0;
    margin: 0;
  }

  a {
    text-decoration: underline;
    color: var(--color-font);
    opacity: var(--opacity-subtle);
  }

  a:hover {
    opacity: 1;
  }

  &::before {
    content: ' ';
    position: absolute;
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    z-index: -1;
    opacity: 0.05;
  }

  &.error {
    border-color: var(--color-danger);

    &::before {
      background-color: var(--color-danger);
    }
  }
  
  &.warning {
    border-color: var(--color-warning);

    &::before {
      background-color: var(--color-warning);
    }
  }

  &.success {
    border-color: var(--color-success);

    &::before {
      background-color: var(--color-success);
    }
  }

  &.info {
    border-color: var(--color-info);

    &::before {
      background-color: var(--color-info);
    }
  }

  &.subtle {
    border-color: var(--hl-lg);

    &::before {
      opacity: 1;
      background-color: var(--hl-xxs);
    }
  }

  &.surprise {
    border-color: var(--color-surprise);

    &::before {
      background-color: var(--color-surprise);
    }
  }
`;

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
      <StyledNotice className={classnames('notice', color, className)}>
        {localStorageKey && (
          <button className="icon pull-right" onClick={this._dismissNotification}>
            <SvgIcon icon='x' />
          </button>
        )}
        {children}
      </StyledNotice>
    );
  }
}

export default Notice;
