import React, {Component, PropTypes} from 'react';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import {shell} from 'electron';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import SettingsShortcuts from '../settings/SettingsShortcuts';
import SettingsAbout from '../settings/SettingsAbout';
import SettingsGeneral from '../settings/SettingsGeneral';
import SettingsImportExport from '../settings/SettingsImportExport';
import SettingsSync from '../settings/SettingsSync';
import * as models from '../../../models';
import {getAppVersion, getAppName} from '../../../common/constants';
import * as session from '../../../sync/session';
import {showModal} from './index';
import * as sync from '../../../sync';
import {trackEvent} from '../../../analytics/index';

export const TAB_INDEX_EXPORT = 1;
export const TAB_PLUS = 3;

class SettingsModal extends Component {
  constructor (props) {
    super(props);
    this._currentTabIndex = -1;
    this.state = {}
  }

  _handleClose = () => {
    this.hide();
  };

  show (currentTabIndex = 0) {
    this.setState({currentTabIndex});
    this.modal.show();
  }

  hide () {
    this.modal.hide();
  }

  toggle (currentTabIndex = 0) {
    this.setState({currentTabIndex});
    this.modal.toggle();
  }

  _handleTabSelect (currentTabIndex) {
    this.setState({currentTabIndex});
  }

  async _handleSyncReset () {
    this.modal.hide();
    trackEvent('Sync', 'Reset');
    await sync.resetRemoteData();
    await sync.resetLocalData();
    await sync.logout();
  }

  render () {
    const {
      settings,
      handleExportAllToFile,
      handleExportWorkspaceToFile,
      handleImportFile,
    } = this.props;

    const {currentTabIndex} = this.state;

    return (
      <Modal ref={m => this.modal = m} tall={true} {...this.props}>
        <ModalHeader>
          {getAppName()} Preferences
          &nbsp;&nbsp;
          <span className="faint txt-sm">v{getAppVersion()}</span>
        </ModalHeader>
        <ModalBody noScroll={true}>
          <Tabs onSelect={i => this._handleTabSelect(i)} selectedIndex={currentTabIndex}>
            <TabList>
              <Tab selected={this._currentTabIndex === 0}>
                <button onClick={e => trackEvent('Setting', 'Tab General')}>General</button>
              </Tab>
              <Tab selected={this._currentTabIndex === 1}>
                <button onClick={e => trackEvent('Setting', 'Tab Import/Export')}>Import/Export
                </button>
              </Tab>
              <Tab selected={this._currentTabIndex === 3}>
                <button onClick={e => trackEvent('Setting', 'Tab Shortcuts')}>Shortcuts</button>
              </Tab>
              <Tab selected={this._currentTabIndex === 2}>
                <button onClick={e => trackEvent('Setting', 'Tab Plus')}>Insomnia Plus</button>
              </Tab>
              <Tab selected={this._currentTabIndex === 4}>
                <button onClick={e => trackEvent('Setting', 'Tab About')}>About</button>
              </Tab>
            </TabList>
            <TabPanel className="pad scrollable">
              <SettingsGeneral
                settings={settings}
                updateSetting={(key, value) => {
                  models.settings.update(settings, {[key]: value});
                  trackEvent('Setting', 'Change', key)
                }}
              />
            </TabPanel>
            <TabPanel className="pad scrollable">
              <SettingsImportExport
                handleExportAll={() => {
                  handleExportAllToFile();
                  this.modal.hide()
                }}
                handleExportWorkspace={() => {
                  handleExportWorkspaceToFile();
                  this.modal.hide()
                }}
                handleImport={() => {
                  handleImportFile();
                  this.modal.hide()
                }}
              />
            </TabPanel>
            <TabPanel className="pad scrollable">
              <SettingsShortcuts />
            </TabPanel>
            <TabPanel className="pad scrollable">
              <SettingsSync
                loggedIn={session.isLoggedIn()}
                firstName={session.getFirstName() || ''}
                email={session.getEmail() || ''}
                handleExit={this._handleClose}
                handleCancelAccount={sync.cancelAccount}
                handleReset={() => this._handleSyncReset()}
                handleLogout={sync.logout}
              />
            </TabPanel>
            <TabPanel className="pad scrollable">
              <SettingsAbout/>
            </TabPanel>
          </Tabs>
        </ModalBody>
      </Modal>
    );
  }
}

SettingsModal.propTypes = {
  // Functions
  handleExportWorkspaceToFile: PropTypes.func.isRequired,
  handleExportAllToFile: PropTypes.func.isRequired,
  handleImportFile: PropTypes.func.isRequired,

  // Properties
  settings: PropTypes.object.isRequired,
};

export default SettingsModal;
