// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';

type Props = {
  //
};

type State = {
  //
};

@autobind
class ActivityBar extends React.PureComponent<Props, State> {
  render() {
    return (
      <nav className="activity-bar">
        <ul>
          <li>Insomnia</li>
          <li>Studio</li>
        </ul>
      </nav>
    );
  }
}

export default ActivityBar;
