import { GraphQLArgument, GraphQLType } from 'graphql';
import React, { FC } from 'react';

import { GraphQLExplorerTypeLink } from './graph-ql-explorer-type-link';

interface Props {
  args: GraphQLArgument[];
  onNavigate: (type: GraphQLType) => void;
}

export const GraphQLExplorerArgLinks: FC<Props> = ({
  args,
  onNavigate,
}) => <>
  {args.map(a => (
    <div key={a.name} className="graphql-explorer__defs__arg">
      <span className="info">{a.name}</span>:{' '}
      <GraphQLExplorerTypeLink onNavigate={onNavigate} type={a.type} />
    </div>
  ))}
</>;
