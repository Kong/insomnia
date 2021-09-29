import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { GraphQLSchema, GraphQLType } from 'graphql';
import { GraphQLInterfaceType, GraphQLObjectType, GraphQLUnionType } from 'graphql';
import React, { Fragment, PureComponent } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { ascendingNameSort } from '../../../common/sorting';
import { MarkdownPreview } from '../markdown-preview';
import { GraphQLExplorerFieldsList } from './graph-ql-explorer-fields-list';
import { GraphQLExplorerTypeLink } from './graph-ql-explorer-type-link';

interface Props {
  onNavigateType: (type: Record<string, any>) => void;
  onNavigateField: (field: Record<string, any>) => void;
  type: GraphQLType;
  schema: GraphQLSchema | null;
}

@autoBindMethodsForReact(AUTOBIND_CFG)
export class GraphQLExplorerType extends PureComponent<Props> {
  _handleNavigateType(type: Record<string, any>) {
    const { onNavigateType } = this.props;
    onNavigateType(type);
  }

  _handleNavigateField(field: Record<string, any>) {
    const { onNavigateField } = this.props;
    onNavigateField(field);
  }

  renderDescription() {
    const { type } = this.props;
    // @ts-expect-error -- TSCONVERSION
    return <MarkdownPreview markdown={type.description || '*no description*'} />;
  }

  renderTypesMaybe() {
    const { schema, type, onNavigateType } = this.props;

    if (schema === null) {
      return null;
    }

    let title = 'Types';
    let types: GraphQLInterfaceType[] | GraphQLObjectType[] = [];

    if (type instanceof GraphQLUnionType) {
      title = 'Possible Types';
      // @ts-expect-error -- TSCONVERSION
      types = schema.getPossibleTypes(type);
    } else if (type instanceof GraphQLInterfaceType) {
      title = 'Implementations';
      // @ts-expect-error -- TSCONVERSION
      types = schema.getPossibleTypes(type);
    } else if (type instanceof GraphQLObjectType) {
      title = 'Implements';
      types = type.getInterfaces();
    } else {
      return null;
    }

    return (
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
    );
  }

  renderFieldsMaybe() {
    const { type } = this.props;

    // @ts-expect-error -- TSCONVERSION
    if (typeof type.getFields !== 'function') {
      return null;
    }

    // @ts-expect-error -- TSCONVERSION
    const fields: GraphQLFieldWithOptionalArgs[] = type.getFields();
    const sortedFields = Object.values(fields).sort(ascendingNameSort);
    return (
      <Fragment>
        <h2 className="graphql-explorer__subheading">Fields</h2>
        <GraphQLExplorerFieldsList
          fields={sortedFields}
          onNavigateType={this._handleNavigateType}
          onNavigateField={this._handleNavigateField}
        />
      </Fragment>
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
