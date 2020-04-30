// @flow
import * as React from 'react';
import type { GraphQLField } from 'graphql';
import { astFromValue, print } from 'graphql';

type Props = {
  field: GraphQLField<any, any>,
};

class GraphQLDefaultValue extends React.PureComponent<Props> {
  render() {
    const { field } = this.props;

    // Make Flow happy :/
    const fieldO: Object = field;

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
