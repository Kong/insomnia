import type { GraphQLSchema, GraphQLType } from 'graphql';
import React, { Fragment, PureComponent } from 'react';

import { GraphQLExplorerTypeLink } from './graph-ql-explorer-type-link';

interface Props {
  onNavigateType: (type: GraphQLType) => void;
  schema: GraphQLSchema;
}

export class GraphQLExplorerSchema extends PureComponent<Props> {
  renderQueryType() {
    const { schema, onNavigateType } = this.props;
    const type = schema.getQueryType();

    if (!type) {
      return null;
    }

    return (
      <Fragment>
        <span className="success" data-testid="graphql-explorer-root-type-name-query">
          query
        </span>: <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={type} />
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
        <span className="success" data-testid="graphql-explorer-root-type-name-mutation">
          mutation
        </span>: <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={type} />
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
        <span className="success" data-testid="graphql-explorer-root-type-name-subscription">
          subscription
        </span>:{' '}
        <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={type} />
      </Fragment>
    );
  }

  render() {
    return (
      <div className="graphql-explorer__schema" data-testid="graphql-explorer-schema">
        <p>A GraphQL schema provides a root type for each kind of operation.</p>
        <h2 className="graphql-explorer__subheading">Root Types</h2>
        <ul className="graphql-explorer__defs">
          <li data-testid="graphql-explorer-root-type-query">{this.renderQueryType()}</li>
          <li data-testid="graphql-explorer-root-type-mutation">{this.renderMutationType()}</li>
          <li data-testid="graphql-explorer-root-type-subscription">{this.renderSubscriptionType()}</li>
        </ul>
      </div>
    );
  }
}
