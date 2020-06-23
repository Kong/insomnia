// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import ActivityBarButton from './activity-bar-button';
import { getHotKeyDisplay, hotKeyRefs } from '../../../common/hotkeys';
import type { HotKeyDefinition, HotKeyRegistry } from '../../../common/hotkeys';

export type GlobalActivity = 'spec' | 'debug' | 'monitor' | 'home';

export const ACTIVITY_DEBUG: GlobalActivity = 'debug';
export const ACTIVITY_HOME: GlobalActivity = 'home';
export const ACTIVITY_INSOMNIA: GlobalActivity = 'insomnia';
export const ACTIVITY_SPEC: GlobalActivity = 'spec';
export const ACTIVITY_UNIT_TEST: GlobalActivity = 'unittest';

type Props = {|
  activity: GlobalActivity,
  setActivity: GlobalActivity => void,
  showSettings: () => void,
  hotKeyRegistry: HotKeyRegistry,
|};

const ACTIVITIES: Array<{ key: GlobalActivity, name: string, hotKey: HotKeyDefinition }> = [
  {
    key: ACTIVITY_HOME,
    name: 'Home',
    hotKey: hotKeyRefs.SHOW_HOME,
  },
  {
    key: ACTIVITY_SPEC,
    name: 'API Specification',
    hotKey: hotKeyRefs.SHOW_SPEC_EDITOR,
  },
  {
    key: ACTIVITY_DEBUG,
    name: 'Debug API',
    hotKey: hotKeyRefs.SHOW_TEST,
  },
];

@autobind
class ActivityBar extends React.PureComponent<Props> {
  render() {
    const { activity, showSettings, setActivity, hotKeyRegistry } = this.props;
    return (
      <ul className="activity-bar theme--activity-bar">
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
            <i className="ico-preferences" />
          </button>
        </li>
      </ul>
    );
  }
}

export default ActivityBar;
