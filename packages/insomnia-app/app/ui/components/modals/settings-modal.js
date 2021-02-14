import React, { PureComponent } from 'react';
import PropTypes from 'prop-types';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import Button from '../base/button';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import SettingsShortcuts from '../settings/shortcuts';
import General from '../settings/general';
import ImportExport from '../settings/import-export';
import Plugins from '../settings/plugins';
import Theme from '../settings/theme';
import * as models from '../../../models/index';
import { Curl } from 'node-libcurl';
import { getAppName, getAppVersion, isInsomnia } from '../../../common/constants';
import Tooltip from '../tooltip';
import { setTheme } from '../../../plugins/misc';
import * as session from '../../../account/session';
import Account from '../settings/account';

export const TAB_INDEX_EXPORT = 1;
export const TAB_INDEX_SHORTCUTS = 3;
export const TAB_INDEX_THEMES = 2;
export const TAB_INDEX_PLUGINS = 5;

@autobind
class SettingsModal extends PureComponent {
  constructor(props) {
    super(props);
    this.state = {};
  }

  _setModalRef(n) {
    this.modal = n;
  }

  async _handleUpdateSetting(key, value) {
    return models.settings.update(this.props.settings, { [key]: value });
  }

  _handleExportAllToFile() {
    this.props.handleExportAllToFile();
    this.modal.hide();
  }

  _handleShowExportRequestsModal() {
    this.props.handleShowExportRequestsModal();
    this.modal.hide();
  }

  _handleImportFile() {
    this.props.handleImportFile();
    this.modal.hide();
  }

  _handleImportClipBoard() {
    this.props.handleImportClipBoard();
    this.modal.hide();
  }

  _handleImportUri(uri) {
    this.props.handleImportUri(uri);
    this.modal.hide();
  }

  async _handleChangeTheme(theme, persist = true) {
    await setTheme(theme);

    if (persist) {
      models.settings.update(this.props.settings, { theme });
    }
  }

  async _handleUpdateKeyBindings(hotKeyRegistry) {
    models.settings.update(this.props.settings, { hotKeyRegistry });
    this.props.handleUpdateKeyBindings();
  }

  show(currentTabIndex = 0) {
    if (typeof currentTabIndex !== 'number') {
      currentTabIndex = 0;
    }

    this.setState({ currentTabIndex });
    this.modal.show();
  }

  hide() {
    this.modal.hide();
  }

  render() {
    const { settings, activity } = this.props;
    const { currentTabIndex } = this.state;
    const email = session.isLoggedIn() ? session.getFullName() : null;

    return (
      <Modal ref={this._setModalRef} tall freshState {...this.props}>
        <ModalHeader>
          {getAppName()} Preferences
          <span className="faint txt-sm">
            &nbsp;&nbsp;–&nbsp; v{getAppVersion()}
            <Tooltip position="bottom" message={Curl.getVersion()}>
              <i className="fa fa-info-circle" />
            </Tooltip>
            {email ? ` – ${email}` : null}
          </span>
        </ModalHeader>
        <ModalBody noScroll>
          <Tabs className="react-tabs" defaultIndex={currentTabIndex}>
            <TabList>
              <Tab tabIndex="-1">
                <Button value="General">General</Button>
              </Tab>
              <Tab tabIndex="-1">
                <Button value="Import/Export">Data</Button>
              </Tab>
              <Tab tabIndex="-1">
                <Button value="Themes">Themes</Button>
              </Tab>
              <Tab tabIndex="-1">
                <Button value="Shortcuts">Keyboard</Button>
              </Tab>
              {isInsomnia(activity) && (
                <Tab tabIndex="-1">
                  <Button value="Account">Account</Button>
                </Tab>
              )}
              <Tab tabIndex="-1">
                <Button value="Plugins">Plugins</Button>
              </Tab>
            </TabList>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <General
                settings={settings}
                handleToggleMenuBar={this.props.handleToggleMenuBar}
                updateSetting={this._handleUpdateSetting}
                handleRootCssChange={this._handleRootCssChange}
              />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <ImportExport
                handleExportAll={this._handleExportAllToFile}
                handleShowExportRequestsModal={this._handleShowExportRequestsModal}
                handleImportFile={this._handleImportFile}
                handleImportClipBoard={this._handleImportClipBoard}
                handleImportUri={this._handleImportUri}
              />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel scrollable">
              <Theme handleChangeTheme={this._handleChangeTheme} activeTheme={settings.theme} />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <SettingsShortcuts
                hotKeyRegistry={settings.hotKeyRegistry}
                handleUpdateKeyBindings={this._handleUpdateKeyBindings}
              />
            </TabPanel>
            {isInsomnia(activity) && (
              <TabPanel className="react-tabs__tab-panel pad scrollable">
                <Account />
              </TabPanel>
            )}
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <Plugins settings={settings} updateSetting={this._handleUpdateSetting} />
            </TabPanel>
          </Tabs>
        </ModalBody>
      </Modal>
    );
  }
}

SettingsModal.propTypes = {
  // Functions
  handleShowExportRequestsModal: PropTypes.func.isRequired,
  handleExportAllToFile: PropTypes.func.isRequired,
  handleImportFile: PropTypes.func.isRequired,
  handleImportUri: PropTypes.func.isRequired,
  handleToggleMenuBar: PropTypes.func.isRequired,

  // Properties
  settings: PropTypes.object.isRequired,
  activity: PropTypes.string.isRequired,
};

export default SettingsModal;
