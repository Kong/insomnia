import { autoBindMethodsForReact } from 'class-autobind-decorator';
import type { GraphQLField } from 'graphql';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';

interface Props {
  onNavigate: (type: Record<string, any>) => void;
  field: GraphQLField<any, any>;
  parentName?: string;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class GraphQLExplorerFieldLink extends PureComponent<Props> {
  _handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const { onNavigate, field } = this.props;
    onNavigate(field);
  }

  render() {
    const { field, parentName } = this.props;
    return (
      <>
        {parentName && <span>{parentName}.</span>}
        <a href="#" onClick={this._handleClick} className="success">
          {field.name}
        </a>
      </>
    );
  }
}

export default GraphQLExplorerFieldLink;
