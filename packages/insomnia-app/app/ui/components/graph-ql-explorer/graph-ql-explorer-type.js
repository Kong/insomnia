// @flow
import * as React from 'react';
import { SvgIcon } from 'insomnia-components';
import GraphQLExplorerTypeLink from './graph-ql-explorer-type-link';
import autobind from 'autobind-decorator';
import MarkdownPreview from '../markdown-preview';
import GraphQLExplorerFieldLink from './graph-ql-explorer-field-link';
import type { GraphQLField, GraphQLSchema, GraphQLType } from 'graphql';
import { GraphQLInterfaceType, GraphQLObjectType, GraphQLUnionType } from 'graphql';
import GraphQLDefaultValue from './graph-ql-default-value';
import Tooltip from '../../components/tooltip';

type Props = {
  onNavigateType: (type: Object) => void,
  onNavigateField: (field: Object) => void,
  type: GraphQLType,
  schema: GraphQLSchema | null,
};

@autobind
class GraphQLExplorerType extends React.PureComponent<Props> {
  _handleNavigateType(type: Object) {
    const { onNavigateType } = this.props;
    onNavigateType(type);
  }

  _handleNavigateField(field: Object) {
    const { onNavigateField } = this.props;
    onNavigateField(field);
  }

  renderDescription() {
    const { type } = this.props;
    return <MarkdownPreview markdown={type.description || '*no description*'} />;
  }

  renderTypesMaybe() {
    const { schema, type, onNavigateType } = this.props;

    if (schema === null) {
      return null;
    }

    let title = 'Types';
    let types = [];

    if (type instanceof GraphQLUnionType) {
      title = 'Possible Types';
      types = schema.getPossibleTypes(type);
    } else if (type instanceof GraphQLInterfaceType) {
      title = 'Implementations';
      types = schema.getPossibleTypes(type);
    } else if (type instanceof GraphQLObjectType) {
      title = 'Implements';
      types = type.getInterfaces();
    } else {
      return null;
    }

    return (
      <React.Fragment>
        <h2 className="graphql-explorer__subheading">{title}</h2>
        <ul className="graphql-explorer__defs">
          {types.map(type => (
            <li key={type.name}>
              <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={type} />
            </li>
          ))}
        </ul>
      </React.Fragment>
    );
  }

  renderFieldsMaybe() {
    const { type, onNavigateType } = this.props;
    if (typeof type.getFields !== 'function') {
      return null;
    }

    // $FlowFixMe
    const fields = type.getFields();
    const fieldKeys = Object.keys(fields).sort((a, b) => a.localeCompare(b));

    return (
      <React.Fragment>
        <h2 className="graphql-explorer__subheading">Fields</h2>
        <ul className="graphql-explorer__defs">
          {fieldKeys.map(key => {
            const field: GraphQLField<any, any> = (fields[key]: any);

            let argLinks = null;
            const args = (field: any).args;
            if (args && args.length) {
              argLinks = (
                <React.Fragment>
                  (
                  {args.map(a => (
                    <div key={a.name} className="graphql-explorer__defs__arg">
                      <span className="info">{a.name}</span>:{' '}
                      <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={a.type} />
                    </div>
                  ))}
                  )
                </React.Fragment>
              );
            }

            const fieldLink = (
              <GraphQLExplorerFieldLink onNavigate={this._handleNavigateField} field={field} />
            );

            const typeLink = (
              <GraphQLExplorerTypeLink onNavigate={this._handleNavigateType} type={field.type} />
            );

            const isDeprecated = field.isDeprecated;
            const description = field.description;
            return (
              <li key={key}>
                {fieldLink}
                {argLinks}: {typeLink} <GraphQLDefaultValue field={field} />
                {isDeprecated && (
                  <Tooltip
                    message={`The field "${field.name}" is deprecated. ${field.deprecationReason}`}
                    position="bottom"
                    delay={1000}>
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
      </React.Fragment>
    );
  }

  render() {
    return (
      <div className="graphql-explorer__type">
        {this.renderDescription()}
        {this.renderTypesMaybe()}
        {this.renderFieldsMaybe()}
      </div>
    );
  }
}

export default GraphQLExplorerType;
