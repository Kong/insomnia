// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import classnames from 'classnames';
import DropdownButton from '../base/dropdown/dropdown-button';
import DropdownDivider from '../base/dropdown/dropdown-divider';
import DropdownItem from '../base/dropdown/dropdown-item';
import Dropdown from '../base/dropdown/dropdown';
import chooseFile from '../base/choose-file';
import { addPathToDbDirectories, selectDbDirectories } from '../../../common/misc';
import * as electron from 'electron';

@autobind
class WorkingBdDirectoryDropdown extends React.PureComponent<Props, State> {
  async _handleDirectorySelect(id?: string) {
    selectDbDirectories(id);
    this._refreshAndRelaunch();
  }

  async _handleDirectoryOpen() {
    const path = await chooseFile({ itemtypes: ['directory'] });
    if (path) {
      addPathToDbDirectories(path);
      this._refreshAndRelaunch();
    }
  }

  _refreshAndRelaunch() {
    const { app } = electron.remote || electron;
    app.relaunch();
    app.exit();
  }

  _computePath(path: string): string {
    const split = path.split('/');
    let text = split[split.length - 1];
    if (text && text.length > 20) {
      return `/...${text.substring(text.length - 21, text.length - 1)}`;
    } else if (text) {
      return `/${text}`;
    }

    return path;
  }

  render() {
    const { className, directories } = this.props;

    const classes = classnames(className, 'wide', 'working-dir-dropdown');

    let dirText = 'Default';
    if (directories.current) {
      dirText = this._computePath(directories.all[directories.current].path);
    }

    return (
      <Dropdown
        ref={this._setDropdownRef}
        className={classes}
        beside
        onOpen={this._handleDropdownOpen}
        onHide={this._handleDropdownHide}>
        <DropdownButton className="btn wide">
          <h4 className="no-pad text-left">
            <div className="pull-right">
              <i className="fa fa-caret-down space-left" />
            </div>
            {dirText}
          </h4>
        </DropdownButton>

        <DropdownDivider>Current Directory</DropdownDivider>
        <DropdownItem>
          {directories && directories.current ? (
            <React.Fragment>
              <i className="fa fa-empty" /> {directories.all[directories.current].path}
            </React.Fragment>
          ) : (
            <React.Fragment>
              <i className="fa fa-home" /> Default
            </React.Fragment>
          )}
        </DropdownItem>
        <DropdownDivider>Switch Directory</DropdownDivider>
        {directories && directories.current && (
          <DropdownItem onClick={() => this._handleDirectorySelect()}>
            <i className="fa fa-home" /> Home
          </DropdownItem>
        )}
        {directories &&
          Object.keys(directories.all).map(
            key =>
              key !== directories.current && (
                <DropdownItem
                  key={key}
                  onClick={() => this._handleDirectorySelect(key)}
                  className={'test'}>
                  <i className="fa fa-random" /> {directories.all[key].path}
                </DropdownItem>
              ),
          )}
        <DropdownItem onClick={this._handleDirectoryOpen}>
          <i className="fa fa-plus" /> New Working Directory...
        </DropdownItem>
      </Dropdown>
    );
  }
}

export default WorkingBdDirectoryDropdown;
