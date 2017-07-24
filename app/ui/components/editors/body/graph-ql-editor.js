// @flow
import React from 'react';
import autobind from 'autobind-decorator';
import {introspectionQuery} from 'graphql/utilities/introspectionQuery';
import {buildClientSchema} from 'graphql/utilities/buildClientSchema';
import clone from 'clone';
import CodeEditor from '../../codemirror/code-editor';
import {setDefaultProtocol} from '../../../../common/misc';

type GraphQLBody = {
  query: string,
  variables: string,
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

  // Optional
  className?: string,
  schemaUrl?: string
};

@autobind
class GraphQLEditor extends React.PureComponent {
  props: Props;
  state: {
    body: GraphQLBody,
    schema: Object | null
  };

  constructor (props: Props) {
    super(props);
    this.state = {
      body: this._stringToGraphQL(props.content),
      schema: null
    };
  }

  async _fetchAndSetSchema () {
    const {schemaUrl} = this.props;

    if (!schemaUrl) {
      return;
    }

    // Render the URL in case we're using variables
    const url = setDefaultProtocol(schemaUrl);
    const renderedUrl = await this.props.render(url);

    const schemaRes = await window.fetch(renderedUrl, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({query: introspectionQuery})
    });

    const {data} = await schemaRes.json();
    const schema = buildClientSchema(data);

    this.setState({schema: schema});
  }

  _handleQueryChange (text: string): void {
    const body = clone(this.state.body);
    body.query = text;
    this.setState({body: body});
    this.props.onChange(this._graphQLToString(body));
  }

  _handleVariablesChange (text: string): void {
    const body = clone(this.state.body);
    body.variables = text;
    this.setState({body: body});
    this.props.onChange(this._graphQLToString(body));
  }

  _stringToGraphQL (text: string): GraphQLBody {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch (err) {
      obj = {query: '', variables: ''};
    }

    return {
      query: obj.query || '',
      variables: obj.variables || ''
    };
  }

  _graphQLToString (body: GraphQLBody): string {
    return JSON.stringify(body);
  }

  componentDidMount () {
    this._fetchAndSetSchema();
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

    const {schema} = this.state;

    const {
      query,
      variables
    } = this._stringToGraphQL(content);

    return (
      <div className="graphql-editor">
        <div className="graphql-editor__query">
          <CodeEditor
            dynamicHeight
            manualPrettify
            hintOptions={{schema}}
            lintOptions={{schema}}
            fontSize={fontSize}
            indentSize={indentSize}
            keyMap={keyMap}
            defaultValue={query}
            className={className}
            onChange={this._handleQueryChange}
            mode="graphql"
            lineWrapping={lineWrapping}
            placeholder="query {}"
          />
        </div>
        <h2 className="no-margin pad-left-sm pad-top-sm pad-bottom-sm">
          Query Variables
        </h2>
        <div className="graphql-editor__variables">
          <CodeEditor
            dynamicHeight
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
            placeholder="{}"
          />
        </div>
      </div>
    );
  }
}

export default GraphQLEditor;
