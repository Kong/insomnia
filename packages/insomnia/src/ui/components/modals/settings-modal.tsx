import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';

import { getAppVersion, getProductName } from '../../../common/constants';
import { useRootLoaderData } from '../../routes/root';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { AI } from '../settings/ai';
import { BooleanSetting } from '../settings/boolean-setting';
import { General } from '../settings/general';
import { ImportExport } from '../settings/import-export';
import { MaskedSetting } from '../settings/masked-setting';
import { Plugins } from '../settings/plugins';
import { Shortcuts } from '../settings/shortcuts';
import { TextSetting } from '../settings/text-setting';
import { ThemePanel } from '../settings/theme-panel';
import { showModal } from './index';

export interface SettingsModalHandle {
  hide: () => void;
  show: (options?: { tab?: string }) => void;
}

export const TAB_INDEX_EXPORT = 'data';
export const TAB_INDEX_SHORTCUTS = 'keyboard';
export const TAB_INDEX_THEMES = 'themes';
export const TAB_INDEX_PLUGINS = 'plugins';
export const TAB_INDEX_AI = 'ai';

export const SettingsModal = forwardRef<SettingsModalHandle, ModalProps>((props, ref) => {
  const [defaultTabKey, setDefaultTabKey] = useState('general');
  const { userSession, settings } = useRootLoaderData();
  const modalRef = useRef<ModalHandle>(null);

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: options => {
      setDefaultTabKey(options?.tab || 'general');
      modalRef.current?.show();
    },
  }), []);

  return (
    <Modal className='!z-10' ref={modalRef} tall {...props}>
      <ModalHeader>
        {getProductName()} Preferences
        <span className="faint txt-sm">
          &nbsp;&nbsp;–&nbsp; v{getAppVersion()}
          {(userSession.id && userSession.email) ? ` – ${userSession.email}` : null}
        </span>
      </ModalHeader>
      <ModalBody noScroll>
        <Tabs aria-label="Insomnia Settings"  defaultSelectedKey={defaultTabKey}>
          <TabItem key="general" title="General">
            <General />
          </TabItem>
          <TabItem key="proxy" title="Proxy">
            <PanelContainer className="pad">
              <h2 className='font-bold pt-5 pb-2 text-lg sticky top-0 left-0 bg-[--color-bg] z-10'>Network Proxy</h2>

              <BooleanSetting
                label="Enable proxy"
                setting="proxyEnabled"
                help="If checked, enables a global network proxy on all requests sent through Insomnia. This proxy supports Basic Auth, digest, and NTLM authentication."
              />

              <div className="form-row pad-top-sm">
                <MaskedSetting
                  label='Proxy for HTTP'
                  setting='httpProxy'
                  help="Enter a HTTP or SOCKS4/5 proxy starting with appropriate prefix from the following (http://, socks4://, socks5://)"
                  placeholder="localhost:8005"
                  disabled={!settings.proxyEnabled}
                />
                <MaskedSetting
                  label='Proxy for HTTPS'
                  setting='httpsProxy'
                  help="Enter a HTTPS or SOCKS4/5 proxy starting with appropriate prefix from the following (https://, socks4://, socks5://)"
                  placeholder="localhost:8005"
                  disabled={!settings.proxyEnabled}
                />
                <TextSetting
                  label="No proxy"
                  setting="noProxy"
                  help="Enter a comma-separated list of hostnames that don’t require a proxy."
                  placeholder="localhost,127.0.0.1"
                  disabled={!settings.proxyEnabled}
                />
              </div>
            </PanelContainer>
          </TabItem>
          <TabItem key="data" title="Data">
            <PanelContainer className="pad">
              <ImportExport hideSettingsModal={() => modalRef.current?.hide()} />
            </PanelContainer>
          </TabItem>
          <TabItem key="themes" title="Themes">
            <PanelContainer className="pad">
              <ThemePanel />
            </PanelContainer>
          </TabItem>
          <TabItem key="keyboard" title="Keyboard">
            <PanelContainer className="pad">
              <Shortcuts />
            </PanelContainer>
          </TabItem>
          <TabItem key="plugins" title="Plugins">
            <PanelContainer className="pad">
              <Plugins />
            </PanelContainer>
          </TabItem>
          <TabItem key="ai" title="AI">
            <PanelContainer className="pad">
              <AI />
            </PanelContainer>
          </TabItem>
        </Tabs>
      </ModalBody>
    </Modal>
  );
});
SettingsModal.displayName = 'SettingsModal';
export const showSettingsModal = (options?: { tab?: string }) => showModal(SettingsModal, options);
