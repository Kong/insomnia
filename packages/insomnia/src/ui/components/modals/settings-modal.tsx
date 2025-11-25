import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-aria-components';

import { AI_PLUGIN_NAME } from '~/common/constants';
import { getBundlePlugins } from '~/plugins';
import { useRootLoaderData } from '~/root';
import { AISettings } from '~/ui/components/settings/ai-settings';

import { getAppVersion, getProductName } from '../../../common/constants';
import { Modal, type ModalHandle, type ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { BooleanSetting } from '../settings/boolean-setting';
import { CloudServiceCredentialList } from '../settings/cloud-service-credentials';
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
export const TAB_CLOUD_CREDENTIAL = 'cloudCred';

export const SettingsModal = forwardRef<SettingsModalHandle, ModalProps>((props, ref) => {
  const [defaultTabKey, setDefaultTabKey] = useState('general');
  const { userSession, settings } = useRootLoaderData()!;
  const modalRef = useRef<ModalHandle>(null);
  const [keyboardClosable, setKeyboardClosable] = useState(true);

  const [shouldShowAiSettingsTab, setShouldShowAiSettingsTab] = useState(false);

  useEffect(() => {
    const checkAiPlugin = async () => {
      const plugins = await getBundlePlugins();
      const aiPlugin = plugins.find(p => p.name === AI_PLUGIN_NAME);
      setShouldShowAiSettingsTab(!!aiPlugin && !!userSession.id);
    };
    checkAiPlugin();
  }, [userSession.id]);

  useImperativeHandle(
    ref,
    () => ({
      hide: () => {
        modalRef.current?.hide();
      },
      show: options => {
        setDefaultTabKey(options?.tab || 'general');
        modalRef.current?.show();
      },
    }),
    [],
  );

  return (
    <Modal className="z-10!" ref={modalRef} tall keyboardClosable={keyboardClosable} {...props}>
      <ModalHeader>
        {getProductName()} Preferences
        <span className="faint txt-sm">
          &nbsp;&nbsp;–&nbsp; v{getAppVersion()}
          {userSession.id && userSession.email ? ` – ${userSession.email}` : null}
        </span>
      </ModalHeader>
      <ModalBody noScroll>
        <Tabs
          selectedKey={defaultTabKey}
          onSelectionChange={key => {
            setDefaultTabKey(key.toString());
          }}
          aria-label="Settings"
          className="flex h-full w-full flex-1 flex-col"
        >
          <TabList
            className="flex h-(--line-height-sm) w-full shrink-0 items-center overflow-x-auto border-b border-solid border-b-(--hl-md) bg-(--color-bg)"
            aria-label="Request pane tabs"
          >
            <Tab
              className="flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="general"
            >
              General
            </Tab>
            <Tab
              className="flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="proxy"
            >
              Proxy
            </Tab>
            <Tab
              className="flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="data"
            >
              Data
            </Tab>
            <Tab
              className="flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="themes"
            >
              Themes
            </Tab>
            <Tab
              className="flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="keyboard"
            >
              Keyboard
            </Tab>
            <Tab
              className="flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="plugins"
            >
              Plugins
            </Tab>
            <Tab
              className="flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
              id="cloudCred"
            >
              Cloud Credentials
            </Tab>
            {shouldShowAiSettingsTab && (
              <Tab
                className="flex h-full shrink-0 cursor-pointer select-none items-center justify-between gap-2 px-3 py-1 text-(--hl) outline-hidden transition-colors duration-300 hover:bg-(--hl-sm) hover:text-(--color-font) focus:bg-(--hl-sm) aria-selected:bg-(--hl-xs) aria-selected:text-(--color-font) aria-selected:hover:bg-(--hl-sm) aria-selected:focus:bg-(--hl-sm)"
                id="aiSettings"
              >
                AI Settings
              </Tab>
            )}
          </TabList>
          <TabPanel className="h-full w-full overflow-y-auto" id="general">
            <General />
          </TabPanel>
          <TabPanel className="h-full w-full overflow-y-auto p-4" id="proxy">
            <h2 className="sticky left-0 top-0 z-10 bg-(--color-bg) pb-2 pt-2 text-lg font-bold">Network Proxy</h2>

            <BooleanSetting
              label="Enable proxy"
              setting="proxyEnabled"
              help="If checked, enables a global network proxy on all requests sent through Insomnia. This proxy supports Basic Auth, digest, and NTLM authentication."
            />

            <div className="form-row pad-top-sm">
              <MaskedSetting
                label="Proxy for HTTP"
                setting="httpProxy"
                help="Enter a HTTP or SOCKS4/5 proxy starting with appropriate prefix from the following (http://, socks4://, socks5://)"
                placeholder="localhost:8005"
                disabled={!settings.proxyEnabled}
              />
              <MaskedSetting
                label="Proxy for HTTPS"
                setting="httpsProxy"
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
          <TabPanel className="h-full w-full overflow-y-auto p-4" id="data">
            <ImportExport
              hideSettingsModal={() => modalRef.current?.hide()}
              onModalChange={(isOpen: boolean) => setKeyboardClosable(!isOpen)}
            />
          </TabPanel>
          <TabPanel className="h-full w-full overflow-y-auto p-4" id="themes">
            <ThemePanel />
          </TabPanel>
          <TabPanel className="h-full w-full overflow-y-auto p-4" id="keyboard">
            <Shortcuts />
          </TabPanel>
          <TabPanel className="h-full w-full overflow-y-auto p-4" id="plugins">
            <Plugins />
          </TabPanel>
          <TabPanel className="h-full w-full overflow-y-auto p-4" id="cloudCred">
            <CloudServiceCredentialList />
          </TabPanel>
          {shouldShowAiSettingsTab && (
            <TabPanel className="relative h-full w-full overflow-y-auto p-4" id="aiSettings">
              <AISettings />
            </TabPanel>
          )}
        </Tabs>
      </ModalBody>
    </Modal>
  );
});
SettingsModal.displayName = 'SettingsModal';
export const showSettingsModal = (options?: { tab?: string }) => showModal(SettingsModal, options);
