import type { GraphQLField, GraphQLNamedType, GraphQLSchema, GraphQLType } from 'graphql';
import React, { PureComponent } from 'react';

import { GraphQLFieldWithParentName } from './graph-ql-explorer';
import { GraphQLExplorerFieldsList } from './graph-ql-explorer-fields-list';
import GraphQLExplorerTypeLink from './graph-ql-explorer-type-link';

interface Props {
  schema: GraphQLSchema;
  filter: string;
  onNavigateType: (type: GraphQLType) => void;
  onNavigateField: (field: GraphQLFieldWithParentName) => void;
}

interface State {
  foundTypes: GraphQLNamedType[];
  foundFields: GraphQLFieldWithParentName[];
}

const MAX_RENDERED_ELEMENTS = 100;

class GraphQLExplorerSearchResults extends PureComponent<Props, State> {
  // this ref is used to check if the component is still mounted while updating the search results
  ref: React.RefObject<HTMLDivElement> = React.createRef();

  state = {
    foundTypes: [],
    foundFields: [],
  };

  componentDidUpdate(prevProps: Props) {
    if (prevProps.filter !== this.props.filter) {
      this.updateSearchResults();
    }
  }

  componentDidMount() {
    this.updateSearchResults();
  }

  updateSearchResults = () => {
    if (this.ref.current) {
      this.setState({
        foundFields: this.searchForFields(),
        foundTypes: this.searchForTypes(),
      });
    }
  }

  searchForTypes() {
    const { schema, filter } = this.props;
    const typeMap = schema.getTypeMap();

    const types = Object.values(typeMap).filter(type =>
      type.name.toLowerCase().includes(filter.toLowerCase()),
    );

    return types;
  }

  searchForFields() {
    const { schema, filter } = this.props;
    const typeMap = schema.getTypeMap();
    const fields = Object.values(typeMap).reduce((acc, type: any) => {
      if (typeof type.getFields !== 'function') {
        return acc;
      }

      const fields: GraphQLField<any, any>[] = type.getFields();
      const relevantFields: GraphQLFieldWithParentName[] = Object.values(fields)
        .filter(
          field =>
            field.name.toLowerCase().includes(filter.toLowerCase()) ||
            field.args?.some(arg => arg.name.toLowerCase().includes(filter.toLowerCase())),
        )
        .map(field => ({ ...field, parentName: type.name }));
      return [...acc, ...relevantFields];
    }, []);

    return fields;
  }

  renderFoundTypes() {
    const { onNavigateType } = this.props;
    const types: GraphQLNamedType[] = [...this.state.foundTypes];

    const numberOfTypes = types.length;
    if (numberOfTypes > MAX_RENDERED_ELEMENTS) {
      types.length = MAX_RENDERED_ELEMENTS;
    }

    if (!types.length) {
      return null;
    }

    return (
      <>
        <ul className="graphql-explorer__defs">
          {types.map(type => (
            <li key={type.name}>
              <GraphQLExplorerTypeLink type={type} onNavigate={onNavigateType} />
            </li>
          ))}
        </ul>
        {numberOfTypes > MAX_RENDERED_ELEMENTS && (
          <p>And {numberOfTypes - MAX_RENDERED_ELEMENTS} more types found...</p>
        )}
      </>
    );
  }

  renderFoundFields() {
    const { onNavigateType, onNavigateField } = this.props;
    const fields: GraphQLFieldWithParentName[] = [...this.state.foundFields];

    const numberOfFields = fields.length;
    if (numberOfFields > MAX_RENDERED_ELEMENTS) {
      fields.length = MAX_RENDERED_ELEMENTS;
    }

    if (!fields.length) {
      return null;
    }

    return (
      <>
        <GraphQLExplorerFieldsList
          fields={fields}
          onNavigateType={onNavigateType}
          onNavigateField={onNavigateField}
        />
        {numberOfFields > MAX_RENDERED_ELEMENTS && (
          <p>And {numberOfFields - MAX_RENDERED_ELEMENTS} more fields found...</p>
        )}
      </>
    );
  }

  render() {
    return (
      <div ref={this.ref} className="graphql-explorer__search-reults">
        <h2 className="graphql-explorer__subheading">Found Types</h2>
        {this.renderFoundTypes()}
        <h2 className="graphql-explorer__subheading">Found Fields</h2>
        {this.renderFoundFields()}
      </div>
    );
  }
}

export default GraphQLExplorerSearchResults;
