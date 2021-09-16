import type { GraphQLType } from 'graphql';
import { SvgIcon } from 'insomnia-components';
import React, { FC } from 'react';

import Tooltip from '../../components/tooltip';
import MarkdownPreview from '../markdown-preview';
import { GraphQLDefaultValue } from './graph-ql-default-value';
import { GraphQLExplorerArgLinks } from './graph-ql-explorer-arg-links';
import GraphQLExplorerFieldLink from './graph-ql-explorer-field-link';
import GraphQLExplorerTypeLink from './graph-ql-explorer-type-link';
import { GraphQLFieldWithParentName } from './graph-ql-types';

interface Props {
  fields: GraphQLFieldWithParentName[];
  onNavigateType: (type: GraphQLType) => void;
  onNavigateField: (field: GraphQLFieldWithParentName) => void;
}

export const GraphQLExplorerFieldsList: FC<Props> = ({ fields, onNavigateType, onNavigateField }) => {
  const fieldsList = fields.map(field => {
    const argLinks = <GraphQLExplorerArgLinks onNavigate={onNavigateType} args={field.args || []} />;
    const fieldLink = <GraphQLExplorerFieldLink onNavigate={onNavigateField} field={field} />;
    const typeLink = <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={field.type} />;

    const isDeprecated = field.isDeprecated;
    const description = field.description;

    return (
      <li key={field.name + field.parentName}>
        {fieldLink}
        {argLinks}: {typeLink} <GraphQLDefaultValue field={field} />
        {isDeprecated && (
          <Tooltip
            message={`The field "${field.name}" is deprecated. ${field.deprecationReason}`}
            position="bottom"
            delay={1000}
          >
            <SvgIcon icon="warning" />
          </Tooltip>
        )}
        {description && (
          <div className="graphql-explorer__defs__description">
            <MarkdownPreview markdown={description} />
          </div>
        )}
      </li>
    );
  });

  return (
    <ul className="graphql-explorer__defs">
      {fieldsList}
    </ul>
  );
};
