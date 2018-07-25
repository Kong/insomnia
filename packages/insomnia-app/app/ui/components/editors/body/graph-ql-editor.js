// @flow
import type { Request } from '../../../../models/request';
import { newBodyRaw } from '../../../../models/request';
import * as React from 'react';
import autobind from 'autobind-decorator';
import { markdownToHTML } from '../../../../common/markdown-to-html';
import {
  parse,
  print,
  typeFromAST,
  type Document as DocumentAST
} from 'graphql';
import { introspectionQuery } from 'graphql/utilities/introspectionQuery';
import { buildClientSchema } from 'graphql/utilities/buildClientSchema';
import type { CodeMirror, TextMarker } from 'codemirror';
import CodeEditor from '../../codemirror/code-editor';
import { jsonParseOr } from '../../../../common/misc';
import HelpTooltip from '../../help-tooltip';
import {
  CONTENT_TYPE_JSON,
  DEBOUNCE_MILLIS
} from '../../../../common/constants';
import prettify from 'insomnia-prettify';
import type { ResponsePatch } from '../../../../network/network';
import * as network from '../../../../network/network';
import type { Workspace } from '../../../../models/workspace';
import type { Settings } from '../../../../models/settings';
import TimeFromNow from '../../time-from-now';
import * as models from '../../../../models/index';
import * as db from '../../../../common/database';
import { showModal } from '../../modals';
import ResponseDebugModal from '../../modals/response-debug-modal';
import Tooltip from '../../tooltip';

type GraphQLBody = {
  query: string,
  variables?: Object,
  operationName?: string
};

type Props = {
  onChange: Function,
  content: string,
  render: Function | null,
  getRenderContext: Function | null,
  request: Request,
  workspace: Workspace,
  settings: Settings,
  environmentId: string,

  // Optional
  className?: string,
  uniquenessKey?: string
};

type State = {
  body: GraphQLBody,
  schema: Object | null,
  schemaFetchError: {
    message: string,
    response: ResponsePatch | null
  } | null,
  schemaLastFetchTime: number,
  schemaIsFetching: boolean,
  hideSchemaFetchErrors: boolean,
  variablesSyntaxError: string,
  forceRefreshKey: number
};

@autobind
class GraphQLEditor extends React.PureComponent<Props, State> {
  _disabledOperationMarkers: TextMarker[];
  _documentAST: null | DocumentAST;
  _isMounted: boolean;
  _queryEditor: null | CodeMirror;
  _schemaFetchTimeout: TimeoutID;

  constructor(props: Props) {
    super(props);
    this._disabledOperationMarkers = [];
    this._documentAST = null;
    this._queryEditor = null;
    this._isMounted = false;
    const body = GraphQLEditor._stringToGraphQL(props.content);
    this.state = {
      body,
      schema: null,
      schemaFetchError: null,
      schemaLastFetchTime: 0,
      schemaIsFetching: false,
      hideSchemaFetchErrors: false,
      variablesSyntaxError: '',
      forceRefreshKey: 0
    };
  }

  _getCurrentOperation(): string | null {
    const { _queryEditor } = this;

    if (!_queryEditor) {
      return this.state.body.operationName || null;
    }

    // Ignore cursor position when editor isn't focused
    if (!_queryEditor.hasFocus()) {
      return this.state.body.operationName || null;
    }

    const operations = this._getOperations();
    const cursor = _queryEditor.getCursor();
    const cursorIndex = _queryEditor.indexFromPos(cursor);

    let operationName = null;
    let allOperationNames = [];

    // Loop through all operations to see if one contains the cursor.
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];

      if (!operation.name) {
        continue;
      }

      allOperationNames.push(operation.name.value);

