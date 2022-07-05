import { GraphQLEnumType } from 'graphql';
import React, { FC } from 'react';

import { MarkdownPreview } from '../markdown-preview';

interface Props {
  type: GraphQLEnumType;
}

export const GraphQLExplorerEnum: FC<Props> = ({ type }) => {
  const values = type.getValues();

  return (
    <div className="graphql-explorer__type">
      <MarkdownPreview markdown={type.description || '*no description*'} />

      <h2 className="graphql-explorer__subheading">Values</h2>
      <ul className="graphql-explorer__defs">
        {values.map(value => (
          <li key={value.name}>
            <span className="selectable bold">{value.name}</span>
            <div className="graphql-explorer__defs__description">
              <MarkdownPreview
                markdown={value.description || `This is a long paragraph that is a description for the enum value ${value.name}`}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
};
