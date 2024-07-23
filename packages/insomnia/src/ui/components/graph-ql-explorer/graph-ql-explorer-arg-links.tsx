import type { GraphQLArgument, GraphQLType } from 'graphql';
import React, { type FC } from 'react';

import { SvgIcon } from '../svg-icon';
import { Tooltip } from '../tooltip';
import { GraphQLExplorerTypeLink } from './graph-ql-explorer-type-link';

interface Props {
  args?: readonly GraphQLArgument[];
  onNavigate: (type: GraphQLType) => void;
}

export const GraphQLExplorerArgLinks: FC<Props> = ({
  args,
  onNavigate,
}) => <>
  {args ? args.map(a => (
    <div key={a.name} className="graphql-explorer__defs__arg">
      <span className="info">{a.name}</span>:{' '}
      <GraphQLExplorerTypeLink onNavigate={onNavigate} type={a.type} />
      {a.deprecationReason && (
        <Tooltip
          message={`The argument "${a.name}" is deprecated. ${a.deprecationReason}`}
          position="bottom"
          delay={1000}
        >
          <SvgIcon icon="warning" />
        </Tooltip>
      )}
    </div>
  )) : null}
</>;
