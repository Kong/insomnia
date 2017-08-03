// @flow
import type {Request} from '../../../../models/request';

import React from 'react';
import autobind from 'autobind-decorator';
import {parse, print} from 'graphql';
import {introspectionQuery} from 'graphql/utilities/introspectionQuery';
import {buildClientSchema} from 'graphql/utilities/buildClientSchema';
import clone from 'clone';
import CodeEditor from '../../codemirror/code-editor';
import {jsonParseOr, setDefaultProtocol} from '../../../../common/misc';
import HelpTooltip from '../../help-tooltip';
import {DEBOUNCE_MILLIS} from '../../../../common/constants';
import {prettifyJson} from '../../../../common/prettify';

type GraphQLBody = {
  query: string,
  variables: Object,
  operationName?: string
}

type Props = {
  onChange: Function,
  content: string,
  fontSize: number,
  indentSize: number,
  keyMap: string,
  lineWrapping: boolean,
  render: Function,
  getRenderContext: Function,
  request: Request,

  // Optional
  className?: string
};

@autobind
class GraphQLEditor extends React.PureComponent {
  props: Props;
  state: {
    body: GraphQLBody,
    schema: Object | null,
    schemaFetchError: string,
    hideSchemaFetchErrors: boolean,
    variablesSyntaxError: string,
    forceRefreshKey: number
  };
  _isMounted: boolean;

  constructor (props: Props) {
    super(props);
    this._isMounted = false;
    this.state = {
      body: this._stringToGraphQL(props.content),
      schema: null,
      schemaFetchError: '',
      hideSchemaFetchErrors: false,
      variablesSyntaxError: '',
      forceRefreshKey: 0
    };
  }

  _hideSchemaFetchError () {
    this.setState({hideSchemaFetchErrors: true});
  }

  async _fetchAndSetSchema (rawRequest: Request) {
    const {render} = this.props;
    const request = await render(rawRequest);

    // Render the URL in case we're using variables
    const schemaUrl = setDefaultProtocol(request.url);

    const headers = {};
    for (const {name, value} of request.headers) {
      headers[name] = value;
    }

    const newState = {schema: this.state.schema, schemaFetchError: ''};

    try {
      // TODO: Use Insomnia's network stack to handle things like authentication
      const response = await window.fetch(schemaUrl, {
        method: request.method,
        headers: headers,
        body: JSON.stringify({query: introspectionQuery})
      });

      const {status} = response;
      if (status < 200 || status >= 300) {
        const msg = `Got status ${status} fetching schema from "${schemaUrl}"`;
        newState.schemaFetchError = msg;
      } else {
        const {data} = await response.json();
        const schema = buildClientSchema(data);
        newState.schema = schema;
      }
    } catch (err) {
      console.warn(`Failed to fetch GraphQL schema from ${schemaUrl}`, err);
      newState.schemaFetchError = `Failed to contact "${schemaUrl}" to fetch schema`;
    }

    if (this._isMounted) {
      this.setState(newState);
    }
  }

  _handlePrettify () {
    const {body, forceRefreshKey} = this.state;
    const {variables, query} = body;
    const prettyQuery = query && print(parse(query));
    const prettyVariables = variables && prettifyJson(JSON.stringify(variables));
    this._handleBodyChange(prettyQuery, prettyVariables);
    setTimeout(() => {
      this.setState({forceRefreshKey: forceRefreshKey + 1});
    }, 200);
  }

  _handleBodyChange (query: string, variables: Object): void {
    const body = clone(this.state.body);
    const newState = {variablesSyntaxError: '', body};

    newState.body.query = query;
    newState.body.variables = variables;
    this.setState(newState);
    this.props.onChange(this._graphQLToString(body));
  }

  _handleQueryChange (query: string): void {
    this._handleBodyChange(query, this.state.body.variables);
  }

  _handleVariablesChange (variables: string): void {
    try {
      const variablesObj = JSON.parse(variables || '{}');
      this._handleBodyChange(this.state.body.query, variablesObj);
    } catch (err) {
      this.setState({variablesSyntaxError: err.message});
    }
  }

  _stringToGraphQL (text: string): GraphQLBody {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (err) {
      obj = {query: '', variables: {}};
    }

    if (typeof obj.variables === 'string') {
      obj.variables = jsonParseOr(obj.variables, {});
    }

    return {
      query: obj.query || '',
      variables: obj.variables || {}
    };
  }

  _graphQLToString (body: GraphQLBody): string {
    return JSON.stringify(body);
  }

  componentWillReceiveProps (nextProps: Props) {
    if (nextProps.request.url !== this.props.request.url) {
      (async () => await this._fetchAndSetSchema(nextProps.request))();
    }
  }

  componentDidMount () {
    this._fetchAndSetSchema(this.props.request);
    this._isMounted = true;
  }

  componentWillUnmount () {
    this._isMounted = false;
  }

  render () {
    const {
      content,
      fontSize,
      indentSize,
      keyMap,
      render,
      getRenderContext,
      lineWrapping,
      className
    } = this.props;

    const {
      schema,
      schemaFetchError,
      hideSchemaFetchErrors,
      variablesSyntaxError,
      forceRefreshKey
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
