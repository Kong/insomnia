import React, { forwardRef, Key, useImperativeHandle, useRef, useState } from 'react';

import { parseApiSpec } from '../../../common/api-specs';
import type { ApiSpec } from '../../../models/api-spec';
import type { ConfigGenerator } from '../../../plugins';
import * as plugins from '../../../plugins';
import { CopyButton } from '../base/copy-button';
import { Link } from '../base/link';
import { type ModalHandle, Modal, ModalProps } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { PanelContainer, TabItem, Tabs } from '../base/tabs';
import { CodeEditor } from '../codemirror/code-editor';
import { HelpTooltip } from '../help-tooltip';
import { showModal } from './index';

interface Config {
  label: string;
  docsLink?: string;
  content: string;
  mimeType: string;
  error: string | null;
}

interface State {
  configs: Config[];
  activeTab: number;
}

interface GenerateConfigModalOptions {
  apiSpec: ApiSpec;
  activeTabLabel: string;
}
export interface GenerateConfigModalHandle {
  show: (options: GenerateConfigModalOptions) => void;
  hide: () => void;
}
export const GenerateConfigModal = forwardRef<GenerateConfigModalHandle, ModalProps>((_, ref) => {
  const modalRef = useRef<ModalHandle>(null);
  const [state, setState] = useState<State>({
    configs: [],
    activeTab: 0,
  });

  useImperativeHandle(ref, () => ({
    hide: () => {
      modalRef.current?.hide();
    },
    show: async options => {
      const configs: Config[] = [];
      for (const p of await plugins.getConfigGenerators()) {
        configs.push(await generateConfig(p, options.apiSpec));
      }
      const foundIndex = configs.findIndex(c => c.label === options.activeTabLabel);
      setState({
        configs,
        activeTab: foundIndex < 0 ? 0 : foundIndex,
      });
      modalRef.current?.show();
    },
  }), []);

  const generateConfig = async (generatePlugin: ConfigGenerator, apiSpec: ApiSpec): Promise<Config> => {
    try {
      const result = await generatePlugin.generate(parseApiSpec(apiSpec.contents));
      return {
        content: result.document || '',
        mimeType: 'text/yaml',
        label: generatePlugin.label,
        docsLink: generatePlugin.docsLink,
        error: result.error || null,
      };
    } catch (err) {
      return {
        content: '',
        mimeType: 'text/yaml',
        label: generatePlugin.label,
        docsLink: generatePlugin.docsLink,
        error: err.message,
      };
    }
  };

  const onSelect = (key: Key) => {
    setState({
      configs,
      activeTab: configs.findIndex(c => c.label === key),
    });
  };
  const { configs, activeTab } = state;
  const activeConfig = configs[activeTab];
  return (
    <Modal ref={modalRef} tall>
      <ModalHeader>Generate Config</ModalHeader>
      <ModalBody className="wide">
        <Tabs
          aria-label="General configuration tabs"
          defaultSelectedKey={activeTab}
          onSelectionChange={onSelect}
        >
          {configs.map(config =>
            (<TabItem
              key={config.label}
              title={
                <>
                  {config.label}
                  {config.docsLink ?
                    <>
                      {' '}
                      <HelpTooltip>
                        To learn more about {config.label}
                        <br />
                        <Link href={config.docsLink}>Documentation {<i className="fa fa-external-link-square" />}</Link>
                      </HelpTooltip>
                    </> : null}
                </>
              }
            >
              <PanelContainer key={config.label}>
                {config.error ?
                  <p className="notice error margin-md">
                    {config.error}
                    {config.docsLink ? <><br /><Link href={config.docsLink}>Documentation {<i className="fa fa-external-link-square" />}</Link></> : null}
                  </p> :
                  <CodeEditor
                    className="tall pad-top-sm"
                    defaultValue={config.content}
                    mode={config.mimeType}
                    readOnly
                  />}
              </PanelContainer>
            </TabItem>)
          )}
        </Tabs>
      </ModalBody>
      {activeConfig && (
        <ModalFooter>
          <CopyButton className="btn" content={activeConfig.content}>
            Copy to Clipboard
          </CopyButton>
        </ModalFooter>
      )}
    </Modal>
  );
});
GenerateConfigModal.displayName = 'GenerateConfigModal';

export const showGenerateConfigModal = (opts: GenerateConfigModalOptions) => showModal(GenerateConfigModal, opts);
