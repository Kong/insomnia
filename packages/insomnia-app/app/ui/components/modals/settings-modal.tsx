import React, { PureComponent } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG, getAppName, getAppVersion } from '../../../common/constants';
import Modal from '../base/modal';
import Button from '../base/button';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import SettingsShortcuts from '../settings/shortcuts';
import General from '../settings/general';
import { ImportExport } from '../settings/import-export';
import Plugins from '../settings/plugins';
import { ThemePanel } from '../settings/theme-panel';
import * as models from '../../../models/index';
import { Curl } from 'node-libcurl';
import Tooltip from '../tooltip';
import * as session from '../../../account/session';
import Account from '../settings/account';
import { showModal } from './index';
import { Settings } from '../../../models/settings';

export const TAB_INDEX_EXPORT = 1;
export const TAB_INDEX_SHORTCUTS = 3;
export const TAB_INDEX_THEMES = 2;
export const TAB_INDEX_PLUGINS = 5;

interface Props {
  settings: Settings;
}

interface State {
  currentTabIndex: number | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class SettingsModal extends PureComponent<Props, State> {
  state: State = {
    currentTabIndex: null,
  }

  modal: Modal | null = null;

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  async _handleUpdateSetting(key: string, value: any) {
    return models.settings.update(this.props.settings, {
      [key]: value,
    });
  }

  async _handleUpdateKeyBindings(hotKeyRegistry) {
    models.settings.update(this.props.settings, {
      hotKeyRegistry,
    });
  }

  show(currentTabIndex = 0) {
    if (typeof currentTabIndex !== 'number') {
      currentTabIndex = 0;
    }

    this.setState({
      currentTabIndex,
    });
    this.modal?.show();
  }

  hide() {
    this.modal?.hide();
  }

  render() {
    const { settings } = this.props;
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
          <Tabs className="react-tabs" defaultIndex={currentTabIndex ?? undefined}>
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
              <Tab tabIndex="-1">
                <Button value="Account">Account</Button>
              </Tab>
              <Tab tabIndex="-1">
                <Button value="Plugins">Plugins</Button>
              </Tab>
            </TabList>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <General
                settings={settings}
                hideModal={this.hide}
                updateSetting={this._handleUpdateSetting}
              />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <ImportExport
                hideSettingsModal={this.hide}
              />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <ThemePanel />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <SettingsShortcuts
                hotKeyRegistry={settings.hotKeyRegistry}
                handleUpdateKeyBindings={this._handleUpdateKeyBindings}
              />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <Account />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <Plugins settings={settings} updateSetting={this._handleUpdateSetting} />
            </TabPanel>
          </Tabs>
        </ModalBody>
      </Modal>
    );
  }
}

export const showSettingsModal = () => showModal(SettingsModal);

export default SettingsModal;
