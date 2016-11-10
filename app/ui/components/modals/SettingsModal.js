import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux';
import {bindActionCreators} from 'redux';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import {shell} from 'electron';
import Modal from '../base/Modal';
import ModalBody from '../base/ModalBody';
import ModalHeader from '../base/ModalHeader';
import ModalFooter from '../base/ModalFooter';
import SettingsShortcuts from '../settings/SettingsShortcuts';
import SettingsAbout from '../settings/SettingsAbout';
import SettingsGeneral from '../settings/SettingsGeneral';
import SettingsImportExport from '../settings/SettingsImportExport';
import SettingsSync from '../settings/SettingsSync';
import * as GlobalActions from '../../redux/modules/global';
import * as models from '../../../backend/models';
import {
  getAppVersion,
  getAppLongName
} from '../../../backend/appInfo';
import * as session from '../../../sync/session';
import {showModal} from './index';
import SignupModal from './SignupModal';
import * as sync from '../../../sync';


class SettingsTabs extends Component {
  constructor (props) {
    super(props);
    this._currentTabIndex = -1;
    this._currentVersion = null;
    this.state = {
      showSyncSetting: false
    }
  }

  _importFile () {
    const workspace = this._getActiveWorkspace(this.props);
    this.props.actions.global.importFile(workspace);
    this.props.hide();
  }

  _handleTabSelect (selectedIndex) {
    this._currentTabIndex = selectedIndex;
  }

  _exportAll () {
    this.props.actions.global.exportFile();
    this.props.hide();
  }

  _exportWorkspace () {
    this.props.actions.global.exportFile(this._getActiveWorkspace());
    this.props.hide();
  }

  _getActiveWorkspace (props) {
    // TODO: Factor this out into a selector

    const {entities, global} = props || this.props;
    let workspace = entities.workspaces[global.activeWorkspaceId];
    if (!workspace) {
      workspace = entities.workspaces[Object.keys(entities.workspaces)[0]];
    }

    return workspace;
  }

  componentWillReceiveProps ({selectedIndex, version}) {
    if (this._currentVersion !== version) {
      this._currentTabIndex = selectedIndex;
      this._currentVersion = version;
    }
  }

  render () {
    const {entities, hide} = this.props;
    const settings = entities.settings[Object.keys(entities.settings)[0]];

    return (
      <Tabs onSelect={i => this._handleTabSelect(i)}
            selectedIndex={this._currentTabIndex}>
        <TabList>
          <Tab selected={this._currentTabIndex === 0}>
            <button>General</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 1}>
            <button>Import/Export</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 2}>
            <button>Cloud Sync</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 3}>
            <button>Shortcuts</button>
          </Tab>
          <Tab selected={this._currentTabIndex === 4}>
            <button>About</button>
          </Tab>
        </TabList>
        <TabPanel className="pad scrollable">
          <SettingsGeneral
            settings={settings}
            updateSetting={(key, value) => models.settings.update(settings, {[key]: value})}
          />
        </TabPanel>
        <TabPanel className="pad scrollable">
          <SettingsImportExport
            exportAll={this._exportAll.bind(this)}
            exportWorkspace={this._exportWorkspace.bind(this)}
            importFile={this._importFile.bind(this)}
          />
        </TabPanel>
        <TabPanel className="pad scrollable">
          <SettingsSync
            loggedIn={session.isLoggedIn()}
            firstName={session.getFirstName() || ''}
            handleExit={hide}
            handleUpdateSetting={(key, value) => models.settings.update(settings, {[key]: value})}
            handleShowSignup={() => showModal(SignupModal)}
            handleCancelAccount={sync.cancelAccount}
            handleLogout={sync.logout}
          />
        </TabPanel>
        <TabPanel className="pad scrollable">
          <SettingsShortcuts />
        </TabPanel>
        <TabPanel className="pad scrollable">
          <SettingsAbout/>
        </TabPanel>
      </Tabs>
    );
  }
}

SettingsTabs.propTypes = {
  global: PropTypes.shape({
    activeWorkspaceId: PropTypes.string
  }),
  entities: PropTypes.shape({
    workspaces: PropTypes.object.isRequired,
    settings: PropTypes.object.isRequired
  }).isRequired,
  actions: PropTypes.shape({
    global: PropTypes.shape({
      importFile: PropTypes.func.isRequired,
      exportFile: PropTypes.func.isRequired,
    })
  }),

  // Optional
  selectedIndex: PropTypes.number,
  version: PropTypes.number
};

function mapStateToProps (state) {
  return {
    global: state.global,
    entities: state.entities,
    actions: state.actions
  };
}

function mapDispatchToProps (dispatch) {
  return {
    actions: {
      global: bindActionCreators(GlobalActions, dispatch)
    }
  }
}


// NOTE: We can't _connect_ the SettingsModal because it hides the public methods
const ConnectedSettingsTabs = connect(
  mapStateToProps,
  mapDispatchToProps
)(SettingsTabs);


class SettingsModal extends Component {
  constructor (props) {
    super(props);
    this.state = {
      version: 0,
      selectedIndex: -1
    }
  }

  _setIndex (selectedIndex) {
    const version = this.state.version + 1;
    this.setState({selectedIndex, version});
  }

  show (selectedIndex = 0) {
    this.modal.show();
    this._setIndex(selectedIndex);
  }

  toggle (selectedIndex = 0) {
    this.modal.toggle();
    this._setIndex(selectedIndex);
  }

  render () {
    const {selectedIndex, version} = this.state;

    return (
      <Modal ref={m => this.modal = m} tall={true} {...this.props}>
        <ModalHeader>
          {getAppLongName()}
          &nbsp;&nbsp;
          <span className="faint txt-sm">v{getAppVersion()}</span>
        </ModalHeader>
        <ModalBody noScroll={true}>
          <ConnectedSettingsTabs
            version={version}
            hide={() => this.modal.hide()}
            selectedIndex={selectedIndex}
          />
        </ModalBody>
        <ModalFooter>
          <button className="btn" onClick={() => this.modal.hide()}>
            Done
          </button>
        </ModalFooter>
      </Modal>
    );
  }
}
export default SettingsModal;
