import React, {PureComponent, PropTypes} from 'react';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import Button from '../base/button';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import SettingsShortcuts from '../settings/shortcuts';
import About from '../settings/about';
import General from '../settings/general';
import ImportExport from '../settings/import-export';
import Account from '../settings/account';
import Plugins from '../settings/plugins';
import Theme from '../settings/theme';
import * as models from '../../../models/index';
import {getAppVersion, getAppName} from '../../../common/constants';
import {trackEvent} from '../../../analytics/index';
import * as session from '../../../sync/session';

export const TAB_INDEX_EXPORT = 1;

@autobind
class SettingsModal extends PureComponent {
  constructor (props) {
    super(props);
    this.state = {};
    this._currentTabIndex = -1;
  }

  _setModalRef (n) {
    this.modal = n;
  }

  _trackTab (name) {
    trackEvent('Setting', `Tab ${name}`);
  }

  _handleTabSelect (currentTabIndex) {
    this.setState({currentTabIndex});
  }

  _handleUpdateSetting (key, value) {
    models.settings.update(this.props.settings, {[key]: value});
    trackEvent('Setting', 'Change', key);
  }

  _handleExportAllToFile () {
    this.props.handleExportAllToFile();
    this.modal.hide();
  }

  _handleExportWorkspace () {
    this.props.handleExportWorkspaceToFile();
    this.modal.hide();
  }

  _handleImportFile () {
    this.props.handleImportFile();
    this.modal.hide();
  }

  _handleImportUri (uri) {
    this.props.handleImportUri(uri);
    this.modal.hide();
  }

  _handleChangeTheme (theme, persist = true) {
    document.body.setAttribute('theme', theme);

    if (persist) {
      trackEvent('Setting', 'Change Theme', theme);
      models.settings.update(this.props.settings, {theme});
    }
  }

  componentDidMount () {
    // Hacky way to set theme on launch
    // TODO: move somewhere else
    this._handleChangeTheme(this.props.settings.theme, false);
  }

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

  render () {
    const {settings} = this.props;
    const {currentTabIndex} = this.state;
    const email = session.isLoggedIn() ? session.getEmail() : null;

    return (
      <Modal ref={this._setModalRef} tall freshState {...this.props}>
        <ModalHeader>
          {getAppName()} Preferences
          <span className="faint txt-sm">
          &nbsp;&nbsp;–&nbsp;
            v{getAppVersion()}
            {email ? ` – ${email}` : null}
          </span>
        </ModalHeader>
        <ModalBody noScroll>
          <Tabs onSelect={this._handleTabSelect}
                selectedIndex={currentTabIndex}
                forceRenderTabPanel>
            <TabList>
              <Tab selected={this._currentTabIndex === 0}>
                <Button value="General" onClick={this._trackTab}>
                  General
                </Button>
              </Tab>
              <Tab selected={this._currentTabIndex === 1}>
                <Button value="Import/Export" onClick={this._trackTab}>
                  Data
                </Button>
              </Tab>
              <Tab selected={this._currentTabIndex === 2}>
                <Button value="Themes" onClick={this._trackTab}>
                  Themes
                </Button>
              </Tab>
              <Tab selected={this._currentTabIndex === 3}>
                <Button value="shortcuts" onClick={this._trackTab}>
                  Shortcuts
                </Button>
              </Tab>
              <Tab selected={this._currentTabIndex === 4}>
                <Button value="Account" onClick={this._trackTab}>
                  Account
                </Button>
              </Tab>
              <Tab selected={this._currentTabIndex === 1}>
                <Button value="Plugins" onClick={this._trackTab}>
                  Plugins
                </Button>
              </Tab>
              <Tab selected={this._currentTabIndex === 5}>
                <Button value="About" onClick={this._trackTab}>
                  About
                </Button>
              </Tab>
            </TabList>
            <TabPanel className="pad scrollable">
              <General
                settings={settings}
                handleToggleMenuBar={this.props.handleToggleMenuBar}
                updateSetting={this._handleUpdateSetting}
              />
            </TabPanel>
            <TabPanel className="pad scrollable">
              <ImportExport
                handleExportAll={this._handleExportAllToFile}
                handleExportWorkspace={this._handleExportWorkspace}
                handleImportFile={this._handleImportFile}
                handleImportUri={this._handleImportUri}
              />
            </TabPanel>
            <TabPanel className="scrollable">
              <Theme
                handleChangeTheme={this._handleChangeTheme}
                activeTheme={settings.theme}
              />
            </TabPanel>
            <TabPanel className="pad scrollable"><SettingsShortcuts/></TabPanel>
            <TabPanel className="pad scrollable"><Account/></TabPanel>
            <TabPanel className="pad scrollable"><Plugins/></TabPanel>
            <TabPanel className="pad scrollable"><About/></TabPanel>
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
  handleImportUri: PropTypes.func.isRequired,
  handleToggleMenuBar: PropTypes.func.isRequired,

  // Properties
  settings: PropTypes.object.isRequired
};

export default SettingsModal;
