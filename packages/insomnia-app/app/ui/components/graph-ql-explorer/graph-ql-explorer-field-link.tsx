import React, { PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import type { GraphQLField } from 'graphql';

interface Props {
  onNavigate: (type: Record<string, any>) => void;
  field: GraphQLField<any, any>;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class GraphQLExplorerFieldLink extends PureComponent<Props> {
  _handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
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
