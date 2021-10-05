import { autoBindMethodsForReact } from 'class-autobind-decorator';
import type { GraphQLType } from 'graphql';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import React, { Fragment, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';

interface Props {
  onNavigate: (type: GraphQLType) => void;
  type: GraphQLType;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class GraphQLExplorerTypeLink extends PureComponent<Props> {
  _handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const { onNavigate, type } = this.props;
    onNavigate(type);
  }

  render() {
    const { type, onNavigate } = this.props;

    if (type instanceof GraphQLList) {
      return (
        <Fragment>
          [<GraphQLExplorerTypeLink onNavigate={onNavigate} type={type.ofType} />]
        </Fragment>
      );
    }

    if (type instanceof GraphQLNonNull) {
      return (
        <Fragment>
          <GraphQLExplorerTypeLink onNavigate={onNavigate} type={type.ofType} />!
        </Fragment>
      );
    }

    return (
      <a href="#" onClick={this._handleClick} className="notice">
        {type.name}
      </a>
    );
  }
}
