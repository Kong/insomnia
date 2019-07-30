// @flow
import * as React from 'react';
import type { GraphQLSchema, GraphQLType } from 'graphql';
import GraphQLExplorerTypeLink from './graph-ql-explorer-type-link';

type Props = {
  onNavigateType: (type: GraphQLType) => void,
  schema: GraphQLSchema,
};

class GraphQLExplorerSchema extends React.PureComponent<Props> {
  renderQueryType() {
    const { schema, onNavigateType } = this.props;

    const type = schema.getQueryType();

    if (!type) {
      return null;
    }

    return (
      <React.Fragment>
        <span className="success">query</span>:{' '}
        <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={type} />
      </React.Fragment>
    );
  }

  renderMutationType() {
    const { schema, onNavigateType } = this.props;

    const type = schema.getMutationType();

    if (!type) {
      return null;
    }

    return (
      <React.Fragment>
        <span className="success">mutation</span>:{' '}
        <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={type} />
      </React.Fragment>
    );
  }

  render() {
    return (
      <div className="graphql-explorer__schema">
        <p>A GraphQL schema provides a root type for each kind of operation.</p>
        <h2 className="graphql-explorer__subheading">Root Types</h2>
        <ul className="graphql-explorer__defs">
          <li>{this.renderQueryType()}</li>
          <li>{this.renderMutationType()}</li>
        </ul>
      </div>
    );
  }
}

export default GraphQLExplorerSchema;
