import type { GraphQLType } from 'graphql';
import { SvgIcon } from 'insomnia-components';
import React, { Fragment } from 'react';

import Tooltip from '../../components/tooltip';
import MarkdownPreview from '../markdown-preview';
import GraphQLDefaultValue from './graph-ql-default-value';
import { GraphQLFieldWithParentName } from './graph-ql-explorer';
import GraphQLExplorerFieldLink from './graph-ql-explorer-field-link';
import GraphQLExplorerTypeLink from './graph-ql-explorer-type-link';

interface Props {
  fields: GraphQLFieldWithParentName[];
  onNavigateType: (type: GraphQLType) => void;
  onNavigateField: (field: GraphQLFieldWithParentName) => void;
}

export const GraphQLExplorerFieldsList = (props: Props) => {
  const { fields, onNavigateType, onNavigateField } = props;
  return (
    <ul className="graphql-explorer__defs">
      {fields.map(field => {
        let argLinks: JSX.Element | null = null;
        const { args } = field;

        if (args && args.length) {
          argLinks = (
            <Fragment>
              (
              {args.map(a => (
                <div key={a.name} className="graphql-explorer__defs__arg">
                  <span className="info">{a.name}</span>:{' '}
                  <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={a.type} />
                </div>
              ))}
              )
            </Fragment>
          );
        }

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
      })}
    </ul>
  );
};
