import React, { Fragment, PureComponent } from 'react';
import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { AUTOBIND_CFG } from '../../../common/constants';
import { GraphQLList, GraphQLNonNull } from 'graphql';
import type { GraphQLType } from 'graphql';

interface Props {
  onNavigate: (type: Record<string, any>) => void;
  type: GraphQLType;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
class GraphQLExplorerTypeLink extends PureComponent<Props> {
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

export default GraphQLExplorerTypeLink;
