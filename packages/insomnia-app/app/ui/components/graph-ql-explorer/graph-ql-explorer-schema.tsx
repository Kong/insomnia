import type { GraphQLSchema, GraphQLType } from 'graphql';
import React, { Fragment, PureComponent } from 'react';
import GraphQLExplorerSearchResults from './graph-ql-explorer-search-results';
import GraphQLExplorerTypeLink from './graph-ql-explorer-type-link';

interface Props {
  onNavigateType: (type: GraphQLType) => void;
  onNavigateField: (field: Record<string, any>) => void;
  schema: GraphQLSchema;
  filter: string;
}

class GraphQLExplorerSchema extends PureComponent<Props> {
  renderQueryType() {
    const { schema, onNavigateType } = this.props;
    const type = schema.getQueryType();

    if (!type) {
      return null;
    }

    return (
      <Fragment>
        <span className="success">query</span>:{' '}
        <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={type} />
      </Fragment>
    );
  }

  renderMutationType() {
    const { schema, onNavigateType } = this.props;
    const type = schema.getMutationType();

    if (!type) {
      return null;
    }

    return (
      <Fragment>
        <span className="success">mutation</span>:{' '}
        <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={type} />
      </Fragment>
    );
  }

  renderSubscriptionType() {
    const { schema, onNavigateType } = this.props;
    const type = schema.getSubscriptionType();

    if (!type) {
      return null;
    }

    return (
      <Fragment>
        <span className="success">subscription</span>:{' '}
        <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={type} />
      </Fragment>
    );
  }

  render() {
    const { filter, schema, onNavigateType, onNavigateField } = this.props;
    return (
      <div className="graphql-explorer__schema">
        {filter ? (
          <GraphQLExplorerSearchResults
            schema={schema}
            filter={filter}
            onNavigateType={onNavigateType}
            onNavigateField={onNavigateField}
          />
        ) : (
          <>
            <p>A GraphQL schema provides a root type for each kind of operation.</p>
            <h2 className="graphql-explorer__subheading">Root Types</h2>
            <ul className="graphql-explorer__defs">
              <li>{this.renderQueryType()}</li>
              <li>{this.renderMutationType()}</li>
              <li>{this.renderSubscriptionType()}</li>
            </ul>
          </>
        )}
      </div>
    );
  }
}

export default GraphQLExplorerSchema;
