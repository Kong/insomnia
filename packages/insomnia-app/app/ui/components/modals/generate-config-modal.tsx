import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';

import { parseApiSpec } from '../../../common/api-specs';
import { AUTOBIND_CFG } from '../../../common/constants';
import type { ApiSpec } from '../../../models/api-spec';
import type { Settings } from '../../../models/settings';
import type { ConfigGenerator } from '../../../plugins';
import * as plugins from '../../../plugins';
import { CopyButton } from '../base/copy-button';
import { Modal } from '../base/modal';
import { ModalBody } from '../base/modal-body';
import { ModalFooter } from '../base/modal-footer';
import { ModalHeader } from '../base/modal-header';
import { CodeEditor } from '../codemirror/code-editor';
import { Notice } from '../notice';
import { showModal } from './index';

interface Props {
  settings: Settings;
}

interface Config {
  label: string;
  content: string;
  mimeType: string;
  error: string | null;
}

interface State {
  configs: Config[];
  activeTab: number;
}

interface ShowOptions {
  apiSpec: ApiSpec;
  activeTabLabel: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class GenerateConfigModal extends PureComponent<Props, State> {
  modal: Modal | null = null;

  state: State = {
    configs: [],
    activeTab: 0,
  };

  _setModalRef(n: Modal) {
    this.modal = n;
  }

  async _generate(generatePlugin: ConfigGenerator, apiSpec: ApiSpec) {
    const config: Config = {
      content: '',
      mimeType: 'text/yaml',
      label: generatePlugin.label,
      error: null,
    };
    let result;

    try {
      // @ts-expect-error -- TSCONVERSION
      result = await generatePlugin.generate(parseApiSpec(apiSpec.contents));
    } catch (err) {
      config.error = err.message;
      return config;
    }

    config.content = result.document || null;
    config.error = result.error || null;
    return config;
  }

  async show({ activeTabLabel, apiSpec }: ShowOptions) {
    const configs: Config[] = [];

    for (const p of await plugins.getConfigGenerators()) {
      configs.push(await this._generate(p, apiSpec));
    }

    const foundIndex = configs.findIndex(c => c.label === activeTabLabel);
    this.setState({
      configs,
      activeTab: foundIndex < 0 ? 0 : foundIndex,
    });
    this.modal?.show();
  }

  renderConfigTabPanel(config: Config) {
    const { settings } = this.props;

    if (config.error) {
      return (
        <TabPanel key={config.label}>
          <Notice color="error" className="margin-md">
            {config.error}
          </Notice>
        </TabPanel>
      );
    }

    return (
      <TabPanel key={config.label}>
        <CodeEditor
          className="tall pad-top-sm"
          defaultValue={config.content}
          fontSize={settings.editorFontSize}
          indentSize={settings.editorIndentSize}
          keyMap={settings.editorKeyMap}
          lineWrapping={settings.editorLineWrapping}
          mode={config.mimeType}
          nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
          readOnly
        />
      </TabPanel>
    );
  }

  _handleTabSelect(index: number) {
    this.setState({
      activeTab: index,
    });
  }

  renderConfigTab(config: Config) {
    return (
      <Tab key={config.label} tabIndex="-1">
        <button>{config.label}</button>
      </Tab>
    );
  }

  render() {
    const { configs, activeTab } = this.state;
    const activeConfig = configs[activeTab];
    return (
      <Modal ref={this._setModalRef} freshState tall>
        <ModalHeader>Generate Config</ModalHeader>
        <ModalBody className="wide">
          <Tabs forceRenderTabPanel defaultIndex={activeTab} onSelect={this._handleTabSelect}>
            <TabList>{configs.map(this.renderConfigTab)}</TabList>
            {configs.map(this.renderConfigTabPanel)}
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
  }
}

export const showGenerateConfigModal = (opts: ShowOptions) => showModal(GenerateConfigModal, opts);
