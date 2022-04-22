import { astFromValue, print } from 'graphql';
import React, { FC, memo } from 'react';

import { GraphQLFieldWithParentName } from './graph-ql-types';

interface Props {
  field: GraphQLFieldWithParentName;
}

export const GraphQLDefaultValue: FC<Props> = memo(({ field }) => {
  // Make Flow happy :/
  const fieldO: Record<string, any> = field;

  if ('defaultValue' in fieldO && fieldO.defaultValue !== undefined) {
    const ast = astFromValue(fieldO.defaultValue, fieldO.type);
    const strDefault = ast ? print(ast) : '';
    return <span className="success">{` = ${strDefault}`}</span>;
  } else {
    return null;
  }
});

GraphQLDefaultValue.displayName = 'GraphQLDefaultValue';
