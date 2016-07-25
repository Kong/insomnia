import React, {Component} from 'react';
import {MOD_SYM} from '../lib/constants';

const KeyboardShortcutsTable = () => (
  <table className="wide">
    <thead>
    <tr>
      <th>Keyboard Shortcut</th>
      <th>Action</th>
    </tr>
    </thead>
    <tbody>
    <tr>
      <td><code>{MOD_SYM}P</code></td>
      <td>Switch Requests</td>
    </tr>
    <tr>
      <td><code>{MOD_SYM}Enter</code></td>
      <td>Send Request</td>
    </tr>
    <tr>
      <td><code>{MOD_SYM}L</code></td>
      <td>Focus URL Bar</td>
    </tr>
    <tr>
      <td><code>{MOD_SYM}N</code></td>
      <td>New Request</td>
    </tr>
    <tr>
      <td><code>{MOD_SYM}D</code></td>
      <td>Duplicate Request</td>
    </tr>
    <tr>
      <td><code>{MOD_SYM},</code></td>
      <td>Show Settings</td>
    </tr>
    </tbody>
  </table>
);

KeyboardShortcutsTable.propTypes = {};

export default KeyboardShortcutsTable;
