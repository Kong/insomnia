import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { getAppVersion, getProductName } from '../../../common/constants';
import { useRootLoaderData } from '../../routes/root';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
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
        <Tabs
          selectedKey={defaultTabKey}
          onSelectionChange={key => {
            setDefaultTabKey(key.toString());
          }}
          aria-label='Settings'
          className="flex-1 w-full h-full flex flex-col"
        >
          <TabList className='w-full flex-shrink-0  overflow-x-auto border-solid scro border-b border-b-[--hl-md] bg-[--color-bg] flex items-center h-[--line-height-sm]' aria-label='Request pane tabs'>
            <Tab
              className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
              id='general'
            >
              General
            </Tab>
            <Tab
              className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
              id='proxy'
            >
              Proxy
            </Tab>
            <Tab
              className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
              id='data'
            >
              Data
            </Tab>
            <Tab
              className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
              id='themes'
            >
              Themes
            </Tab>
            <Tab
              className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
              id='keyboard'
            >
              Keyboard
            </Tab>
            <Tab
              className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
              id='plugins'
            >
              Plugins
            </Tab>
            <Tab
              className='flex-shrink-0 h-full flex items-center justify-between cursor-pointer gap-2 outline-none select-none px-3 py-1 text-[--hl] aria-selected:text-[--color-font]  hover:bg-[--hl-sm] hover:text-[--color-font] aria-selected:bg-[--hl-xs] aria-selected:focus:bg-[--hl-sm] aria-selected:hover:bg-[--hl-sm] focus:bg-[--hl-sm] transition-colors duration-300'
              id='ai'
            >
              AI
            </Tab>
          </TabList>
          <TabPanel className='w-full h-full overflow-y-auto' id='general'>
            <General />
          </TabPanel>
          <TabPanel className='w-full h-full overflow-y-auto p-4' id='proxy'>
            <h2 className='font-bold pt-2 pb-2 text-lg sticky top-0 left-0 bg-[--color-bg] z-10'>Network Proxy</h2>

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
                help="Enter a comma-separated list of hostnames that do not require a proxy. To include all subdomains of a domain, prefix it with a dot (e.g., .example.com)."
                placeholder="localhost,127.0.0.1"
                disabled={!settings.proxyEnabled}
              />
            </div>
          </TabPanel>
          <TabPanel className='w-full h-full overflow-y-auto p-4' id='data'>
            <ImportExport hideSettingsModal={() => modalRef.current?.hide()} />
          </TabPanel>
          <TabPanel className='w-full h-full overflow-y-auto p-4' id='themes'>
            <ThemePanel />
          </TabPanel>
          <TabPanel className='w-full h-full overflow-y-auto p-4' id='keyboard'>
            <Shortcuts />
          </TabPanel>
          <TabPanel className='w-full h-full overflow-y-auto p-4' id='plugins'>
            <Plugins />
          </TabPanel>
          <TabPanel className='w-full h-full overflow-y-auto p-4' id='ai'>
            <AI />
          </TabPanel>
        </Tabs>

      </ModalBody>
    </Modal>
  );
});
SettingsModal.displayName = 'SettingsModal';
export const showSettingsModal = (options?: { tab?: string }) => showModal(SettingsModal, options);
