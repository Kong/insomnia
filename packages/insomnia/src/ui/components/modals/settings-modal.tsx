import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { useFetcher } from 'react-router-dom';

import * as session from '../../../account/session';
import { getAppVersion, getProductName } from '../../../common/constants';
import { useRootLoaderData } from '../../routes/root';
import { Modal, type ModalHandle, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalHeader } from '../base/modal-header';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { Account } from '../settings/account';
import { AI } from '../settings/ai';
import { General } from '../settings/general';
import { ImportExport } from '../settings/import-export';
import { Plugins } from '../settings/plugins';
import { Shortcuts } from '../settings/shortcuts';
import { ThemePanel } from '../settings/theme-panel';
import { Button } from '../themed-button';
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

const Dev = () => {
  const { env } = useRootLoaderData();
  const { Form } = useFetcher();

  return (
    <Form action="/dev" method="POST" className="flex flex-col gap-3 w-full p-2">
      <label className="flex text-sm flex-col gap-2">
        <span className="text-[--color-font]">API Url</span>
        <input
          className="py-2 w-full px-4 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
          name="apiURL"
          type="url"
          required
          placeholder='https://api.insomnia.rest'
          defaultValue={env.apiURL || ''}
        />
      </label>
      <label className="flex text-sm flex-col gap-2">
        <span className="text-[--color-font]">Website Url</span>
        <input
          required
          className="py-2 w-full px-4 rounded-sm border border-solid border-[--hl-sm] bg-[--color-bg] text-[--color-font] focus:outline-none focus:ring-1 focus:ring-[--hl-md] transition-colors"
          name="websiteURL"
          type="url"
          placeholder='https://app.insomnia.rest'
          defaultValue={env.websiteURL || ''}
        />
      </label>
      <div className='flex justify-end'>
        <Button type="submit" className="px-4 py-1 bg-[#4000BF] flex items-center justify-center gap-2 aria-pressed:bg-opacity-90 focus:bg-opacity-90 font-semibold rounded-sm text-[--color-font-surprise] focus:ring-inset ring-1 ring-transparent focus:ring-[--hl-md] transition-all text-sm">
          Save
        </Button>
      </div>
    </Form>
  );
};

export const SettingsModal = forwardRef<SettingsModalHandle, ModalProps>((props, ref) => {
  const [defaultTabKey, setDefaultTabKey] = useState('general');
  const modalRef = useRef<ModalHandle>(null);
  const email = session.isLoggedIn() ? session.getFullName() : null;

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
    <Modal ref={modalRef} tall {...props}>
      <ModalHeader>
        {getProductName()} Preferences
        <span className="faint txt-sm">
          &nbsp;&nbsp;–&nbsp; v{getAppVersion()}
          {email ? ` – ${email}` : null}
        </span>
      </ModalHeader>
      <ModalBody noScroll>
        <Tabs aria-label="Insomnia Settings"  defaultSelectedKey={defaultTabKey}>
          <TabItem key="general" title="General">
            <PanelContainer className="pad">
              <General />
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
          <TabItem key="account" title="Account">
            <PanelContainer className="pad">
              <Account />
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
          <TabItem key="dev" title="Dev">
            <Dev />
          </TabItem>
        </Tabs>
      </ModalBody>
    </Modal>
  );
});
SettingsModal.displayName = 'SettingsModal';
export const showSettingsModal = () => showModal(SettingsModal);
