// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import {Dropdown, DropdownButton, DropdownDivider, DropdownItem} from '../base/dropdown';
import {getPreviewModeName, PREVIEW_MODES} from '../../../common/constants';
import {trackEvent} from '../../../common/analytics';
import * as plugins from '../../../plugins';

type Props = {
  // Functions
  updatePreviewMode: Function,
  download: Function,
  fullDownload: Function,

  // Required
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
      if (rv.key === previewMode) {
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
    return (
      <DropdownItem key={mode} onClick={this._handleClick} value={mode}>
        {previewMode === mode ? <i className="fa fa-check"/> : <i className="fa fa-empty"/>}
        {getPreviewModeName(mode, true)}
      </DropdownItem>
    );
  }

  renderPluginPreviewModes () {
    return this._responseViewers.map(rv => (
      <DropdownItem key={rv.key} onClick={this._handleClick} value={rv.key}>
        {this.props.previewMode === rv.key
          ? <i className="fa fa-check"/>
          : <i className="fa fa-empty"/>
        }
        {rv.name}
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
        {this.renderPluginPreviewModes()}
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
