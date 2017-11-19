// @flow
import type {Request} from '../../../../models/request';
import classnames from 'classnames';
import {newBodyRaw} from '../../../../models/request';
import * as React from 'react';
import autobind from 'autobind-decorator';
import {parse, print} from 'graphql';
import {introspectionQuery} from 'graphql/utilities/introspectionQuery';
import {buildClientSchema} from 'graphql/utilities/buildClientSchema';
import CodeEditor from '../../codemirror/code-editor';
import {jsonParseOr} from '../../../../common/misc';
import HelpTooltip from '../../help-tooltip';
import {CONTENT_TYPE_JSON, DEBOUNCE_MILLIS} from '../../../../common/constants';
import {prettifyJson} from '../../../../common/prettify';
import * as network from '../../../../network/network';
import type {Workspace} from '../../../../models/workspace';
import type {Settings} from '../../../../models/settings';
import type {RenderedRequest} from '../../../../common/render';
import {getRenderedRequest} from '../../../../common/render';
import TimeFromNow from '../../time-from-now';

type GraphQLBody = {
  query: string,
  variables?: Object,
  operationName?: string
}

type Props = {
  onChange: Function,
  content: string,
  fontSize: number,
  indentSize: number,
  keyMap: string,
  lineWrapping: boolean,
  render: Function | null,
  getRenderContext: Function | null,
  nunjucksPowerUserMode: boolean,
  request: Request,
  workspace: Workspace,
  settings: Settings,
  environmentId: string,

  // Optional
  className?: string
};

type State = {
  body: GraphQLBody,
  schema: Object | null,
  schemaFetchError: string,
  schemaLastFetchTime: number,
  schemaIsFetching: boolean,
  hideSchemaFetchErrors: boolean,
  variablesSyntaxError: string,
  forceRefreshKey: number
}

@autobind
class GraphQLEditor extends React.PureComponent<Props, State> {
  _isMounted: boolean;

  constructor (props: Props) {
    super(props);
    this._isMounted = false;
    this.state = {
      body: this._stringToGraphQL(props.content),
      schema: null,
      schemaFetchError: '',
      schemaLastFetchTime: 0,
      schemaIsFetching: false,
      hideSchemaFetchErrors: false,
      variablesSyntaxError: '',
      forceRefreshKey: 0
    };
  }

  _hideSchemaFetchError () {
    this.setState({hideSchemaFetchErrors: true});
  }

  async _fetchAndSetSchema (rawRequest: Request) {
    this.setState({schemaIsFetching: true});

    const {workspace, settings, environmentId} = this.props;

    const newState = {
      schema: this.state.schema,
      schemaFetchError: '',
      schemaLastFetchTime: this.state.schemaLastFetchTime,
      schemaIsFetching: false
    };

    let request: RenderedRequest | null = null;
    try {
      request = await getRenderedRequest(rawRequest, environmentId);
    } catch (err) {
      newState.schemaFetchError = `Failed to fetch schema: ${err}`;
    }

    if (request) {
      try {
        const bodyJson = JSON.stringify({query: introspectionQuery});
        const introspectionRequest = Object.assign({}, request, {
          body: newBodyRaw(bodyJson, CONTENT_TYPE_JSON),

          // NOTE: We're not actually saving this request or response but let's pretend
          // like we are by setting these properties to prevent bugs in the future.
          _id: request._id + '.graphql',
          parentId: request._id
        });

        const {bodyBuffer, response} = await network._actuallySend(
          introspectionRequest,
          workspace,
          settings
        );

        const status = response.statusCode || 0;

        if (response.error) {
          newState.schemaFetchError = response.error;
        } else if (status < 200 || status >= 300) {
          const msg = `Got status ${status} fetching schema from "${request.url}"`;
          newState.schemaFetchError = msg;
        } else if (bodyBuffer) {
          const {data} = JSON.parse(bodyBuffer.toString());
          const schema = buildClientSchema(data);
          newState.schema = schema;
          newState.schemaLastFetchTime = Date.now();
        } else {
          newState.schemaFetchError = 'No response body received when fetching schema';
        }
      } catch (err) {
        console.warn(`Failed to fetch GraphQL schema from ${request.url}`, err);
        newState.schemaFetchError = `Failed to contact "${request.url}" to fetch schema`;
      }
    }

    if (this._isMounted) {
      this.setState(newState);
    }
  }

  _handleRefreshSchema (): void {
    this._fetchAndSetSchema(this.props.request);
  }

  _handlePrettify () {
    const {body, forceRefreshKey} = this.state;
    const {variables, query} = body;
    const prettyQuery = query && print(parse(query));
    const prettyVariables = variables && JSON.parse(prettifyJson(JSON.stringify(variables)));
    this._handleBodyChange(prettyQuery, prettyVariables);
    setTimeout(() => {
      this.setState({forceRefreshKey: forceRefreshKey + 1});
    }, 200);
  }

  _getOperationNames (): Array<string> {
    const {body} = this.state;

    let documentAST;
    try {
      documentAST = parse(body.query);
    } catch (e) {
      return [];
    }

    return documentAST.definitions
      .filter(def => def.kind === 'OperationDefinition')
      .map(def => def.name ? def.name.value : null)
      .filter(Boolean);
  }

