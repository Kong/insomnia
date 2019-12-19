// @flow

import * as React from 'react';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../key-value-editor/editor';
import CodeEditor from '../codemirror/code-editor';
import type { Request, RequestParameter } from '../../../models/request';

type Props = {
  onChange: (r: Request, parameters: Array<RequestParameter>) => Promise<Request>,
  bulk: boolean,
  editorFontSize: number,
  editorIndentSize: number,
  editorLineWrapping: boolean,
  nunjucksPowerUserMode: boolean,
  isVariableUncovered: boolean,
  handleRender: Function,
  handleGetRenderContext: Function,
  request: Request,
};

@autobind
class RequestParametersEditor extends React.PureComponent<Props> {
  _handleBulkUpdate(paramsString: string) {
    const { onChange, request } = this.props;
    const params = RequestParametersEditor._getParamsFromString(paramsString);

    onChange(request, params);
  }

  _handleKeyValueUpdate(parameters: Array<RequestParameter>) {
    const { onChange, request } = this.props;
    onChange(request, parameters);
  }

  static _getParamsFromString(paramsString: string) {
    const params = [];
    const rows = paramsString.split(/\n+/);

    for (const row of rows) {
      const [rawName, rawValue] = row.split(/:(.*)$/);

      const name = (rawName || '').trim();
      const value = (rawValue || '').trim();

      if (!name && !value) {
        continue;
      }

      params.push({ name, value });
    }

    return params;
  }

  _getQueriesString() {
    const { parameters } = this.props.request;

    let paramsString = '';

    for (const param of parameters) {
      // Make sure it's not disabled
      if (param.disabled) {
        continue;
      }

      // Make sure it's not blank
      if (!param.name && !param.value) {
        continue;
      }

      paramsString += `${param.name}: ${param.value}\n`;
    }

    return paramsString;
  }

  render() {
    const {
      bulk,
      request,
      editorFontSize,
      editorIndentSize,
      editorLineWrapping,
      handleRender,
      handleGetRenderContext,
      nunjucksPowerUserMode,
      isVariableUncovered,
    } = this.props;

    return bulk ? (
      <CodeEditor
        getRenderContext={handleGetRenderContext}
        render={handleRender}
        nunjucksPowerUserMode={nunjucksPowerUserMode}
        isVariableUncovered={isVariableUncovered}
        fontSize={editorFontSize}
        indentSize={editorIndentSize}
        lineWrapping={editorLineWrapping}
        onChange={this._handleBulkUpdate}
        defaultValue={this._getQueriesString()}
      />
    ) : (
      <KeyValueEditor
        sortable
        namePlaceholder="name"
        valuePlaceholder="value"
        descriptionPlaceholder="description"
        pairs={request.parameters}
        nunjucksPowerUserMode={nunjucksPowerUserMode}
        isVariableUncovered={isVariableUncovered}
        handleRender={handleRender}
        handleGetRenderContext={handleGetRenderContext}
        onChange={this._handleKeyValueUpdate}
      />
    );
  }
}

export default RequestParametersEditor;
