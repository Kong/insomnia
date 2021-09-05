import { autoBindMethodsForReact } from 'class-autobind-decorator';
import classnames from 'classnames';
import { EditorFromTextArea, TextMarker } from 'codemirror';
import electron, { OpenDialogOptions } from 'electron';
import { readFileSync } from 'fs';
import { GraphQLSchema } from 'graphql';
import { parse, print, typeFromAST } from 'graphql';
import { buildClientSchema, getIntrospectionQuery } from 'graphql/utilities';
import { json as jsonPrettify } from 'insomnia-prettify';
import React, { PureComponent } from 'react';
import ReactDOM from 'react-dom';

import { AUTOBIND_CFG, CONTENT_TYPE_JSON, DEBOUNCE_MILLIS } from '../../../../common/constants';
import { database as db } from '../../../../common/database';
import { markdownToHTML } from '../../../../common/markdown-to-html';
import { jsonParseOr } from '../../../../common/misc';
import { HandleGetRenderContext, HandleRender } from '../../../../common/render';
import * as models from '../../../../models/index';
import type { Request } from '../../../../models/request';
import { newBodyRaw } from '../../../../models/request';
import type { Settings } from '../../../../models/settings';
import type { Workspace } from '../../../../models/workspace';
import type { ResponsePatch } from '../../../../network/network';
import * as network from '../../../../network/network';
import { Dropdown, DropdownButton, DropdownDivider, DropdownItem } from '../../base/dropdown';
import CodeEditor from '../../codemirror/code-editor';
import GraphqlExplorer from '../../graph-ql-explorer/graph-ql-explorer';
import { ActiveReference } from '../../graph-ql-explorer/graph-ql-types';
import HelpTooltip from '../../help-tooltip';
import { showModal } from '../../modals';
import ResponseDebugModal from '../../modals/response-debug-modal';
import TimeFromNow from '../../time-from-now';
import Tooltip from '../../tooltip';
const explorerContainer = document.querySelector('#graphql-explorer-container');

if (!explorerContainer) {
  throw new Error('Failed to find #graphql-explorer-container');
}

interface GraphQLBody {
  query: string;
  variables?: Record<string, any>;
  operationName?: string;
}

interface Props {
  onChange: Function;
  content: string;
  render?: HandleRender;
  getRenderContext?: HandleGetRenderContext;
  request: Request;
  workspace: Workspace;
  settings: Settings;
  environmentId: string;
  isVariableUncovered: boolean;
  className?: string;
  uniquenessKey?: string;
}

interface State {
  body: GraphQLBody;
  schema: GraphQLSchema | null;
  schemaFetchError: {
    message: string;
    response: ResponsePatch | null;
  } | null;
  schemaLastFetchTime: number;
  schemaIsFetching: boolean;
  hideSchemaFetchErrors: boolean;
  variablesSyntaxError: string;
  automaticFetch: boolean;
  explorerVisible: boolean;
  activeReference: null | ActiveReference;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class GraphQLEditor extends PureComponent<Props, State> {
  _disabledOperationMarkers: TextMarker[] = [];
  _documentAST: null | Record<string, any> = null;
  _isMounted = false;
  _queryEditor: null | EditorFromTextArea = null;
  _schemaFetchTimeout: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);

    const body = GraphQLEditor._stringToGraphQL(props.content);
    this._setDocumentAST(body.query);
    let automaticFetch;

    try {
      // @ts-expect-error -- TSCONVERSION don't parse if the read item is not defined
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

    let operationName: string | null = null;
    const allOperationNames: (string | null)[] = [];

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
    this.setState({
      explorerVisible: false,
    });
  }

