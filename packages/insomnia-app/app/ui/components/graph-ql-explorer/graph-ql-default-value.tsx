import { astFromValue, print } from 'graphql';
import React, { PureComponent } from 'react';

import { GraphQLFieldWithParentName } from './graph-ql-types';

interface Props {
  field: GraphQLFieldWithParentName;
}

class GraphQLDefaultValue extends PureComponent<Props> {
  render() {
    const { field } = this.props;
    // Make Flow happy :/
    const fieldO: Record<string, any> = field;

    if ('defaultValue' in fieldO && fieldO.defaultValue !== undefined) {
      const ast = astFromValue(fieldO.defaultValue, fieldO.type);
      const strDefault = ast ? print(ast) : '';
      return <span className="success">{` = ${strDefault}`}</span>;
    } else {
      return null;
    }
  }
}

export default GraphQLDefaultValue;
