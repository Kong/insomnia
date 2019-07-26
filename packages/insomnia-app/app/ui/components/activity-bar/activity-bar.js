// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import ActivityBarButton from './activity-bar-button';

export type GlobalActivity = 'spec' | 'test';

type Props = {|
  activity: GlobalActivity,
  setActivity: (GlobalActivity) => void,
|};

const ACTIVITIES = [ 'spec', 'test' ];

@autobind
class ActivityBar extends React.PureComponent<Props> {
  render() {
    const { activity, setActivity } = this.props;
    return (
      <nav className="activity-bar theme--sidebar">
        <ul>
          {ACTIVITIES.map(a => (
            <ActivityBarButton
              key={a}
              activity={a}
              activeActivity={activity}
              setActivity={setActivity}
            />
          ))}
        </ul>
      </nav>
    );
  }
}

export default ActivityBar;
