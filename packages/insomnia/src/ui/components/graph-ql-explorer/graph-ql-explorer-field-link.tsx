import React, { FC } from 'react';

import { GraphQLFieldWithParentName } from './graph-ql-types';

interface Props {
  onNavigate: (type: GraphQLFieldWithParentName) => void;
  field: GraphQLFieldWithParentName;
}

export const GraphQLExplorerFieldLink: FC<Props> = props => {
  const {
    field: {
      name,
      parentName,
    },
  } = props;
  const _handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    props.onNavigate(props.field);
  };
  return <>
    {parentName && <span>{parentName}.</span>}
    <a
      href="#"
      onClick={_handleClick}
      className="success"
    >
      {name}
    </a>
  </>;
};
