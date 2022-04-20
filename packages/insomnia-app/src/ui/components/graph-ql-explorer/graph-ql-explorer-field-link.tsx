import { autoBindMethodsForReact } from 'class-autobind-decorator';
import React, { PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { GraphQLFieldWithParentName } from './graph-ql-types';

interface Props {
  onNavigate: (type: GraphQLFieldWithParentName) => void;
  field: GraphQLFieldWithParentName;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class GraphQLExplorerFieldLink extends PureComponent<Props> {
  _handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const { onNavigate, field } = this.props;
    onNavigate(field);
  }

  render() {
    const { field: { name, parentName } } = this.props;
    return (
      <>
        {parentName && <span>{parentName}.</span>}
        <a href="#" onClick={this._handleClick} className="success">
          {name}
        </a>
      </>
    );
  }
}
