// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import ActivityBarButton from './activity-bar-button';
import { getHotKeyDisplay, hotKeyRefs } from '../../../common/hotkeys';
import type { HotKeyDefinition, HotKeyRegistry } from '../../../common/hotkeys';

export type GlobalActivity = 'spec' | 'test';

type Props = {|
  activity: GlobalActivity,
  setActivity: GlobalActivity => void,
  showSettings: () => void,
  hotKeyRegistry: HotKeyRegistry,
|};

const ACTIVITIES: Array<{ key: GlobalActivity, name: string, hotKey: HotKeyDefinition }> = [
  {
    key: 'spec',
    name: 'API Specification',
    hotKey: hotKeyRefs.SHOW_SPEC_EDITOR,
  },
  {
    key: 'test',
    name: 'Try API',
    hotKey: hotKeyRefs.SHOW_TEST,
  },
];

@autobind
class ActivityBar extends React.PureComponent<Props> {
  render() {
    const { activity, showSettings, setActivity, hotKeyRegistry } = this.props;
    return (
      <ul className="activity-bar theme--sidebar">
        {ACTIVITIES.map(a => (
          <ActivityBarButton
            key={a.key}
            activity={a}
            activeActivity={activity}
            setActivity={setActivity}
            hotKeyRegistry={hotKeyRegistry}
          />
        ))}
        <span className="activity-bar__spacer" />
        <li>
          <button
            onClick={showSettings}
            className="activity-bar__item activity-bar__item--bottom"
            title={`Settings (${getHotKeyDisplay(
              hotKeyRefs.PREFERENCES_SHOW_GENERAL,
              hotKeyRegistry,
              false,
            )})`}>
            <i className="fa fa-cog" />
          </button>
        </li>
      </ul>
    );
  }
}

export default ActivityBar;
