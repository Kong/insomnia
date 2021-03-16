// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { ApiSpec } from '../../../models/api-spec';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import CodeEditor from '../codemirror/code-editor';
import type { Settings } from '../../../models/settings';
import Notice from '../notice';
import CopyButton from '../base/copy-button';
import ModalFooter from '../base/modal-footer';
import type { ConfigGenerator } from '../../../plugins';
import * as plugins from '../../../plugins';
import { parseApiSpec } from '../../../common/api-specs';

type Props = {|
  settings: Settings,
|};

type Config = {|
  label: string,
  content: string,
  mimeType: string,
  error: string | null,
|};

type State = {|
  configs: Array<Config>,
  activeTab: number,
|};

@autobind
class GenerateConfigModal extends React.PureComponent<Props, State> {
  modal: ?Modal;

  constructor(props: Props) {
    super(props);
    this.state = {
      configs: [],
      activeTab: 0,
    };
  }

  _setModalRef(n: ?Modal) {
    this.modal = n;
  }

  async _generate(generatePlugin: ConfigGenerator, apiSpec: ApiSpec): Promise<Config> {
    const config: Config = {
      content: '',
      mimeType: 'text/yaml',
      label: generatePlugin.label,
      error: null,
    };

    let result;
    try {
      result = await generatePlugin.generate(parseApiSpec(apiSpec.contents));
    } catch (err) {
      config.error = err.message;
      return config;
    }

    config.content = result.document || null;
    config.error = result.error || null;

    return config;
  }

  async show(options: { apiSpec: ApiSpec }) {
    const configs = [];

    for (const p of await plugins.getConfigGenerators()) {
      configs.push(await this._generate(p, options.apiSpec));
    }

    this.setState({ configs });

    this.modal && this.modal.show();
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
          onChange={this._handleChange}
          readOnly
        />
      </TabPanel>
    );
  }

  _handleTabSelect(index: number) {
    this.setState({ activeTab: index });
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

export default GenerateConfigModal;
