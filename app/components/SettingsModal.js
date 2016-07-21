import React, {Component, PropTypes} from 'react';
import {connect} from 'react-redux'
import {bindActionCreators} from 'redux';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'
import {shell} from 'electron';

import Input from './base/Input';
import Link from './base/Link';
import Modal from './base/Modal';
import ModalBody from './base/ModalBody';
import ModalHeader from './base/ModalHeader';
import ModalFooter from './base/ModalFooter';
import ModalComponent from './lib/ModalComponent';
import * as GlobalActions from '../redux/modules/global';
import * as db from '../database';
import {MASHAPE_URL} from '../lib/constants';
import {getVersion} from '../lib/appInfo';


class SettingsTabs extends Component {
  _importFile () {
    const workspace = this._getActiveWorkspace(this.props);
    this.props.actions.global.importFile(workspace);
  }

  _exportFile () {
    this.props.actions.global.exportFile();
  }

  _getActiveWorkspace (props) {
    // TODO: Factor this out into a selector

    const {entities, workspaces} = props || this.props;
    let workspace = entities.workspaces[workspaces.activeId];
    if (!workspace) {
      workspace = entities.workspaces[Object.keys(entities.workspaces)[0]];
    }

    return workspace;
  }

  render () {
    const {entities, selectedIndex} = this.props;
    const settings = entities.settings[Object.keys(entities.settings)[0]];

    return (
      <Tabs selectedIndex={selectedIndex >= 0 ? selectedIndex : 0}>
        <TabList>
          <Tab>
            <button>General</button>
          </Tab>
          <Tab>
            <button>Import/Export</button>
          </Tab>
          <Tab>
            <button>Hotkeys</button>
          </Tab>
          <Tab>
            <button>About</button>
          </Tab>
        </TabList>
        <TabPanel className="pad">
          <div>
            <h2 className="txt-md">
              <label className="label--small">General Settings</label>
            </h2>
            <div>
              <Input
                id="setting-show-passwords"
                type="checkbox"
                value={settings.showPasswords}
                onChange={showPasswords => db.settingsUpdate(settings, {showPasswords})}
              />
              &nbsp;&nbsp;
              <label htmlFor="setting-show-passwords">
                Show passwords in plain-text
              </label>
            </div>

            <div className="pad-top">
              <Input
                id="setting-follow-redirects"
                type="checkbox"
                value={settings.followRedirects}
                onChange={followRedirects => db.settingsUpdate(settings, {followRedirects})}
              />
              &nbsp;&nbsp;
              <label htmlFor="setting-follow-redirects">
                Follow redirects automatically
              </label>
            </div>

            {/*<div className="pad-top">*/}
            {/*<Input*/}
            {/*id="setting-bulk-header-edit"*/}
            {/*type="checkbox"*/}
            {/*value={settings.useBulkHeaderEditor}*/}
            {/*onChange={useBulkHeaderEditor => db.settingsUpdate(settings, {useBulkHeaderEditor})}*/}
            {/*/>*/}
            {/*&nbsp;&nbsp;*/}
            {/*<label htmlFor="setting-bulk-header-edit">*/}
            {/*Use bulk header editor by default*/}
            {/*</label>*/}
            {/*</div>*/}

            {/*<div className="pad-top">*/}
            {/*<input id="setting-follow-redirects" type="checkbox"/>&nbsp;&nbsp;*/}
            {/*<label htmlFor="setting-follow-redirects">*/}
            {/*Follow Redirects*/}
            {/*</label>*/}
            {/*</div>*/}

            <div>
              <label htmlFor="setting-request-timeout" className="pad-top">
                Request Timeout (ms) (-1 for no timeout)
              </label>
              <div className="form-control form-control--outlined no-margin">
                <Input
                  id="setting-request-timeout"
                  type="number"
                  min={-1}
                  value={settings.timeout}
                  onChange={timeout => db.settingsUpdate(settings, {timeout})}
                />
              </div>
            </div>
          </div>

          <div className="pad-top">
            <br/>
            <label className="label--small">Code Editor Settings</label>

            <div className="pad-top">
              <Input
                id="setting-editor-line-wrapping"
                type="checkbox"
                value={settings.editorLineWrapping}
                onChange={editorLineWrapping => db.settingsUpdate(settings, {editorLineWrapping})}
              />
              &nbsp;&nbsp;
              <label htmlFor="setting-editor-line-wrapping">
                Wrap Long Lines
              </label>
            </div>
            <div>
              <label htmlFor="setting-editor-font-size" className="pad-top">
                Font Size (px)
              </label>
              <div className="form-control form-control--outlined no-margin">
                <Input
                  id="setting-editor-font-size"
                  type="number"
                  min={8}
                  max={20}
                  value={settings.editorFontSize}
                  onChange={editorFontSize => db.settingsUpdate(settings, {editorFontSize})}
                />
              </div>
            </div>
          </div>
        </TabPanel>
        <TabPanel className="pad">
          <p>
            Import or export your data, so you can share it or back it up.
          </p>
          <p>
            <button className="btn btn--super-compact btn--outlined"
                    onClick={e => this._importFile()}>
              Import
            </button>
            {" "}
            <button className="btn btn--super-compact btn--outlined"
                    onClick={e => this._exportFile()}>
              Export
            </button>
          </p>
        </TabPanel>
        <TabPanel className="pad">
          Keyboard
        </TabPanel>
        <TabPanel className="pad">
          <p>
            <Link href="http://insomnia.rest">Insomnia</Link> is made with love by me,&nbsp;
            <Link href="http://schier.co">Gregory Schier</Link>.
          </p>
          <p>
            You can help me out by sending your feedback to&nbsp;
            <Link href="mailto:greg@schier.co">greg@schier.co</Link> or tweet&nbsp;
            <Link href="https://twitter.com/GetInsomnia">@GetInsomnia</Link>.
          </p>
          <p>Thanks!</p>
          <br/>
          <p>~Gregory</p>
        </TabPanel>
      </Tabs>
    );
  }
}

SettingsTabs.propTypes = {
  workspaces: PropTypes.shape({
    activeId: PropTypes.string
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
  selectedIndex: PropTypes.number
};

function mapStateToProps (state) {
  return {
    workspaces: state.workspaces,
    entities: state.entities,
    actions: state.actions,
    loading: state.global.loading
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


class SettingsModal extends ModalComponent {
  constructor (props) {
    super(props);
    this.state = {
      selectedIndex: 0
    }
  }

  show (selectedIndex = 0) {
    super.show();

    if (selectedIndex >= 0) {
      this.setState({selectedIndex});
    } else {
      this.setState({selectedIndex: 0});
    }
  }

  render () {
    const {selectedIndex} = this.state;

    return (
      <Modal ref="modal" tall={true} {...this.props}>
        <ModalHeader>
          Insomnia
          {" "}
          <span className="faint txt-sm">v{getVersion()}</span>
        </ModalHeader>
        <ModalBody>
          <ConnectedSettingsTabs selectedIndex={selectedIndex} />
        </ModalBody>
        <ModalFooter className="pad text-right">
          <div className="relative">
            Supported By&nbsp;&nbsp;
            <Link href={MASHAPE_URL}>
              <img src="images/mashape.png" style={{height: '1.5em'}} className="valign-bottom"/>
            </Link>
          </div>
        </ModalFooter>
      </Modal>
    );
  }
}
export default SettingsModal;
