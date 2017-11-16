// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../../key-value-editor/editor';
import {trackEvent} from '../../../../analytics/index';
import type {RequestBodyParameter} from '../../../../models/request';
import Wrap from '../../wrap';

type Props = {
  onChange: Function,
  parameters: Array<RequestBodyParameter>,
  inheritedParameters: Array<RequestBodyParameter> | null,
  nunjucksPowerUserMode: boolean,

  // Optional
  handleRender: ?Function,
  handleGetRenderContext: ?Function
}

@autobind
class UrlEncodedEditor extends React.PureComponent<Props> {
  _handleTrackToggle (pair: RequestBodyParameter) {
    trackEvent(
      'Url Encoded Editor',
      'Toggle',
      pair.disabled ? 'Disable' : 'Enable'
    );
  }

  _handleTrackCreate () {
    trackEvent('Url Encoded Editor', 'Create');
  }

  _handleTrackDelete () {
    trackEvent('Url Encoded Editor', 'Delete');
  }

  render () {
    const {
      parameters,
      inheritedParameters,
      onChange,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode
    } = this.props;

    return (
      <div className="scrollable-container tall wide">
        <div className="scrollable">
          <div className="pad-top">
            {inheritedParameters && inheritedParameters.length ? (
              <Wrap>
                <label key="label" className="label--small pad-left">
                  Inherited Items
                  <div className="bubble space-left">
                    {inheritedParameters.filter(p => !p.disabled).length}
                  </div>
                </label>
                <KeyValueEditor
                  useKey
                  disabled
                  readOnly
                  sortable
                  allowMultiline
                  namePlaceholder="name"
                  valuePlaceholder="value"
                  handleRender={handleRender}
                  handleGetRenderContext={handleGetRenderContext}
                  nunjucksPowerUserMode={nunjucksPowerUserMode}
                  pairs={inheritedParameters}
                />
              </Wrap>
            ) : null}
            {inheritedParameters && inheritedParameters.length ? (
              <label className="label--small pad-left pad-top">
                Items
                <div className="bubble space-left">
                  {parameters.filter(p => !p.disabled).length}
                </div>
              </label>
            ) : null}
            <KeyValueEditor
              sortable
              allowMultiline
              namePlaceholder="name"
              valuePlaceholder="value"
              className="pad-bottom"
              onChange={onChange}
              handleRender={handleRender}
              handleGetRenderContext={handleGetRenderContext}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              onToggleDisable={this._handleTrackToggle}
              onCreate={this._handleTrackCreate}
              onDelete={this._handleTrackDelete}
              pairs={parameters}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default UrlEncodedEditor;
