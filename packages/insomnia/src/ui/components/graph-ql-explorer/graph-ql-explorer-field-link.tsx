import React, { FC, Fragment, useCallback } from 'react';

import { GraphQLFieldWithParentName } from './graph-ql-types';

interface Props {
  onNavigate: (type: GraphQLFieldWithParentName) => void;
  field: GraphQLFieldWithParentName;
}

export const GraphQLExplorerFieldLink: FC<Props> = ({
  field,
  onNavigate,
}) => {
  const { name, parentName } = field;

  const handleClick = useCallback((event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onNavigate(field);
  }, [onNavigate, field]);
  return (
    <Fragment>
      {parentName ? <span>{parentName}.</span> : null}
      <a
        href="#"
        onClick={handleClick}
        className="success"
      >
        {name}
      </a>
    </Fragment>
  );
};
