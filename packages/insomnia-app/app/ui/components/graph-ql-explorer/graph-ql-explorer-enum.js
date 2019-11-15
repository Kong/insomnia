// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import MarkdownPreview from '../markdown-preview';
import type { GraphQLEnumValue } from 'graphql';
import { GraphQLEnumType } from 'graphql';

type Props = {|
  type: GraphQLEnumType,
|};

@autobind
class GraphQLExplorerEnum extends React.PureComponent<Props> {
  renderDescription() {
    const { type } = this.props;
    return <MarkdownPreview markdown={type.description || '*no description*'} />;
  }

  renderValues() {
    const { type } = this.props;

    const values = type.getValues();

    return (
      <React.Fragment>
        <h2 className="graphql-explorer__subheading">Values</h2>
        <ul className="graphql-explorer__defs">
          {values.map((value: GraphQLEnumValue) => {
            const description =
              value.description ||
              'This is a long paragraph that is a description for the enum value ' + value.name;
            return (
              <li key={value.name}>
                <span className="selectable bold">{value.name}</span>
                {description && (
                  <div className="graphql-explorer__defs__description">
                    <MarkdownPreview markdown={description} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </React.Fragment>
    );
  }

  render() {
    return (
      <div className="graphql-explorer__type">
        {this.renderDescription()}
        {this.renderValues()}
      </div>
    );
  }
}

export default GraphQLExplorerEnum;
