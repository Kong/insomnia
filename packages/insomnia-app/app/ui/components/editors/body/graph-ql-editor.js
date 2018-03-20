// @flow
import type {Request} from '../../../../models/request';
import {newBodyRaw} from '../../../../models/request';
import classnames from 'classnames';
import * as React from 'react';
import autobind from 'autobind-decorator';
import {parse, print} from 'graphql';
import {introspectionQuery} from 'graphql/utilities/introspectionQuery';
import {buildClientSchema} from 'graphql/utilities/buildClientSchema';
import CodeEditor from '../../codemirror/code-editor';
import {jsonParseOr} from '../../../../common/misc';
import HelpTooltip from '../../help-tooltip';
import {CONTENT_TYPE_JSON, DEBOUNCE_MILLIS} from '../../../../common/constants';
import prettify from 'insomnia-prettify';
import * as network from '../../../../network/network';
import type {Workspace} from '../../../../models/workspace';
import type {Settings} from '../../../../models/settings';
import TimeFromNow from '../../time-from-now';
import * as models from '../../../../models/index';
import * as db from '../../../../common/database';

type GraphQLBody = {
  query: string,
  variables?: Object,
  operationName?: string
}

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

    const {environmentId} = this.props;

    const newState = {
      schema: this.state.schema,
      schemaFetchError: '',
      schemaLastFetchTime: this.state.schemaLastFetchTime,
      schemaIsFetching: false
    };

    try {
      const bodyJson = JSON.stringify({query: introspectionQuery});
      const introspectionRequest = await db.upsert(Object.assign({}, rawRequest, {
        _id: rawRequest._id + '.graphql',
        parentId: rawRequest._id,
        isPrivate: true, // So it doesn't get synced or exported
        body: newBodyRaw(bodyJson, CONTENT_TYPE_JSON)
      }));

      const response = await network.send(introspectionRequest._id, environmentId);
      const bodyBuffer = models.response.getBodyBuffer(response);

      const status = typeof response.statusCode === 'number' ? response.statusCode : 0;
      const error = typeof response.error === 'string' ? response.error : '';

      if (error) {
        newState.schemaFetchError = error;
      } else if (status < 200 || status >= 300) {
        newState.schemaFetchError = `Got status ${status} fetching schema from "${rawRequest.url}"`;
      } else if (bodyBuffer) {
        const {data} = JSON.parse(bodyBuffer.toString());
        newState.schema = buildClientSchema(data);
        newState.schemaLastFetchTime = Date.now();
      } else {
        newState.schemaFetchError = 'No response body received when fetching schema';
      }
    } catch (err) {
      console.warn(`Failed to fetch GraphQL schema from ${rawRequest.url}`, err);
      newState.schemaFetchError = `Failed to contact "${rawRequest.url}" to fetch schema ${err.message}`;
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
    const prettyVariables = variables && JSON.parse(prettify.json(JSON.stringify(variables)));
    this._handleBodyChange(prettyQuery, prettyVariables);
    setTimeout(() => {
      this.setState({forceRefreshKey: forceRefreshKey + 1});
    }, 200);
  }

  _getOperationNames (query: string): Array<string> {
    let documentAST;
    try {
      documentAST = parse(query);
    } catch (e) {
      return [];
    }

    return documentAST.definitions
      .filter(def => def.kind === 'OperationDefinition')
      .map(def => def.name ? def.name.value : null)
      .filter(Boolean);
  }

  _handleBodyChange (query: string, variables?: Object): void {
    const operationNames = this._getOperationNames(query);

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
    } = this._stringToGraphQL(content);

    const variables = prettify.json(JSON.stringify(variablesObject));

    return (
      <div key={forceRefreshKey} className="graphql-editor">
        <div className="graphql-editor__query">
          <CodeEditor
            dynamicHeight
            manualPrettify
            uniquenessKey={uniquenessKey ? uniquenessKey + '::query' : undefined}
            hintOptions={{
              schema: schema || null,
              completeSingle: false
            }}
            lintOptions={schema ? {schema} : null}
            fontSize={settings.editorFontSize}
            indentSize={settings.editorIndentSize}
            keyMap={settings.editorKeyMap}
            defaultValue={query}
            className={className}
            onChange={this._handleQueryChange}
            mode="graphql"
            lineWrapping={settings.editorLineWrapping}
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
            nunjucksPowerUserMode={settings.nunjucksPowerUserMode}
            onChange={this._handleVariablesChange}
            mode="application/json"
            lineWrapping={settings.editorLineWrapping}
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
