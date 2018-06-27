import React, { PureComponent } from 'react';
import autobind from 'autobind-decorator';
import Hotkey from '../hotkey';
import * as hotkeys from '../../../common/hotkeys';

@autobind
class Shortcuts extends PureComponent {
  renderHotkey(hotkey, i) {
    return (
      <tr key={i}>
        <td>{hotkey.description}</td>
        <td className="text-right">
          <code>
            <Hotkey hotkey={hotkey} />
          </code>
        </td>
      </tr>
    );
  }

  render() {
    return (
      <div>
        <table className="table--fancy">
          <tbody>
            {this.renderHotkey(hotkeys.SHOW_QUICK_SWITCHER)}
            {this.renderHotkey(hotkeys.SEND_REQUEST)}
            {this.renderHotkey(hotkeys.SHOW_SEND_OPTIONS)}
            {this.renderHotkey(hotkeys.CREATE_REQUEST)}
            {this.renderHotkey(hotkeys.DELETE_REQUEST)}
            {this.renderHotkey(hotkeys.CREATE_FOLDER)}
            {this.renderHotkey(hotkeys.DUPLICATE_REQUEST)}
            {this.renderHotkey(hotkeys.SHOW_COOKIES)}
            {this.renderHotkey(hotkeys.SHOW_ENVIRONMENTS)}
            {this.renderHotkey(hotkeys.TOGGLE_ENVIRONMENTS_MENU)}
            {this.renderHotkey(hotkeys.FOCUS_URL)}
            {this.renderHotkey(hotkeys.TOGGLE_METHOD_DROPDOWN)}
            {this.renderHotkey(hotkeys.TOGGLE_SIDEBAR)}
            {this.renderHotkey(hotkeys.TOGGLE_HISTORY_DROPDOWN)}
            {this.renderHotkey(hotkeys.SHOW_AUTOCOMPLETE)}
            {this.renderHotkey(hotkeys.SHOW_SETTINGS)}
            {this.renderHotkey(hotkeys.SHOW_WORKSPACE_SETTINGS)}
            {this.renderHotkey(hotkeys.SHOW_REQUEST_SETTINGS)}
            {this.renderHotkey(hotkeys.TOGGLE_MAIN_MENU)}
            {this.renderHotkey(hotkeys.RELOAD_PLUGINS)}
          </tbody>
        </table>
      </div>
    );
  }
}

export default Shortcuts;
