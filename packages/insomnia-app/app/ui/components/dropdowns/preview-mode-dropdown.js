// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG, getPreviewModeName, PREVIEW_MODES } from '../../../common/constants';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../base/dropdown';

type Props = {|
  downloadFilteredResponse: () => any,
  download: (pretty: boolean) => any,
  fullDownload: (pretty: boolean) => any,
  updatePreviewMode: string => any,
  previewMode: string,
  showPrettifyOption?: boolean,
|};

@autoBindMethodsForReact(AUTOBIND_CFG)
class PreviewModeDropdown extends React.PureComponent<Props> {
  async _handleClick(previewMode: string) {
    const { updatePreviewMode } = this.props;
    await updatePreviewMode(previewMode);
  }

  async _handleDownloadPrettify() {
    const { download } = this.props;
    download(true);
  }

  async _handleDownloadNormal() {
    const { download } = this.props;
    download(false);
  }

  async _handleFilteredResponse() {
    const { downloadFilteredResponse } = this.props;
    downloadFilteredResponse();
  }

  renderPreviewMode(mode: string) {
    const { previewMode } = this.props;
    return (
      <DropdownItem key={mode} onClick={this._handleClick} value={mode}>
        {previewMode === mode ? <i className="fa fa-check" /> : <i className="fa fa-empty" />}
        {getPreviewModeName(mode, true)}
      </DropdownItem>
    );
  }

  render() {
    const { fullDownload, previewMode, showPrettifyOption } = this.props;

    return (
      <Dropdown beside>
        <DropdownButton className="tall">
          {getPreviewModeName(previewMode)}
          <i className="fa fa-caret-down space-left" />
        </DropdownButton>
        <DropdownDivider>Preview Mode</DropdownDivider>
        {PREVIEW_MODES.map(this.renderPreviewMode)}
        <DropdownDivider>Actions</DropdownDivider>
        <DropdownItem onClick={this._handleDownloadNormal}>
          <i className="fa fa-save" />
          Save Raw Response
        </DropdownItem>
        <DropdownItem onClick={this._handleFilteredResponse}>
          <i className="fa fa-save" />
          Save Filtered Response
        </DropdownItem>
        {showPrettifyOption && (
          <DropdownItem onClick={this._handleDownloadPrettify}>
            <i className="fa fa-save" />
            Save Prettified Response
          </DropdownItem>
        )}
        <DropdownItem onClick={fullDownload}>
          <i className="fa fa-bug" />
          Save HTTP Debug
        </DropdownItem>
      </Dropdown>
    );
  }
}

export default PreviewModeDropdown;
