import React from 'react';
import {Tab, Tabs, TabList, TabPanel} from 'react-tabs'
import {shell} from 'electron';

import Link from './base/Link';
import Modal from './base/Modal';
import ModalBody from './base/ModalBody';
import ModalHeader from './base/ModalHeader';
import ModalFooter from './base/ModalFooter';
import ModalComponent from './lib/ModalComponent';
import {MASHAPE_URL} from '../lib/constants';
import {getVersion} from '../lib/appInfo';

class SettingsModal extends ModalComponent {
  render () {
    return (
      <Modal ref="modal" tall={true} {...this.props}>
        <ModalHeader>Insomnia Settings</ModalHeader>
        <ModalBody>
          <Tabs>
            <TabList>
              <Tab>
                <button>General</button>
              </Tab>
              <Tab>
                <button>Import/Export</button>
              </Tab>
              <Tab>
                <button>Editor</button>
              </Tab>
              <Tab>
                <button>Hotkeys</button>
              </Tab>
              <Tab>
                <button>About v{getVersion()}</button>
              </Tab>
            </TabList>
            <TabPanel className="pad">
              <div>
                <input id="setting-show-passwords" type="checkbox"/>&nbsp;&nbsp;
                <label htmlFor="setting-show-passwords">
                  Show HTTP authentication passwords in plain-text
                </label>
              </div>
              <div className="pad-top">
                <input id="setting-bulk-header-edit" type="checkbox"/>&nbsp;&nbsp;
                <label htmlFor="setting-bulk-header-edit">
                  Use bulk header editor by default
                </label>
              </div>
              <div className="pad-top">
                <input id="setting-follow-redirects" type="checkbox"/>&nbsp;&nbsp;
                <label htmlFor="setting-follow-redirects">
                  Follow Redirects
                </label>
              </div>
              <div>
                <label htmlFor="setting-request-timeout" className="pad-top">
                  Request Timeout (milliseconds)
                </label>
                <div className="form-control form-control--outlined no-marg">
                  <input id="setting-request-timeout" type="text" defaultValue={30000}/>
                </div>
              </div>
              <br/>
            </TabPanel>
            <TabPanel className="pad">
              Import/Export
            </TabPanel>
            <TabPanel className="pad">
              Editor
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

SettingsModal.propTypes = {};

export default SettingsModal;
