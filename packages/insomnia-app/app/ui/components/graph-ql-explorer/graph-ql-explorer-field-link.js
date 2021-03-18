// @flow
import * as React from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import type { GraphQLField } from 'graphql';

type Props = {
  onNavigate: (type: Object) => void,
  field: GraphQLField<any, any>,
};

@autoBindMethodsForReact(AUTOBIND_CFG)
class GraphQLExplorerFieldLink extends React.PureComponent<Props> {
  _handleClick(e: MouseEvent) {
    e.preventDefault();
    const { onNavigate, field } = this.props;
    onNavigate(field);
  }

  render() {
    const { field } = this.props;

    return (
      <a href="#" onClick={this._handleClick} className="success">
        {field.name}
      </a>
    );
  }
}

export default GraphQLExplorerFieldLink;
