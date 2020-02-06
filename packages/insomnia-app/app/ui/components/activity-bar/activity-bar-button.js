// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import type { GlobalActivity } from './activity-bar';
import type { HotKeyDefinition, HotKeyRegistry } from '../../../common/hotkeys';
import { getHotKeyDisplay } from '../../../common/hotkeys';
import KeydownBinder from '../keydown-binder';
import { executeHotKey } from '../../../common/hotkeys-listener';

type Props = {|
  activity: {
    key: GlobalActivity,
    name: string,
    hotKey: HotKeyDefinition,
  },
  hotKeyRegistry: HotKeyRegistry,
  activeActivity: GlobalActivity,
  setActivity: GlobalActivity => void,
|};

const ACTIVITY_MAP_ICONS: { [GlobalActivity]: string } = {
  home: 'fa fa-home',
  spec: 'ico-edit-spec',
  debug: 'ico-debug',
};

@autobind
class ActivityBarButton extends React.PureComponent<Props> {
  _handleSetActivity() {
    const { setActivity, activity } = this.props;

    setActivity(activity.key);
  }

  async _handleKeyDown(e: KeyboardEvent) {
    const { activity, setActivity } = this.props;

    await executeHotKey(e, activity.hotKey, () => {
      setActivity(activity.key);
    });
  }

  render() {
    const { activeActivity, activity, hotKeyRegistry } = this.props;

    const classes = {
      'activity-bar__item': true,
      'activity-bar__item--active': activity.key === activeActivity,
    };

    const icon = ACTIVITY_MAP_ICONS[activity.key];

    return (
      <KeydownBinder onKeydown={this._handleKeyDown}>
        <li>
          <button
            className={classnames(classes)}
            title={`${activity.name} (${getHotKeyDisplay(activity.hotKey, hotKeyRegistry, false)})`}
            onClick={this._handleSetActivity}>
            <i className={icon} />
          </button>
        </li>
      </KeydownBinder>
    );
  }
}

export default ActivityBarButton;
