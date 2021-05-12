import type { GraphQLField, GraphQLSchema } from 'graphql';
import React, { PureComponent } from 'react';
import GraphQLExplorerType, { GraphQLFieldWithParentName } from './graph-ql-explorer-type';
import GraphQLExplorerTypeLink from './graph-ql-explorer-type-link';
import { debounce } from 'lodash';

interface Props {
  schema: GraphQLSchema;
  filter: string;
  onNavigateType: (type: Record<string, any>) => void;
  onNavigateField: (field: Record<string, any>) => void;
}

interface State {
  foundTypes: JSX.Element | null;
  foundFields: JSX.Element | null;
}

const SEARCH_UPDATE_DELAY_IN_MS = 300;
const MAX_RENDERED_ELEMENTS = 100;

class GraphQLExplorerSearchResults extends PureComponent<Props, State> {
  // this ref is used to check if the component is still mounted while updating the search results
  ref: React.RefObject<HTMLDivElement> = React.createRef();

  state = {
    foundTypes: null,
    foundFields: null,
  };

  componentDidUpdate(prevProps: Props) {
    if (prevProps.filter !== this.props.filter) {
      this.updateSearchResults();
    }
  }

  componentDidMount() {
    this.updateSearchResults();
  }

  updateSearchResults = debounce(() => {
    if (this.ref.current) {
      this.setState({
        foundFields: this.renderFoundFields(),
        foundTypes: this.renderFoundTypes(),
      });
    }
  }, SEARCH_UPDATE_DELAY_IN_MS);

  renderFoundTypes() {
    const { schema, filter, onNavigateType } = this.props;
    const typeMap = schema.getTypeMap();

    const types = Object.values(typeMap).filter(type =>
      type.name.toLowerCase().includes(filter.toLowerCase()),
    );

    const numberOfTypes = types.length;
    if (numberOfTypes > MAX_RENDERED_ELEMENTS) {
      types.length = MAX_RENDERED_ELEMENTS;
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
    const { schema, filter, onNavigateType, onNavigateField } = this.props;
    const typeMap = schema.getTypeMap();
    const fields = Object.values(typeMap).reduce((acc, type: any) => {
      if (typeof type.getFields !== 'function') {
        return acc;
      }

      const fields: Array<GraphQLField<any, any>> = type.getFields();
      const relevantFields: Array<GraphQLFieldWithParentName> = Object.values(fields)
        .filter(
          field =>
            field.name.toLowerCase().includes(filter.toLowerCase()) ||
            field.args?.some(arg => arg.name.toLowerCase().includes(filter.toLowerCase())),
        )
        .map(field => ({ ...field, parentName: type.name }));
      return [...acc, ...relevantFields];
    }, []);

    const numberOfFields = fields.length;
    if (numberOfFields > MAX_RENDERED_ELEMENTS) {
      fields.length = MAX_RENDERED_ELEMENTS;
    }

    return (
      <>
        {GraphQLExplorerType.renderFieldsList(fields, onNavigateType, onNavigateField)}
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
        {this.state.foundTypes}
        <h2 className="graphql-explorer__subheading">Found Fields</h2>
        {this.state.foundFields}
      </div>
    );
  }
}

export default GraphQLExplorerSearchResults;
