// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import Modal from '../base/modal';
import ModalBody from '../base/modal-body';
import ModalHeader from '../base/modal-header';
import type { ApiSpec } from '../../../models/api-spec';
import { Tab, TabList, TabPanel, Tabs } from 'react-tabs';
import { generateFromString } from 'openapi-2-kong';
import CodeEditor from '../codemirror/code-editor';
import YAML from 'yaml';
import type { Settings } from '../../../models/settings';
import Notice from '../notice';
import CopyButton from '../base/copy-button';
import ModalFooter from '../base/modal-footer';

type Props = {|
  settings: Settings,
|};

type Config = {|
  label: string,
  content: string,
  mimeType: string,
  error?: Error,
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

  async _generate(apiSpec: ApiSpec, label: string, type: string): Promise<Config> {
    const config: Config = {
      content: '',
      mimeType: 'text/yaml',
      label,
    };

    try {
      const result = await generateFromString(apiSpec.contents, type);
      config.content = YAML.stringify(result.document);
    } catch (err) {
      config.error = err;
    }

    return config;
  }

  async show(options: {apiSpec: ApiSpec}) {
    const configs = await Promise.all([
      this._generate(options.apiSpec, 'Declarative Config', 'kong-declarative-config'),
      this._generate(options.apiSpec, 'Kong for Kubernetes', 'kong-for-kubernetes'),
    ]);

    this.setState({ configs });

    this.modal && this.modal.show();
  }

  renderConfigTabPanel(config: Config) {
    const { settings } = this.props;

    if (config.error) {
      return (
        <TabPanel key={config.label}>
          <Notice color="error" className="margin-md">
            {config.error.message}
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

  renderConfigTab(config: Config, index: number) {
    return (
      <Tab key={config.label} tabIndex="-1">
        <button>
          {config.label}
        </button>
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
            <TabList>
              {configs.map(this.renderConfigTab)}
            </TabList>
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