      const { start, end } = operation.loc;
      if (start <= cursorIndex && end >= cursorIndex) {
        operationName = operation.name.value;
      }
    }

    if (!operationName && operations.length > 0) {
      operationName = this.state.body.operationName || null;
    }

    if (!allOperationNames.includes(operationName)) {
      return null;
    }

    return operationName;
  }

  _handleQueryFocus() {
    this._handleQueryUserActivity();
  }

  _handleQueryUserActivity() {
    const newOperationName = this._getCurrentOperation();

    const { query, variables, operationName } = this.state.body;
    if (newOperationName !== operationName) {
      this._handleBodyChange(query, variables, newOperationName);
    }
  }

  _highlightOperation(operationName: string | null) {
    const { _documentAST, _queryEditor } = this;

    if (!_documentAST || !_queryEditor) {
      return null;
    }

    const disabledDefinitions = _documentAST.definitions.filter(d => {
      const name = d.name ? d.name.value : null;
      return d.kind === 'OperationDefinition' && name !== operationName;
    });

    // Remove current query highlighting
    this._disabledOperationMarkers.forEach(textMarker => textMarker.clear());

    // Add "Unhighlight" markers
    this._disabledOperationMarkers = disabledDefinitions.map(definition => {
      const { startToken, endToken } = definition.loc;

      const from = {
        line: startToken.line - 1,
        ch: startToken.column - 1
      };

      const to = {
        line: endToken.line,
        ch: endToken.column - 1
      };

      return _queryEditor.doc.markText(from, to, {
        className: 'cm-gql-disabled'
      });
    });
  }

  _handleViewResponse() {
    const { schemaFetchError } = this.state;

    if (!schemaFetchError || !schemaFetchError.response) {
      return;
    }

    const { response } = schemaFetchError;

    showModal(ResponseDebugModal, {
      title: 'Introspection Request',
      response: response
    });
  }

  _hideSchemaFetchError() {
    this.setState({ hideSchemaFetchErrors: true });
  }

  _handleQueryEditorInit(codeMirror: CodeMirror) {
    this._queryEditor = codeMirror;
    window.cm = this._queryEditor;
    const { query, variables, operationName } = this.state.body;
    this._handleBodyChange(query, variables, operationName);
  }

  async _fetchAndSetSchema(rawRequest: Request) {
    this.setState({ schemaIsFetching: true });

    const { environmentId } = this.props;

    const newState = {
      schema: this.state.schema,
      schemaFetchError: (null: any),
      schemaLastFetchTime: this.state.schemaLastFetchTime,
      schemaIsFetching: false
    };

    let responsePatch: ResponsePatch | null = null;
    try {
      const bodyJson = JSON.stringify({
        query: introspectionQuery,
        operationName: 'IntrospectionQuery'
      });

      const introspectionRequest = await db.upsert(
        Object.assign({}, rawRequest, {
          _id: rawRequest._id + '.graphql',
          settingMaxTimelineDataSize: 5000,
          parentId: rawRequest._id,
          isPrivate: true, // So it doesn't get synced or exported
          body: newBodyRaw(bodyJson, CONTENT_TYPE_JSON)
        })
      );

      responsePatch = await network.send(
        introspectionRequest._id,
        environmentId
      );
      const bodyBuffer = models.response.getBodyBuffer(responsePatch);

      const status =
        typeof responsePatch.statusCode === 'number'
          ? responsePatch.statusCode
          : 0;
      const error =
        typeof responsePatch.error === 'string' ? responsePatch.error : '';

      if (error) {
        newState.schemaFetchError = {
          message: error,
          response: responsePatch
        };
      } else if (status < 200 || status >= 300) {
        const renderedURL = responsePatch.url || rawRequest.url;
        newState.schemaFetchError = {
          message: `Got status ${status} fetching schema from "${renderedURL}"`,
          response: responsePatch
        };
      } else if (bodyBuffer) {
        const { data } = JSON.parse(bodyBuffer.toString());
        newState.schema = buildClientSchema(data);
        newState.schemaLastFetchTime = Date.now();
      } else {
        newState.schemaFetchError = {
          message: 'No response body received when fetching schema',
          response: responsePatch
        };
      }
    } catch (err) {
      console.warn('Failed to fetch GraphQL schema', err);
      newState.schemaFetchError = {
        message: `Failed to to fetch schema: ${err.message}`,
        response: responsePatch
      };
    }

    if (this._isMounted) {
      this.setState(newState);
    }
  }

  _buildVariableTypes(
    schema: Object | null,
    query: string
  ): { [string]: Object } {
    if (!schema) {
      return {};
    }

    const definitions = this._documentAST ? this._documentAST.definitions : [];
    const variableToType = {};
    for (const { kind, variableDefinitions } of definitions) {
      if (kind !== 'OperationDefinition') {
        continue;
      }

      if (!variableDefinitions) {
        continue;
      }

      for (const { variable, type } of variableDefinitions) {
        const inputType = typeFromAST(schema, type);
        if (!inputType) {
          continue;
        }
        variableToType[variable.name.value] = inputType;
      }
    }
    return variableToType;
  }

  async _handleRefreshSchema(): Promise<void> {
    await this._fetchAndSetSchema(this.props.request);
  }

  _handlePrettify() {
    const { body, forceRefreshKey } = this.state;
    const { variables, query } = body;
    const prettyQuery = query && print(parse(query));
    const prettyVariables =
      variables && JSON.parse(prettify.json(JSON.stringify(variables)));
    this._handleBodyChange(
      prettyQuery,
      prettyVariables,
      this.state.body.operationName
    );
    setTimeout(() => {
      this.setState({ forceRefreshKey: forceRefreshKey + 1 });
    }, 200);
  }

  _getOperations() {
    if (!this._documentAST) {
      return [];
    }

    return this._documentAST.definitions.filter(
      def => def.kind === 'OperationDefinition'
    );
  }

  _handleBodyChange(
    query: string,
    variables: ?Object,
    operationName: ?string
  ): void {
    try {
      this._documentAST = parse(query);
    } catch (e) {
      this._documentAST = null;
    }

    const body: GraphQLBody = { query };

    if (variables) {
      body.variables = variables;
    }

    if (operationName) {
      body.operationName = operationName;
    }

    this.setState({
      variablesSyntaxError: '',
      body
    });

    this.props.onChange(GraphQLEditor._graphQLToString(body));
    this._highlightOperation(body.operationName || null);
  }

  _handleQueryChange(query: string): void {
    const currentOperation = this._getCurrentOperation();
    this._handleBodyChange(query, this.state.body.variables, currentOperation);
  }

  _handleVariablesChange(variables: string): void {
    try {
      const variablesObj = JSON.parse(variables || 'null');
      this._handleBodyChange(
        this.state.body.query,
        variablesObj,
        this.state.body.operationName
      );
    } catch (err) {
      this.setState({ variablesSyntaxError: err.message });
    }
  }

  static _stringToGraphQL(text: string): GraphQLBody {
    let obj: GraphQLBody;
    try {
      obj = JSON.parse(text);
    } catch (err) {
      obj = { query: '' };
    }

    if (typeof obj.variables === 'string') {
      obj.variables = jsonParseOr(obj.variables, '');
    }

    const query = obj.query || '';
    const variables = obj.variables || null;
    const operationName = obj.operationName || null;

    const body: GraphQLBody = { query };

    if (variables) {
      body.variables = variables;
    }

    if (operationName) {
      body.operationName = operationName;
    }

    return body;
  }

  static _graphQLToString(body: GraphQLBody): string {
    return JSON.stringify(body);
  }

  componentWillReceiveProps(nextProps: Props) {
    if (nextProps.request.modified !== this.props.request.modified) {
      clearTimeout(this._schemaFetchTimeout);
      this._schemaFetchTimeout = setTimeout(async () => {
        await this._fetchAndSetSchema(nextProps.request);
      }, 2000);
    }
  }

  componentDidMount() {
    this._isMounted = true;
    (async () => {
      await this._fetchAndSetSchema(this.props.request);
    })();
  }

  componentWillUnmount() {
    this._isMounted = false;
    clearTimeout(this._schemaFetchTimeout);
  }

  renderSelectedOperationName() {
    const { operationName } = this.state.body;
    if (!operationName) {
      return null;
    } else {
      return <span title="Current operationName">{operationName}</span>;
    }
  }

  renderSchemaFetchMessage() {
    let message;
    const { schemaLastFetchTime, schemaIsFetching } = this.state;
    if (schemaIsFetching) {
      message = 'fetching schema...';
    } else if (schemaLastFetchTime > 0) {
      message = (
        <span>
          schema fetched <TimeFromNow timestamp={schemaLastFetchTime} />
        </span>
      );
    } else {
      message = <span>schema not yet fetched</span>;
    }

    return message;
  }

  render() {
    const {
      content,
      render,
      getRenderContext,
      settings,
      className,
      uniquenessKey
    } = this.props;

    const {
      schema,
      schemaFetchError,
      hideSchemaFetchErrors,
      variablesSyntaxError,
      forceRefreshKey,
      schemaIsFetching
    } = this.state;

    const {
      query,
      variables: variablesObject
    } = GraphQLEditor._stringToGraphQL(content);

    const variables = prettify.json(JSON.stringify(variablesObject));

    const variableTypes = this._buildVariableTypes(schema, query);

    return (
      <div key={forceRefreshKey} className="graphql-editor">
        <div className="graphql-editor__query">
          <CodeEditor
            dynamicHeight
            manualPrettify
            uniquenessKey={
              uniquenessKey ? uniquenessKey + '::query' : undefined
            }
            hintOptions={{
              schema: schema || null,
              completeSingle: false
            }}
            infoOptions={{
              schema: schema || null,
              renderDescription: text => {
                const html = markdownToHTML(text);
                return `<div class="markdown-preview__content">${html}</div>`;
              }
              // onClick: reference => console.log('CLICK', reference)
            }}
            // jumpOptions={{
            //   schema: schema || null,
            //   onClick: reference => console.log('JUMP', reference)
            // }}
            lintOptions={schema ? { schema } : null}
            fontSize={settings.editorFontSize}
            indentSize={settings.editorIndentSize}
            keyMap={settings.editorKeyMap}
            defaultValue={query}
            className={className}
            onChange={this._handleQueryChange}
            onCodeMirrorInit={this._handleQueryEditorInit}
            onCursorActivity={this._handleQueryUserActivity}
            onFocus={this._handleQueryFocus}
            mode="graphql"
            lineWrapping={settings.editorLineWrapping}
            placeholder=""
          />
        </div>
        <div className="graphql-editor__schema-error">
          {!hideSchemaFetchErrors &&
            schemaFetchError && (
              <div className="notice error margin no-margin-top margin-bottom-sm">
                <div className="pull-right">
                  <Tooltip
                    position="top"
                    message="View introspection request/response timeline">
                    <button
                      className="icon icon--success"
                      onClick={this._handleViewResponse}>
                      <i className="fa fa-bug" />
                    </button>
                  </Tooltip>{' '}
                  <button className="icon" onClick={this._hideSchemaFetchError}>
                    <i className="fa fa-times" />
                  </button>
                </div>
                {schemaFetchError.message}
                <br />
              </div>
            )}
        </div>
        <div className="graphql-editor__meta">
          <div className="graphql-editor__schema-notice">
            {this.renderSchemaFetchMessage()}
            {!schemaIsFetching && (
              <button
                className="icon space-left"
                onClick={this._handleRefreshSchema}>
                <i className="fa fa-refresh" />
              </button>
            )}
          </div>
          <div className="graphql-editor__operation-name">
            {this.renderSelectedOperationName()}
          </div>
        </div>
        <h2 className="no-margin pad-left-sm pad-top-sm pad-bottom-sm">
          Query Variables{' '}
          <HelpTooltip>
            Variables to use in GraphQL query <br />(JSON format)
          </HelpTooltip>
          {variablesSyntaxError && (
            <span className="text-danger italic pull-right">
              {variablesSyntaxError}
            </span>
          )}
        </h2>
        <div className="graphql-editor__variables">
          <CodeEditor
            dynamicHeight
            uniquenessKey={
              uniquenessKey ? uniquenessKey + '::variables' : undefined
            }
            debounceMillis={DEBOUNCE_MILLIS * 4}
            manualPrettify={false}
            fontSize={settings.editorFontSize}
            indentSize={settings.editorIndentSize}
            keyMap={settings.editorKeyMap}
            defaultValue={variables}
            className={className}
            render={render}
            getRenderContext={getRenderContext}
            getAutocompleteConstants={() => Object.keys(variableTypes || {})}
            lintOptions={{
              variableToType: variableTypes
            }}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            onChange={this._handleVariablesChange}
            mode="graphql-variables"
            lineWrapping={settings.editorLineWrapping}
            placeholder=""
          />
        </div>
        <div className="pane__footer">
          <button
            className="pull-right btn btn--compact"
            onClick={this._handlePrettify}>
            Prettify GraphQL
          </button>
        </div>
      </div>
    );
  }
}

export default GraphQLEditor;
