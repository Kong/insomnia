import React, {PureComponent} from 'react';
import {MOD_SYM} from '../../../common/constants';

class Shortcuts extends PureComponent {
  render () {
    return (
      <table className="wide">
        <tbody>
        <tr>
          <td>Switch Requests</td>
          <td><code>{MOD_SYM}P</code></td>
        </tr>
        <tr>
          <td>Send Request</td>
          <td><code>{MOD_SYM}Enter</code></td>
        </tr>
        <tr>
          <td>New Request</td>
          <td><code>{MOD_SYM}N</code></td>
        </tr>
        <tr>
          <td>Duplicate Request</td>
          <td><code>{MOD_SYM}D</code></td>
        </tr>
        <tr>
          <td>Show Cookie Manager</td>
          <td><code>{MOD_SYM}K</code></td>
        </tr>
        <tr>
          <td>Show Environment Editor</td>
          <td><code>{MOD_SYM}E</code></td>
        </tr>
        <tr>
          <td>Focus URL Bar</td>
          <td><code>{MOD_SYM}L</code></td>
        </tr>
        <tr>
          <td>Toggle Sidebar</td>
          <td><code>{MOD_SYM}\</code></td>
        </tr>
        <tr>
          <td>Show Settings</td>
          <td><code>{MOD_SYM},</code></td>
        </tr>
        </tbody>
      </table>
    );
  }
}

Shortcuts.propTypes = {};

export default Shortcuts;
