// @flow
import type { Request } from '../../../../models/request';
import { newBodyRaw } from '../../../../models/request';
import classnames from 'classnames';
import * as React from 'react';
import autobind from 'autobind-decorator';
import { parse, print, typeFromAST, type Document as DocumentAST } from 'graphql';
import { introspectionQuery } from 'graphql/utilities/introspectionQuery';
import { buildClientSchema } from 'graphql/utilities/buildClientSchema';
import type {CodeMirror, TextMarker} from 'codemirror';
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
import WrapperModal from '../../modals/wrapper-modal';
import ResponseTimelineViewer from '../../viewers/response-timeline-viewer';
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
  _documentAST: null | DocumentAST
  _isMounted: boolean;
  _queryEditor: null | CodeMirror;
  _schemaFetchTimeout: TimeoutID;

  constructor(props: Props) {
    super(props);
    this._disabledOperationMarkers = [];
    this._documentAST = null;
    this._queryEditor = null;
    this._isMounted = false;
    this.state = {
      body: GraphQLEditor._stringToGraphQL(props.content),
      schema: null,
      schemaFetchError: null,
      schemaLastFetchTime: 0,
      schemaIsFetching: false,
      hideSchemaFetchErrors: false,
      variablesSyntaxError: '',
      forceRefreshKey: 0
    };
  }

  _getCurrentOperation () {
    const {_queryEditor} = this;
    if (!_queryEditor) return null;
    const operations = this._getOperations();
    const cursor = _queryEditor.getCursor();
    const cursorIndex = _queryEditor.indexFromPos(cursor);
    // Loop through all operations to see if one contains the cursor.
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      if (
        operation.loc.start <= cursorIndex &&
        operation.loc.end >= cursorIndex &&
        operation.name
      ) {
        return operation;
      }
    }
  }

  _handleQueryCursorActivity () {
    const currentOperation = this._getCurrentOperation();
    if (!currentOperation) {
      return;
    }
    const operationName = currentOperation.name.value;
    this._highlightOperation(operationName);
    this.setState(state => ({
      body: {
        ...state.body,
        operationName
      }
    }), () => {
      this.props.onChange(GraphQLEditor._graphQLToString(this.state.body));
    });
  }

  _highlightOperation (operationName: string) {
    const {_documentAST, _queryEditor} = this;
    if (!_documentAST || !_queryEditor) return null;
    const disabledDefinition = _documentAST.definitions.filter(d => d.name.value !== operationName);
    if (!disabledDefinition.length === 0) {
      // unexpected condition
      return;
    }
    // remove current query highlighting
    this._disabledOperationMarkers.forEach(textMarker => textMarker.clear());
    this._disabledOperationMarkers = disabledDefinition.map(definition => {
      const from = {
        line: definition.loc.startToken.line - 1,
        ch: definition.loc.startToken.column - 1
      };
      const to = {
        line: definition.loc.endToken.line,
        ch: definition.loc.endToken.column
      };
      return _queryEditor.doc.markText(from, to, {
        className: 'graphql-editor__disabled-definition'
      });
    });
  }

  _handleViewResponse() {
    const {settings} = this.props;
    const {schemaFetchError} = this.state;
    
    if (!schemaFetchError || !schemaFetchError.response) {
      return;
    }

    const { response } = schemaFetchError;

    showModal(WrapperModal, {
      title: 'Introspection Request',
      tall: true,
      body: (
        <div style={{ display: 'grid' }} className="tall pad-top">
          <ResponseTimelineViewer
            editorFontSize={settings.editorFontSize}
            editorIndentSize={settings.editorIndentSize}
            editorLineWrapping={settings.editorLineWrapping}
            timeline={response.timeline}
          />
        </div>
      )
    });
  }

  _hideSchemaFetchError() {
    this.setState({ hideSchemaFetchErrors: true });
  }

  _handleQueryCodeMirrorInit (codeMirror: CodeMirror) {
    this._queryEditor = codeMirror;
    const { query } = GraphQLEditor._stringToGraphQL(this.props.content);
    let documentAST = null;
    try {
      documentAST = parse(query);
    } catch (error) {
      // do nothing
    }
    this._documentAST = documentAST;
    if (documentAST && documentAST.definitions.length) {
      const currentOperation = documentAST.definitions[0].name.value;
      this._highlightOperation(currentOperation);
      this.setState(prevState => ({
        body: {
          ...prevState.body,
          operationName: currentOperation
        }
      }));
    }
  }

  async _fetchAndSetSchema (rawRequest: Request) {
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
    this._handleBodyChange(prettyQuery, prettyVariables);
    setTimeout(() => {
      this.setState({ forceRefreshKey: forceRefreshKey + 1 });
    }, 200);
  }

  _getOperations () {
    if (!this._documentAST) {
      return [];
    }

    return this._documentAST.definitions
      .filter(def => def.kind === 'OperationDefinition');
  }

  _getOperationNames (): string[] {
    return this._getOperations()
      .map(def => def.name ? def.name.value : null)
      .filter(Boolean);
  }

  _handleBodyChange (query: string, variables?: Object): void {
    try {
      this._documentAST = parse(query);
    } catch (e) {
      this._documentAST = null;
    }

    const operationNames = this._getOperationNames();

    const body: GraphQLBody = { query };

    if (variables) {
      body.variables = variables;
    }

    // check if it state.body.operationName still exists (the operation can be deleted)
    const currentDefinition = this._documentAST
      ? this._documentAST.definitions.find(d => d.name.value === this.state.body.operationName)
      : undefined;

    if (this.state.body.operationName && currentDefinition) {
      body.operationName = this.state.body.operationName;
    } else if (operationNames.length) {
      body.operationName = operationNames[0];
    }

    if (body.operationName) this._highlightOperation(body.operationName);

    this.setState({
      variablesSyntaxError: '',
      body
    });

    this.props.onChange(GraphQLEditor._graphQLToString(body));
  }

  _handleQueryChange(query: string): void {
    this._handleBodyChange(query, this.state.body.variables);
  }

  _handleVariablesChange(variables: string): void {
    try {
      const variablesObj = JSON.parse(variables || 'null');
      this._handleBodyChange(this.state.body.query, variablesObj);
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

    if (variables) {
      return { query, variables };
    } else {
      return { query };
    }
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

  renderSchemaFetchMessage() {
    let message;
    const { schemaLastFetchTime, schemaIsFetching } = this.state;
    if (schemaIsFetching) {
      message = 'Fetching schema...';
    } else if (schemaLastFetchTime > 0) {
      message = (
        <span>
          schema last fetched <TimeFromNow timestamp={schemaLastFetchTime} />
        </span>
      );
    } else {
      message = 'schema not yet fetched';
    }

    return (
      <div className="txt-sm super-faint italic pad-sm no-pad-right inline-block">
        {message}
      </div>
    );
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
            lintOptions={schema ? { schema } : null}
            fontSize={settings.editorFontSize}
            indentSize={settings.editorIndentSize}
            keyMap={settings.editorKeyMap}
            defaultValue={query}
            className={className}
            onChange={this._handleQueryChange}
            onCodeMirrorInit={this._handleQueryCodeMirrorInit}
            onCursorActivity={this._handleQueryCursorActivity}
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
        <div className="graphql-editor__schema-notice">
          {this.renderSchemaFetchMessage()}
          <button
            className={classnames('icon space-left', {
              'fa-spin': schemaIsFetching
            })}
            onClick={this._handleRefreshSchema}>
            <i className="fa fa-refresh" />
          </button>
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
