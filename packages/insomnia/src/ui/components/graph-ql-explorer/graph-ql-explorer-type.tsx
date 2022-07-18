import { GraphQLInterfaceType, GraphQLObjectType, GraphQLSchema, GraphQLType, GraphQLUnionType } from 'graphql';
import React, { FC, Fragment } from 'react';

import { ascendingNameSort } from '../../../common/sorting';
import { MarkdownPreview } from '../markdown-preview';
import { GraphQLExplorerFieldsList } from './graph-ql-explorer-fields-list';
import { GraphQLExplorerTypeLink } from './graph-ql-explorer-type-link';
import { type GraphQLFieldWithParentName } from './graph-ql-types';

interface Props {
  onNavigateType: (type: GraphQLType) => void;
  onNavigateField: (field: GraphQLFieldWithParentName) => void;
  type: GraphQLType;
  schema: GraphQLSchema | null;
}
export const GraphQLExplorerType: FC<Props> = ({ schema, type, onNavigateType, onNavigateField }) => {
  const getTitle = () => {
    if (type instanceof GraphQLUnionType) {
      return 'Possible Types';
    }
    if (type instanceof GraphQLInterfaceType) {
      return 'Implementations';
    }
    if (type instanceof GraphQLObjectType) {
      return 'Implements';
    }
    return 'Types';
  };
  const getTypes = () => {
    const isUnionOrInterface = type instanceof GraphQLUnionType || type instanceof GraphQLInterfaceType;
    if (schema && isUnionOrInterface) {
      return schema.getPossibleTypes(type);
    }
    if (type instanceof GraphQLObjectType) {
      return type.getInterfaces();
    }
    return [];
  };

  const markdown = ('description' in type) ? (type.description || '') : '*no description*';

  const types = getTypes();
  const hasSchemaAndTypes = schema && types.length;

  const title = getTitle();

  const sortedFields = 'getFields' in type ? Object.values(type.getFields()).sort(ascendingNameSort) : [];

  return (
    <div className="graphql-explorer__type">
      <MarkdownPreview markdown={markdown} />
      {hasSchemaAndTypes ?
        <Fragment>
          <h2 className="graphql-explorer__subheading">{title}</h2>
          <ul className="graphql-explorer__defs">
            {types.map(type => (
              <li key={type.name}>
                <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={type} />
              </li>
            ))}
          </ul>
        </Fragment>
        : null}
      {sortedFields.length
        ? (<Fragment>
          <h2 className="graphql-explorer__subheading">Fields</h2>
          <GraphQLExplorerFieldsList
            fields={sortedFields}
            onNavigateType={onNavigateType}
            onNavigateField={onNavigateField}
          />
        </Fragment>)
        : null}
    </div>
  );
};