  _handleBodyChange (query: string, variables?: Object): void {
    const operationNames = this._getOperationNames();

    const body: GraphQLBody = {query};

    if (variables) {
      body.variables = variables;
    }

    if (operationNames.length) {
      body.operationName = operationNames[0];
    }

    this.setState({variablesSyntaxError: '', body});
    this.props.onChange(this._graphQLToString(body));
  }

  _handleQueryChange (query: string): void {
    this._handleBodyChange(query, this.state.body.variables);
  }

  _handleVariablesChange (variables: string): void {
    try {
      const variablesObj = JSON.parse(variables || 'null');
      this._handleBodyChange(this.state.body.query, variablesObj);
    } catch (err) {
      this.setState({variablesSyntaxError: err.message});
    }
  }

  _stringToGraphQL (text: string): GraphQLBody {
    let obj: GraphQLBody;
    try {
      obj = JSON.parse(text);
    } catch (err) {
      obj = {query: ''};
    }

    if (typeof obj.variables === 'string') {
      obj.variables = jsonParseOr(obj.variables, '');
    }

    const query = obj.query || '';
    const variables = obj.variables || null;

    if (variables) {
      return {query, variables};
    } else {
      return {query};
    }
  }

  _graphQLToString (body: GraphQLBody): string {
    return JSON.stringify(body);
  }

  componentWillReceiveProps (nextProps: Props) {
    if (nextProps.request.url !== this.props.request.url) {
      (async () => {
        await this._fetchAndSetSchema(nextProps.request);
      })();
    }
  }

  componentDidMount () {
    this._fetchAndSetSchema(this.props.request);
    this._isMounted = true;
  }

  componentWillUnmount () {
    this._isMounted = false;
  }

  renderSchemaFetchMessage () {
    let message;
    const {schemaLastFetchTime, schemaIsFetching} = this.state;
    if (schemaIsFetching) {
      message = 'Fetching schema...';
    } else if (schemaLastFetchTime > 0) {
      message = <span>schema last fetched <TimeFromNow timestamp={schemaLastFetchTime}/></span>;
    } else {
      message = 'schema not yet fetched';
    }

    return (
      <div className="txt-sm super-faint italic pad-sm no-pad-right inline-block">
        {message}
      </div>
    );
  }

  render () {
    const {
      content,
      fontSize,
      indentSize,
      keyMap,
      render,
      getRenderContext,
      nunjucksPowerUserMode,
      lineWrapping,
      className
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
    } = this._stringToGraphQL(content);

    const variables = prettifyJson(JSON.stringify(variablesObject));

    return (
      <div key={forceRefreshKey} className="graphql-editor">
        <div className="graphql-editor__query">
          <CodeEditor
            dynamicHeight
            manualPrettify
            hintOptions={{
              schema: schema || null,
              completeSingle: false
            }}
            lintOptions={schema ? {schema} : null}
            fontSize={fontSize}
            indentSize={indentSize}
            keyMap={keyMap}
            defaultValue={query}
            className={className}
            onChange={this._handleQueryChange}
            mode="graphql"
            lineWrapping={lineWrapping}
            placeholder=""
          />
        </div>
        <div className="graphql-editor__schema-error">
          {!hideSchemaFetchErrors && schemaFetchError && (
            <div className="notice error margin no-margin-top margin-bottom-sm">
              <button className="pull-right icon" onClick={this._hideSchemaFetchError}>
                <i className="fa fa-times"/>
              </button>
              {schemaFetchError}
            </div>
          )}
        </div>
        <div className="graphql-editor__schema-notice">
          {this.renderSchemaFetchMessage()}
          <button className={classnames('icon space-left', {'fa-spin': schemaIsFetching})}
                  onClick={this._handleRefreshSchema}>
            <i className="fa fa-refresh"/>
          </button>
        </div>
        <h2 className="no-margin pad-left-sm pad-top-sm pad-bottom-sm">
          Query Variables <HelpTooltip>Variables to use in GraphQL query <br/>(JSON
          format)</HelpTooltip>
          {variablesSyntaxError && (
            <span className="text-danger italic pull-right">
              {variablesSyntaxError}
            </span>
          )}
        </h2>
        <div className="graphql-editor__variables">
          <CodeEditor
            dynamicHeight
            debounceMillis={DEBOUNCE_MILLIS * 4}
            manualPrettify={false}
            fontSize={fontSize}
            indentSize={indentSize}
            keyMap={keyMap}
            defaultValue={variables}
            className={className}
            render={render}
            getRenderContext={getRenderContext}
            nunjucksPowerUserMode={nunjucksPowerUserMode}
            onChange={this._handleVariablesChange}
            mode="application/json"
            lineWrapping={lineWrapping}
            placeholder=""
          />
        </div>
        <div className="pane__footer">
          <button className="pull-right btn btn--compact" onClick={this._handlePrettify}>
            Prettify GraphQL
          </button>
        </div>
      </div>
    );
  }
}

export default GraphQLEditor;
