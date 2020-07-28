// @flow
import classnames from 'classnames';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import autobind from 'autobind-decorator';
import { markdownToHTML } from '../../../../common/markdown-to-html';
import type { GraphQLArgument, GraphQLField, GraphQLSchema, GraphQLType } from 'graphql';
import { parse, print, typeFromAST } from 'graphql';
import { introspectionQuery } from 'graphql/utilities/introspectionQuery';
import { buildClientSchema } from 'graphql/utilities/buildClientSchema';
import type { CodeMirror, TextMarker } from 'codemirror';
import CodeEditor from '../../codemirror/code-editor';
import { jsonParseOr } from '../../../../common/misc';
import HelpTooltip from '../../help-tooltip';
import { CONTENT_TYPE_JSON, DEBOUNCE_MILLIS } from '../../../../common/constants';
import prettify from 'insomnia-prettify';
import type { ResponsePatch } from '../../../../network/network';
import * as network from '../../../../network/network';
import type { Workspace } from '../../../../models/workspace';
import type { Settings } from '../../../../models/settings';
import TimeFromNow from '../../time-from-now';
import * as models from '../../../../models/index';
import * as db from '../../../../common/database';
import { showModal } from '../../modals';
import type { Request } from '../../../../models/request';
import { newBodyRaw } from '../../../../models/request';
import ResponseDebugModal from '../../modals/response-debug-modal';
import Tooltip from '../../tooltip';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../../base/dropdown';
import GraphqlExplorer from '../../graph-ql-explorer/graph-ql-explorer';

const explorerContainer = document.querySelector('#graphql-explorer-container');
if (!explorerContainer) {
  throw new Error('Failed to find #graphql-explorer-container');
}

type GraphQLBody = {
  query: string,
  variables?: Object,
  operationName?: string,
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
  isVariableUncovered: boolean,
  // Optional
  className?: string,
  uniquenessKey?: string,
};

type State = {
  body: GraphQLBody,
  schema: GraphQLSchema | null,
  schemaFetchError: {
    message: string,
    response: ResponsePatch | null,
  } | null,
  schemaLastFetchTime: number,
  schemaIsFetching: boolean,
  hideSchemaFetchErrors: boolean,
  variablesSyntaxError: string,
  automaticFetch: boolean,
  explorerVisible: boolean,
  activeReference: null | {
    type: GraphQLType | null,
    argument: GraphQLArgument | null,
    field: GraphQLField<any, any> | null,
  },
};

@autobind
class GraphQLEditor extends React.PureComponent<Props, State> {
  _disabledOperationMarkers: Array<TextMarker>;
  _documentAST: null | Object;
  _isMounted: boolean;
  _queryEditor: null | CodeMirror;
  _schemaFetchTimeout: TimeoutID;

