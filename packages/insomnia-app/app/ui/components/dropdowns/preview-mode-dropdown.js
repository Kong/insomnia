// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownDivider, DropdownItem} from '../base/dropdown';
import {getPreviewModeName, PREVIEW_MODES} from '../../../common/constants';
import {trackEvent} from '../../../common/analytics';
import * as plugins from '../../../plugins';
import {matchRegexs} from '../../../common/misc';

type Props = {
  // Functions
  updatePreviewMode: Function,
  download: Function,
  fullDownload: Function,

  // Required
  contentType: string,
  previewMode: string
};

@autobind
class PreviewModeDropdown extends React.PureComponent<Props> {
  _responseViewers: Array<plugins.ResponseViewer>;

  constructor (props: Props) {
    super(props);
    this._responseViewers = [];
  }

  _handleClick (previewMode: string) {
    this.props.updatePreviewMode(previewMode);
    trackEvent('Response', 'Preview Mode Change', previewMode);
  }

  async _loadResponseViewers () {
    this._responseViewers = await plugins.getResponseViewers();
    this.forceUpdate();
  }

  _getPreviewModeName () {
    const {previewMode} = this.props;
    for (const rv of this._responseViewers) {
      if (rv.previewMode === previewMode) {
        return rv.name;
      }
    }

    // Otherwise return internal preview mode name
    return getPreviewModeName(previewMode);
  }

  componentDidMount () {
    this._loadResponseViewers();
  }

  renderPreviewMode (mode: string) {
    const {previewMode} = this.props;
    const children = this.renderPluginPreviewModes(mode);
    return [
      <DropdownItem key={mode} onClick={this._handleClick} value={mode}>
        {previewMode === mode ? <i className="fa fa-check"/> : <i className="fa fa-empty"/>}
        {getPreviewModeName(mode, true)}
      </DropdownItem>,
      ...children
    ];
  }

  renderPluginPreviewModes (parentPreviewMode: string) {
    const {contentType} = this.props;
    return this._responseViewers
      .filter(rv => matchRegexs(contentType, rv.contentType))
      .filter(rv => rv.previewMode.startsWith(`${parentPreviewMode}.`))
      .map(rv => (
        <DropdownItem key={rv.previewMode} onClick={this._handleClick} value={rv.previewMode}>
          {this.props.previewMode === rv.previewMode
            ? <i className="fa fa-check"/>
            : <i className="fa fa-empty"/>
          }
          <span className="space-left">└─ {rv.name}</span>
        </DropdownItem>
      ));
  }

  render () {
    const {download, fullDownload} = this.props;
    return (
      <Dropdown beside>
        <DropdownButton className="tall">
          {this._getPreviewModeName()}
          <i className="fa fa-caret-down space-left"/>
        </DropdownButton>
        <DropdownDivider>Preview Mode</DropdownDivider>
        {PREVIEW_MODES.map(this.renderPreviewMode)}
        <DropdownDivider>Actions</DropdownDivider>
        <DropdownItem onClick={download}>
          <i className="fa fa-save"/>
          Save Response Body
        </DropdownItem>
        <DropdownItem onClick={fullDownload}>
          <i className="fa fa-save"/>
          Save Full Response
        </DropdownItem>
      </Dropdown>
    );
  }
}

export default PreviewModeDropdown;
