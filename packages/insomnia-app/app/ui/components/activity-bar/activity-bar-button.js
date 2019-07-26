// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import type { GlobalActivity } from './activity-bar';

type Props = {|
  activity: GlobalActivity,
  activeActivity: GlobalActivity,
  setActivity: (GlobalActivity) => void,
|};

const ACTIVITY_MAP_ICONS: {[GlobalActivity]: string} = {
  spec: 'fa-code',
  test: 'fa-cloud',
};

@autobind
class ActivityBarButton extends React.PureComponent<Props> {
  handleSetActivity() {
    const { setActivity, activity } = this.props;

    setActivity(activity);
  }

  render() {
    const { activeActivity, activity } = this.props;

    const classes = {
      'activity-bar__item': true,
      'activity-bar__item--active': activity === activeActivity,
    };

    const icon = ACTIVITY_MAP_ICONS[activity];

    return (
      <li>
        <button className={classnames(classes)} onClick={this.handleSetActivity}>
          <i className={classnames('fa', icon)}/>
        </button>
      </li>
    );
  }
}

export default ActivityBarButton;
