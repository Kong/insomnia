// @flow

import * as React from 'react';
import autobind from 'autobind-decorator';
import KeyValueEditor from '../key-value-editor/editor';
import CodeEditor from '../codemirror/code-editor';
import type { Request, RequestPathParameter } from '../../../models/request';

type Props = {
  onChange: (r: Request, pathParameters: Array<RequestPathParameter>) => Promise<Request>,
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
class RequestPathParametersEditor extends React.PureComponent<Props> {
  _handleBulkUpdate(pathParamsString: string) {
    const { onChange, request } = this.props;
    const pathParams = RequestPathParametersEditor._getPathParamsFromString(pathParamsString);

    onChange(request, pathParams);
  }

  _handleKeyValueUpdate(pathParameters: Array<RequestPathParameter>) {
    const { onChange, request } = this.props;
    onChange(request, pathParameters);
  }

  static _getPathParamsFromString(pathParamsString: string) {
    const pathParams = [];
    const rows = pathParamsString.split(/\n+/);

    for (const row of rows) {
      const [rawName, rawValue] = row.split(/:(.*)$/);

      const name = (rawName || '').trim();
      const value = (rawValue || '').trim();

      if (!name && !value) {
        continue;
      }

      pathParams.push({ name, value });
    }

    return pathParams;
  }

  _getPathParamsString() {
    const { pathParameters } = this.props.request;

    let pathParamsString = '';

    for (const pathParam of pathParameters) {
      // Make sure it's not disabled
      if (pathParam.disabled) {
        continue;
      }

      // Make sure it's not blank
      if (!pathParam.name && !pathParam.value) {
        continue;
      }

      pathParamsString += `${pathParam.name}: ${pathParam.value}\n`;
    }

    return pathParamsString;
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
        defaultValue={this._getPathParamsString()}
      />
    ) : (
      <KeyValueEditor
        sortable
        allowMultiline
        namePlaceholder="name"
        valuePlaceholder="value"
        descriptionPlaceholder="description"
        pairs={request.pathParameters}
        nunjucksPowerUserMode={nunjucksPowerUserMode}
        isVariableUncovered={isVariableUncovered}
        handleRender={handleRender}
        handleGetRenderContext={handleGetRenderContext}
        onChange={this._handleKeyValueUpdate}
      />
    );
  }
}

export default RequestPathParametersEditor;
