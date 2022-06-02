import { GraphQLEnumType, GraphQLEnumValue } from 'graphql';
import React, { FC, Fragment } from 'react';

import { MarkdownPreview } from '../markdown-preview';

interface Props {
  type: GraphQLEnumType;
}

export const GraphQLExplorerEnum: FC<Props> = props => {
  return <div className="graphql-explorer__type">
    <MarkdownPreview markdown={props.type.description || '*no description*'} />
    <Fragment>
      <h2 className="graphql-explorer__subheading">Values</h2>
      <ul className="graphql-explorer__defs">
        {props.type.getValues().map((value: GraphQLEnumValue) => {
          const description = value.description || 'This is a long paragraph that is a description for the enum value ' + value.name;
          return <li key={value.name}>
            <span className="selectable bold">{value.name}</span>
            {description && <div className="graphql-explorer__defs__description">
              <MarkdownPreview markdown={description} />
            </div>}
          </li>;
        })}
      </ul>
    </Fragment>
  </div>;
};
