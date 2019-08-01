// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import ActivityBarButton from './activity-bar-button';

export type GlobalActivity = 'spec' | 'test';

type Props = {|
  activity: GlobalActivity,
  setActivity: (GlobalActivity) => void,
  showSettings: () => void,
|};

const ACTIVITIES = [ 'spec', 'test' ];

@autobind
class ActivityBar extends React.PureComponent<Props> {
  render() {
    const { activity, showSettings, setActivity } = this.props;
    return (
      <ul className="activity-bar theme--sidebar">
        {ACTIVITIES.map(a => (
          <ActivityBarButton
            key={a}
            activity={a}
            activeActivity={activity}
            setActivity={setActivity}
          />
        ))}
        <span className="activity-bar__spacer"/>
        <li>
          <button onClick={showSettings} className="activity-bar__item activity-bar__item--bottom">
            <i className="fa fa-cog"/>
          </button>
        </li>
      </ul>
    );
  }
}

export default ActivityBar;
