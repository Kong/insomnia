import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { HandleGetRenderContext, HandleRender } from '../../../common/render';
import type { Request, RequestParameter } from '../../../models/request';
import { CodeEditor } from '../codemirror/code-editor';
import { KeyValueEditor } from '../key-value-editor/key-value-editor';

interface Props {
  onChange: (r: Request, parameters: RequestParameter[]) => Promise<Request>;
  bulk: boolean;
  isVariableUncovered: boolean;
  handleRender: HandleRender;
  handleGetRenderContext: HandleGetRenderContext;
  request: Request;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class RequestParametersEditor extends PureComponent<Props> {
  _handleBulkUpdate(paramsString: string) {
    const { onChange, request } = this.props;

    const params = RequestParametersEditor._getParamsFromString(paramsString);

    onChange(request, params);
  }

  _handleKeyValueUpdate(parameters: RequestParameter[]) {
    const { onChange, request } = this.props;
    onChange(request, parameters);
  }

  static _getParamsFromString(paramsString: string) {
    const params: { name: string; value: string }[] = [];
    const rows = paramsString.split(/\n+/);

    for (const row of rows) {
      const [rawName, rawValue] = row.split(/:(.*)$/);
      const name = (rawName || '').trim();
      const value = (rawValue || '').trim();

      if (!name && !value) {
        continue;
      }

      params.push({
        name,
        value,
      });
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
      handleRender,
      handleGetRenderContext,
      isVariableUncovered,
    } = this.props;
    return bulk ? (
      <CodeEditor
        getRenderContext={handleGetRenderContext}
        render={handleRender}
        isVariableUncovered={isVariableUncovered}
        onChange={this._handleBulkUpdate}
        defaultValue={this._getQueriesString()}
      />
    ) : (
      <KeyValueEditor
        sortable
        allowMultiline
        namePlaceholder="name"
        valuePlaceholder="value"
        descriptionPlaceholder="description"
        pairs={request.parameters}
        isVariableUncovered={isVariableUncovered}
        handleRender={handleRender}
        handleGetRenderContext={handleGetRenderContext}
        onChange={this._handleKeyValueUpdate}
      />
    );
  }
}
