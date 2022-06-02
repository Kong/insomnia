import { GraphQLList, GraphQLNonNull, GraphQLType } from 'graphql';
import React, { FC, Fragment } from 'react';

interface Props {
  onNavigate: (type: GraphQLType) => void;
  type: GraphQLType;
}

export const GraphQLExplorerTypeLink: FC<Props> = props => {
  const {
    type,
    onNavigate,
  } = props;

  const _handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    const {
      onNavigate,
      type,
    } = props;
    onNavigate(type);
  };

  if (type instanceof GraphQLList) {
    return <Fragment>
      [<GraphQLExplorerTypeLink onNavigate={onNavigate} type={type.ofType} />]
    </Fragment>;
  }

  if (type instanceof GraphQLNonNull) {
    return <Fragment>
      <GraphQLExplorerTypeLink onNavigate={onNavigate} type={type.ofType} />!
    </Fragment>;
  }

  return <a href="#" onClick={_handleClick} className="notice">
    {type.name}
  </a>;
};
