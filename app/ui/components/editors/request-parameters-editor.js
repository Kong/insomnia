// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../key-value-editor/editor';
import {trackEvent} from '../../../analytics/index';
import type {RequestParameter} from '../../../models/request';
import Wrap from '../wrap';

type Props = {
  onChange: Function,
  nunjucksPowerUserMode: boolean,
  handleRender: Function,
  handleGetRenderContext: Function,
  parameters: Array<RequestParameter>,
  inheritedParameters: Array<RequestParameter> | null
};

@autobind
class RequestParametersEditor extends React.PureComponent<Props> {
  _handleTrackToggle (pair: RequestParameter) {
    trackEvent('Parameters Editor', 'Toggle', pair.disabled ? 'Disable' : 'Enable');
  }

  _handleTrackCreate () {
    trackEvent('Parameters Editor', 'Create');
  }

  _handleTrackDelete () {
    trackEvent('Parameters Editor', 'Delete');
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
      <div className="pad-top-sm">
        {inheritedParameters && inheritedParameters.length ? (
          <Wrap>
            <label key="label" className="label--small pad-left">
              Inherited Parameters
              <div className="bubble space-left">
                {inheritedParameters.filter(p => !p.disabled).length}
              </div>
            </label>
            <KeyValueEditor
              useKey
              sortable
              disabled
              readOnly
              namePlaceholder="name"
              valuePlaceholder="value"
              pairs={inheritedParameters}
              nunjucksPowerUserMode={nunjucksPowerUserMode}
              handleRender={handleRender}
              handleGetRenderContext={handleGetRenderContext}
            />
          </Wrap>
        ) : null}

        {inheritedParameters && inheritedParameters.length ? (
          <label className="label--small pad-left pad-top">
            Parameters
            <div className="bubble space-left">
              {parameters.filter(p => !p.disabled).length}
            </div>
          </label>
        ) : null}

        <KeyValueEditor
          sortable
          namePlaceholder="name"
          valuePlaceholder="value"
          className="no-pad"
          pairs={parameters}
          nunjucksPowerUserMode={nunjucksPowerUserMode}
          handleRender={handleRender}
          handleGetRenderContext={handleGetRenderContext}
          onToggleDisable={this._handleTrackToggle}
          onCreate={this._handleTrackCreate}
          onDelete={this._handleTrackDelete}
          onChange={onChange}
        />
      </div>
    );
  }
}

export default RequestParametersEditor;