  constructor(props: Props) {
    super(props);
    this._disabledOperationMarkers = [];
    this._queryEditor = null;
    this._isMounted = false;

    const body = GraphQLEditor._stringToGraphQL(props.content);
    this._setDocumentAST(body.query);

    let automaticFetch;
    try {
      automaticFetch = JSON.parse(window.localStorage.getItem('graphql.automaticFetch'));
    } catch (err) {
      automaticFetch = true;
    }

    this.state = {
      body,
      schema: null,
      schemaFetchError: null,
      schemaLastFetchTime: 0,
      schemaIsFetching: false,
      hideSchemaFetchErrors: false,
      variablesSyntaxError: '',
      activeReference: null,
      explorerVisible: false,
      automaticFetch,
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
    const allOperationNames = [];

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

  _handleCloseExplorer() {
    this.setState({ explorerVisible: false });
  }

  _handleClickReference(reference: Object, e: MouseEvent) {
    e.preventDefault();
    this.setState({ explorerVisible: true, activeReference: reference });
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
    for (const textMarker of this._disabledOperationMarkers) {
      textMarker.clear();
    }

    // Add "Unhighlight" markers
    this._disabledOperationMarkers = disabledDefinitions.map(definition => {
      const { startToken, endToken } = definition.loc;

      const from = {
        line: startToken.line - 1,
        ch: startToken.column - 1,
      };

      const to = {
        line: endToken.line,
        ch: endToken.column - 1,
      };

      return _queryEditor.doc.markText(from, to, {
        className: 'cm-gql-disabled',
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
      title: 'GraphQL Introspection Response',
      response: response,
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
      schemaIsFetching: false,
    };

    let responsePatch: ResponsePatch | null = null;
    try {
      const bodyJson = JSON.stringify({
        query: introspectionQuery,
        operationName: 'IntrospectionQuery',
      });

      const introspectionRequest = await db.upsert(
        Object.assign({}, rawRequest, {
          _id: rawRequest._id + '.graphql',
          settingMaxTimelineDataSize: 5000,
          parentId: rawRequest._id,
          isPrivate: true, // So it doesn't get synced or exported
          body: newBodyRaw(bodyJson, CONTENT_TYPE_JSON),
        }),
      );

      responsePatch = await network.send(introspectionRequest._id, environmentId);
      const bodyBuffer = models.response.getBodyBuffer(responsePatch);

      const status = typeof responsePatch.statusCode === 'number' ? responsePatch.statusCode : 0;
      const error = typeof responsePatch.error === 'string' ? responsePatch.error : '';

      if (error) {
        newState.schemaFetchError = {
          message: error,
          response: responsePatch,
        };
      } else if (status < 200 || status >= 300) {
        const renderedURL = responsePatch.url || rawRequest.url;
        newState.schemaFetchError = {
          message: `Got status ${status} fetching schema from "${renderedURL}"`,
          response: responsePatch,
        };
      } else if (bodyBuffer) {
        const { data } = JSON.parse(bodyBuffer.toString());
        newState.schema = buildClientSchema(data);
        newState.schemaLastFetchTime = Date.now();
      } else {
        newState.schemaFetchError = {
          message: 'No response body received when fetching schema',
          response: responsePatch,
        };
      }
    } catch (err) {
      console.log('[graphql] ERROR: Failed to fetch schema', err);
      newState.schemaFetchError = {
        message: `Failed to fetch schema: ${err.message}`,
        response: responsePatch,
      };
    }

    if (this._isMounted) {
      this.setState(newState);
    }
  }

  _buildVariableTypes(schema: Object | null): { [string]: Object } | null {
    if (!schema) {
      return null;
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

  _handleShowDocumentation() {
    this.setState({
      explorerVisible: true,
    });
  }

  _handleRefreshSchema() {
    // First, "forget" preference to hide errors so they always show
    // again after a refresh
    this.setState({ hideSchemaFetchErrors: false }, async () => {
      await this._fetchAndSetSchema(this.props.request);
    });
  }

  async _handleToggleAutomaticFetching(): Promise<void> {
    const automaticFetch = !this.state.automaticFetch;
    this.setState({ automaticFetch });
    window.localStorage.setItem('graphql.automaticFetch', automaticFetch);
  }

  _handlePrettify() {
    const { body } = this.state;
    const { variables, query } = body;
    const prettyQuery = query && print(parse(query));
    const prettyVariables = variables && JSON.parse(prettify.json(JSON.stringify(variables)));
    this._handleBodyChange(prettyQuery, prettyVariables, this.state.body.operationName);

    // Update editor contents
    if (this._queryEditor) {
      this._queryEditor.setValue(prettyQuery);
    }
  }

  _getOperations(): Array<any> {
    if (!this._documentAST) {
      return [];
    }

    return this._documentAST.definitions.filter(def => def.kind === 'OperationDefinition');
  }

  _setDocumentAST(query: string) {
    try {
      this._documentAST = parse(query);
    } catch (e) {
      this._documentAST = null;
    }
  }

  _handleBodyChange(query: string, variables: ?Object, operationName: ?string): void {
    this._setDocumentAST(query);

    const body: GraphQLBody = { query };

    if (variables) {
      body.variables = variables;
    }

    if (operationName) {
      body.operationName = operationName;
    }

    // Find op if there isn't one yet
    if (!body.operationName) {
      const newOperationName = this._getCurrentOperation();
      if (newOperationName) {
        body.operationName = newOperationName;
      }
    }

    const newContent = GraphQLEditor._graphQLToString(body);

    this.setState({
      variablesSyntaxError: '',
      body,
    });

    this.props.onChange(newContent);
    this._highlightOperation(body.operationName || null);
  }

  _handleQueryChange(query: string): void {
    // Since we're editing the query, we may be changing the operation name, so
    // Don't pass it to the body change in order to automatically re-detect it
    // based on the current cursor position.
    this._handleBodyChange(query, this.state.body.variables, null);
  }

  _handleVariablesChange(variables: string): void {
    try {
      const variablesObj = JSON.parse(variables || 'null');
      this._handleBodyChange(this.state.body.query, variablesObj, this.state.body.operationName);
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

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (this.state.automaticFetch && nextProps.request.url !== this.props.request.url) {
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

  static renderMarkdown(text: string) {
    const html = markdownToHTML(text);
    return `<div class="markdown-preview__content">${html}</div>`;
  }

  render() {
    const {
      content,
      render,
      getRenderContext,
      settings,
      className,
      uniquenessKey,
      isVariableUncovered,
    } = this.props;

    const {
      schema,
      schemaFetchError,
      hideSchemaFetchErrors,
      variablesSyntaxError,
      schemaIsFetching,
      automaticFetch,
      activeReference,
      explorerVisible,
    } = this.state;

    const { query, variables: variablesObject } = GraphQLEditor._stringToGraphQL(content);

    const variables = prettify.json(JSON.stringify(variablesObject));

    const variableTypes = this._buildVariableTypes(schema);

    // Create portal for GraphQL Explorer
    const graphQLExplorerPortal = ReactDOM.createPortal(
      <GraphqlExplorer
        schema={schema}
        visible={explorerVisible}
        reference={activeReference}
        handleClose={this._handleCloseExplorer}
      />,
      explorerContainer,
    );

    return (
      <div className="graphql-editor">
        <Dropdown right className="graphql-editor__schema-dropdown margin-bottom-xs">
          <DropdownButton className="space-left btn btn--micro btn--outlined">
            schema <i className="fa fa-wrench" />
          </DropdownButton>
          <DropdownDivider>GraphQL Schema</DropdownDivider>
          <DropdownItem onClick={this._handleShowDocumentation} disabled={!schema}>
            <i className="fa fa-file-code-o" /> Show Documentation
          </DropdownItem>
          <DropdownItem onClick={this._handleRefreshSchema} stayOpenAfterClick>
            <i className={'fa fa-refresh ' + (schemaIsFetching ? 'fa-spin' : '')} /> Refresh Schema
          </DropdownItem>
          <DropdownItem onClick={this._handleToggleAutomaticFetching} stayOpenAfterClick>
            <i
              className={classnames('fa', {
                'fa-toggle-on': automaticFetch,
                'fa-toggle-off': !automaticFetch,
              })}
            />{' '}
            Automatic Fetch
            <HelpTooltip>Automatically fetch schema when request URL is modified</HelpTooltip>
          </DropdownItem>
        </Dropdown>
        <div className="graphql-editor__query">
          <CodeEditor
            dynamicHeight
            manualPrettify
            uniquenessKey={uniquenessKey ? uniquenessKey + '::query' : undefined}
            hintOptions={{
              schema: schema || null,
              completeSingle: false,
            }}
            infoOptions={{
              schema: schema || null,
              renderDescription: GraphQLEditor.renderMarkdown,
              onClick: this._handleClickReference,
            }}
            jumpOptions={{
              schema: schema || null,
              onClick: this._handleClickReference,
            }}
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
          {!hideSchemaFetchErrors && schemaFetchError && (
            <div className="notice error margin no-margin-top margin-bottom-sm">
              <div className="pull-right">
                <Tooltip position="top" message="View introspection request/response timeline">
                  <button className="icon icon--success" onClick={this._handleViewResponse}>
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
          {this.renderSchemaFetchMessage()}
          <div className="graphql-editor__operation-name">{this.renderSelectedOperationName()}</div>
        </div>
        <h2 className="no-margin pad-left-sm pad-top-sm pad-bottom-sm">
          Query Variables
          <HelpTooltip className="space-left">
            Variables to use in GraphQL query <br />
            (JSON format)
          </HelpTooltip>
          {variablesSyntaxError && (
            <span className="text-danger italic pull-right">{variablesSyntaxError}</span>
          )}
        </h2>
        <div className="graphql-editor__variables">
          <CodeEditor
            dynamicHeight
            uniquenessKey={uniquenessKey ? uniquenessKey + '::variables' : undefined}
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
            lintOptions={{ variableToType: variableTypes }}
            noLint={!variableTypes}
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            isVariableUncovered={isVariableUncovered}
            onChange={this._handleVariablesChange}
            mode="graphql-variables"
            lineWrapping={settings.editorLineWrapping}
            placeholder=""
          />
        </div>
        <div className="pane__footer">
          <button className="pull-right btn btn--compact" onClick={this._handlePrettify}>
            Prettify GraphQL
          </button>
        </div>

        {graphQLExplorerPortal}
      </div>
    );
  }
}

export default GraphQLEditor;
