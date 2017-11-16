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
  inheritedParameters: Array<RequestBodyParameter>,
  nunjucksPowerUserMode: boolean,
  handleRender: Function | null,
  handleGetRenderContext: Function | null
};

@autobind
class FormEditor extends React.PureComponent<Props> {
  _handleTrackToggle (pair: RequestBodyParameter) {
    trackEvent(
      'Form Editor',
      `Toggle ${pair.type || 'text'}`,
      pair.disabled ? 'Disable' : 'Enable'
    );
  }

  _handleTrackChangeType (type: string) {
    trackEvent('Form Editor', 'Change Type', type);
  }

  _handleTrackChooseFile () {
    trackEvent('Form Editor', 'Choose File');
  }

  _handleTrackCreate () {
    trackEvent('Form Editor', 'Create');
  }

  _handleTrackDelete () {
    trackEvent('Form Editor', 'Delete');
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
                  Inherited Parts
                  <div className="bubble space-left">
                    {inheritedParameters.filter(p => !p.disabled).length}
                  </div>
                </label>
                <KeyValueEditor
                  useKey
                  sortable
                  readOnly
                  disabled
                  allowFile
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
                Parts
                <div className="bubble space-left">
                  {parameters.filter(p => !p.disabled).length}
                </div>
              </label>
            ) : null}
            <KeyValueEditor
              sortable
              allowFile
              allowMultiline
              className="pad-bottom"
              namePlaceholder="name"
              valuePlaceholder="value"
              handleRender={handleRender}
              handleGetRenderContext={handleGetRenderContext}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              onToggleDisable={this._handleTrackToggle}
              onChangeType={this._handleTrackChangeType}
              onChooseFile={this._handleTrackChooseFile}
              onCreate={this._handleTrackCreate}
              onDelete={this._handleTrackDelete}
              onChange={onChange}
              pairs={parameters}
            />
          </div>
        </div>
      </div>
    );
  }
}

export default FormEditor;