  _handleClickReference(reference: ActiveReference, event: React.MouseEvent) {
    event.preventDefault();
    this.setState({
      explorerVisible: true,
      activeReference: reference,
    });
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
      // @ts-expect-error - doc doesn't exist, use getDoc()
      return _queryEditor.doc.markText(from, to, {
        className: 'cm-gql-disabled',
      });
    });

    return null;
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
    this.setState({
      hideSchemaFetchErrors: true,
    });
  }

  _handleQueryEditorInit(codeMirror: EditorFromTextArea) {
    this._queryEditor = codeMirror;
    // @ts-expect-error -- TSCONVERSION window.cm doesn't exist
    window.cm = this._queryEditor;
    const { query, variables, operationName } = this.state.body;

    this._handleBodyChange(query, variables, operationName);
  }

  async _fetchAndSetSchema(rawRequest: Request) {
    this.setState({
      schemaIsFetching: true,
    });
    const { environmentId } = this.props;
    const newState = {
      schema: this.state.schema,
      schemaFetchError: null as any,
      schemaLastFetchTime: this.state.schemaLastFetchTime,
      schemaIsFetching: false,
    };
    let responsePatch: ResponsePatch | null = null;

    try {
      const bodyJson = JSON.stringify({
        query: getIntrospectionQuery(),
        operationName: 'IntrospectionQuery',
      });
      const introspectionRequest = await db.upsert(
        Object.assign({}, rawRequest, {
          _id: rawRequest._id + '.graphql',
          settingMaxTimelineDataSize: 5000,
          parentId: rawRequest._id,
          isPrivate: true,
          // So it doesn't get synced or exported
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

  async _loadAndSetLocalSchema() {
    const options: OpenDialogOptions = {
      title: 'Import GraphQL introspection schema',
      buttonLabel: 'Import',
      properties: ['openFile'],
      filters: [
        // @ts-expect-error https://github.com/electron/electron/pull/29322
        {
          extensions: ['', 'json'],
        },
      ],
    };

    const { canceled, filePaths } = await electron.remote.dialog.showOpenDialog(options);

    if (canceled) {
      return;
    }

    try {
      const filePath = filePaths[0]; // showOpenDialog is single select
      const file = readFileSync(filePath);

      const content = JSON.parse(file.toString());
      if (!content.data) {
        throw new Error('JSON file should have a data field with the introspection results');
      }

      if (!this._isMounted) {
        return;
      }
      this.setState({
        schema: buildClientSchema(content.data),
        schemaLastFetchTime: Date.now(),
        schemaFetchError: null,
        schemaIsFetching: false,
      });
    } catch (err) {
      console.log('[graphql] ERROR: Failed to fetch schema', err);
      if (!this._isMounted) {
        return;
      }
      this.setState({
        schemaFetchError: {
          message: `Failed to fetch schema: ${err.message}`,
          response: null,
        },
        schemaIsFetching: false,
      });
    }
  }

  _buildVariableTypes(
    schema: Record<string, any> | null,
  ): Record<string, Record<string, any>> | null {
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
        // @ts-expect-error -- TSCONVERSION
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
    this.setState(
      {
        hideSchemaFetchErrors: false,
      },
      async () => {
        await this._fetchAndSetSchema(this.props.request);
      },
    );
  }

  _handleSetLocalSchema() {
    this.setState({ hideSchemaFetchErrors: false }, this._loadAndSetLocalSchema);
  }

  async _handleToggleAutomaticFetching() {
    const automaticFetch = !this.state.automaticFetch;
    this.setState({
      automaticFetch,
    });
    // @ts-expect-error -- TSCONVERSION convert boolean to string when setting
    window.localStorage.setItem('graphql.automaticFetch', automaticFetch);
  }

  _handlePrettify() {
    const { body } = this.state;
    const { variables, query } = body;
    const prettyQuery = query && print(parse(query));
    const prettyVariables = variables && JSON.parse(jsonPrettify(JSON.stringify(variables)));

    this._handleBodyChange(prettyQuery, prettyVariables, this.state.body.operationName);

    // Update editor contents
    if (this._queryEditor) {
      this._queryEditor.setValue(prettyQuery);
    }
  }

  _getOperations(): any[] {
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

  _handleBodyChange(
    query: string,
    variables?: Record<string, any> | null,
    operationName?: string | null,
  ) {
    this._setDocumentAST(query);

    const body: GraphQLBody = {
      query,
    };

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

  _handleQueryChange(query: string) {
    // Since we're editing the query, we may be changing the operation name, so
    // Don't pass it to the body change in order to automatically re-detect it
    // based on the current cursor position.
    this._handleBodyChange(query, this.state.body.variables, null);
  }

  _handleVariablesChange(variables: string) {
    try {
      const variablesObj = JSON.parse(variables || 'null');

      this._handleBodyChange(this.state.body.query, variablesObj, this.state.body.operationName);
    } catch (err) {
      this.setState({
        variablesSyntaxError: err.message,
      });
    }
  }

  static _stringToGraphQL(text: string): GraphQLBody {
    let obj: GraphQLBody;

    try {
      obj = JSON.parse(text);
    } catch (err) {
      obj = {
        query: '',
      };
    }

    if (typeof obj.variables === 'string') {
      obj.variables = jsonParseOr(obj.variables, '');
    }

    const query = obj.query || '';
    const variables = obj.variables || null;
    const operationName = obj.operationName || null;
    const body: GraphQLBody = {
      query,
    };

    if (variables) {
      body.variables = variables;
    }

    if (operationName) {
      body.operationName = operationName;
    }

    return body;
  }

  static _graphQLToString(body: GraphQLBody) {
    return JSON.stringify(body);
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (this.state.automaticFetch && nextProps.request.url !== this.props.request.url) {
      if (this._schemaFetchTimeout !== null) {
        clearTimeout(this._schemaFetchTimeout);
      }
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
    if (this._schemaFetchTimeout !== null) {
      clearTimeout(this._schemaFetchTimeout);
    }
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
      schemaLastFetchTime,
    } = this.state;

    const { query, variables: variablesObject } = GraphQLEditor._stringToGraphQL(content);

    const variables = jsonPrettify(JSON.stringify(variablesObject));

    const variableTypes = this._buildVariableTypes(schema);

    // Create portal for GraphQL Explorer
    const graphQLExplorerPortal = ReactDOM.createPortal(
      <GraphqlExplorer
        schema={schema}
        key={schemaLastFetchTime}
        visible={explorerVisible}
        reference={activeReference}
        handleClose={this._handleCloseExplorer}
      />,
      // @ts-expect-error -- TSCONVERSION
      explorerContainer,
    );
    return (
      <div className="graphql-editor">
        <Dropdown right className="graphql-editor__schema-dropdown margin-bottom-xs">

          <DropdownButton className="space-left btn btn--micro btn--outlined">
            schema <i className="fa fa-wrench" />
          </DropdownButton>

          <DropdownItem onClick={this._handleShowDocumentation} disabled={!schema}>
            <i className="fa fa-file-code-o" /> Show Documentation
          </DropdownItem>

          <DropdownDivider>Remote GraphQL Schema</DropdownDivider>

          <DropdownItem onClick={this._handleRefreshSchema} stayOpenAfterClick>
            <i className={classnames('fa', 'fa-refresh', { 'fa-spin': schemaIsFetching })} /> Refresh Schema
          </DropdownItem>
          <DropdownItem onClick={this._handleToggleAutomaticFetching} stayOpenAfterClick>
            <i className={`fa fa-toggle-${automaticFetch ? 'on' : 'off'}`} />{' '}
            Automatic Fetch
            <HelpTooltip>Automatically fetch schema when request URL is modified</HelpTooltip>
          </DropdownItem>

          <DropdownDivider>Local GraphQL Schema</DropdownDivider>

          <DropdownItem onClick={this._handleSetLocalSchema}>
            <i className="fa fa-file-code-o" /> Load schema from JSON
            <HelpTooltip>
              Run <i>apollo-codegen introspect-schema schema.graphql --output schema.json</i> to
              convert GraphQL DSL to JSON.
            </HelpTooltip>
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
            lintOptions={
              schema
                ? {
                  schema,
                }
                : undefined
            }
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
            lintOptions={{
              variableToType: variableTypes,
            }}
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
