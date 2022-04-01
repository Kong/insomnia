import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { HotKeyRegistry } from 'insomnia-common';
import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import * as session from '../../../account/session';
import { AUTOBIND_CFG, getAppName, getAppVersion } from '../../../common/constants';
import * as models from '../../../models/index';
import { RootState } from '../../redux/modules';
import { selectSettings } from '../../redux/selectors';
import { Button } from '../base/button';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { Account } from '../settings/account';
import { General } from '../settings/general';
import { ImportExport } from '../settings/import-export';
import { Plugins } from '../settings/plugins';
import { Shortcuts } from '../settings/shortcuts';
import { ThemePanel } from '../settings/theme-panel';
import { showModal } from './index';

export const TAB_INDEX_EXPORT = 1;
export const TAB_INDEX_SHORTCUTS = 3;
export const TAB_INDEX_THEMES = 2;
export const TAB_INDEX_PLUGINS = 5;

type ReduxProps = ReturnType<typeof mapStateToProps>;

interface Props extends ReduxProps {
}

interface State {
  currentTabIndex: number | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class UnconnectedSettingsModal extends PureComponent<Props, State> {
  state: State = {
    currentTabIndex: null,
  };

  modal: Modal | null = null;

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  async _handleUpdateKeyBindings(hotKeyRegistry: HotKeyRegistry) {
    await models.settings.update(this.props.settings, {
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
              <General />
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
              <Shortcuts
                hotKeyRegistry={settings.hotKeyRegistry}
                handleUpdateKeyBindings={this._handleUpdateKeyBindings}
              />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <Account />
            </TabPanel>
            <TabPanel className="react-tabs__tab-panel pad scrollable">
              <Plugins settings={settings} />
            </TabPanel>
          </Tabs>
        </ModalBody>
      </Modal>
    );
  }
}

export const showSettingsModal = () => showModal(SettingsModal);

const mapStateToProps = (state: RootState) => ({
  settings: selectSettings(state),
});

export const SettingsModal = connect(
  mapStateToProps,
  null,
  null,
  { forwardRef: true },
)(UnconnectedSettingsModal);
