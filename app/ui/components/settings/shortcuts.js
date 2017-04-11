import React, {PureComponent} from 'react';
import Hotkey from '../hotkey';

class Shortcuts extends PureComponent {
  renderHotkey (name, char, shift, alt) {
    return (
      <tr>
        <td>{name}</td>
        <td className="text-right">
          <code><Hotkey char={char} shift={shift} alt={alt}/></code>
        </td>
      </tr>
    );
  }

  render () {
    return (
      <div>
        <table className="table--fancy">
          <tbody>
          {this.renderHotkey('Switch Requests', 'P')}
          {this.renderHotkey('Send Request', 'Enter')}
          {this.renderHotkey('New Request', 'N')}
          {this.renderHotkey('Duplicate Request', 'D')}
          {this.renderHotkey('Show Cookie Manager', 'K')}
          {this.renderHotkey('Show Environment Editor', 'E')}
          {this.renderHotkey('Focus URL Bar', 'L')}
          {this.renderHotkey('Toggle Sidebar', '\\')}
          {this.renderHotkey('Show App Preferences', ',')}
          {this.renderHotkey('Show Workspace Settings', ',', true)}
          {this.renderHotkey('Show Request Settings', ',', true, true)}
          {this.renderHotkey('Show Keyboard Shortcuts', '?')}
          </tbody>
        </table>
      </div>
    );
  }
}

Shortcuts.propTypes = {};

export default Shortcuts;
