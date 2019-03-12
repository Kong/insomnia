// @flow
import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Hotkey from '../hotkey';
import type { HotKeyDefinition, HotKeyRegistry } from '../../../common/hotkeys';
import { hotKeyRefs } from '../../../common/hotkeys';

type Props = {
  hotKeyRegistry: HotKeyRegistry,
};

@autobind
class Shortcuts extends PureComponent<Props> {
  renderHotKey(def: HotKeyDefinition, i: number) {
    return (
      <tr key={i}>
        <td>{def.description}</td>
        <td className="text-right">
          <code>
            <Hotkey keyBindings={this.props.hotKeyRegistry[def.id]} />
          </code>
        </td>
      </tr>
    );
  }

  render() {
    const hotKeyDefs: Array<HotKeyDefinition> = [
      hotKeyRefs.PREFERENCES_SHOW_KEYBOARD_SHORTCUTS,
      hotKeyRefs.REQUEST_QUICK_SWITCH,
      hotKeyRefs.REQUEST_SEND,
      hotKeyRefs.REQUEST_SHOW_OPTIONS,
      hotKeyRefs.REQUEST_SHOW_CREATE,
      hotKeyRefs.REQUEST_SHOW_DELETE,
      hotKeyRefs.REQUEST_SHOW_CREATE_FOLDER,
      hotKeyRefs.REQUEST_SHOW_DUPLICATE,
      hotKeyRefs.SHOW_COOKIES_EDITOR,
      hotKeyRefs.ENVIRONMENT_SHOW_EDITOR,
      hotKeyRefs.ENVIRONMENT_SHOW_SWITCH_MENU,
      hotKeyRefs.REQUEST_FOCUS_URL,
      hotKeyRefs.RESPONSE_FOCUS,
      hotKeyRefs.REQUEST_TOGGLE_HTTP_METHOD_MENU,
      hotKeyRefs.SIDEBAR_TOGGLE,
      hotKeyRefs.REQUEST_TOGGLE_HISTORY,
      hotKeyRefs.SHOW_AUTOCOMPLETE,
      hotKeyRefs.PREFERENCES_SHOW_GENERAL,
      hotKeyRefs.WORKSPACE_SHOW_SETTINGS,
      hotKeyRefs.REQUEST_SHOW_SETTINGS,
      hotKeyRefs.TOGGLE_MAIN_MENU,
      hotKeyRefs.PLUGIN_RELOAD,
      hotKeyRefs.ENVIRONMENT_UNCOVER_VARIABLES,
    ];
    return (
      <div>
        <table className="table--fancy">
          <tbody>
            {hotKeyDefs.map((def: HotKeyDefinition, idx: number) => {
              return this.renderHotKey(def, idx);
            })}
          </tbody>
        </table>
      </div>
    );
  }
}

export default Shortcuts;
