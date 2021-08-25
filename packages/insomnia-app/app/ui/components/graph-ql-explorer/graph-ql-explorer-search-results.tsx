import { GraphQLNamedType, GraphQLSchema, GraphQLType } from 'graphql';
import React, { PureComponent } from 'react';

import { fuzzyMatch, fuzzyMatchAll } from '../../../common/misc';
import { GraphQLExplorerFieldsList } from './graph-ql-explorer-fields-list';
import GraphQLExplorerTypeLink from './graph-ql-explorer-type-link';
import { GraphQLFieldWithOptionalArgs, GraphQLFieldWithParentName } from './graph-ql-types';

interface Props {
  schema: GraphQLSchema;
  filter: string;
  onNavigateType: (type: GraphQLType) => void;
  onNavigateField: (field: GraphQLFieldWithParentName) => void;
}

interface State {
  foundTypes: GraphQLNamedType[];
  foundFields: GraphQLFieldWithParentName[];
  displayedTypeBatches: number;
  displayedFieldBatches: number;
}

const BATCH_SIZE = 100;

class GraphQLExplorerSearchResults extends PureComponent<Props, State> {
  // this ref is used to check if the component is still mounted while updating the search results
  ref: React.RefObject<HTMLDivElement> = React.createRef();

  state: State = {
    foundTypes: [],
    foundFields: [],
    displayedTypeBatches: 1,
    displayedFieldBatches: 1,
  };

  componentDidUpdate(prevProps: Props) {
    if (prevProps.filter !== this.props.filter) {
      this.updateSearchResults();
    }
  }

  componentDidMount() {
    this.updateSearchResults();
  }

  updateSearchResults() {
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

    const types = Object
      .values(typeMap)
      .filter(({ name }) => Boolean(fuzzyMatch(filter, name, { splitSpace: true, loose: true })));

    return types;
  }

  searchForFields() {
    const { schema, filter } = this.props;
    const typeMap = schema.getTypeMap();
    const fields = Object.values(typeMap).reduce((acc: GraphQLFieldWithParentName[], type: any) => {
      if (typeof type.getFields !== 'function') {
        return acc;
      }

      const fields: GraphQLFieldWithOptionalArgs[] = type.getFields();
      const relevantFields: GraphQLFieldWithParentName[] = Object
        .values(fields)
        // Fuzzy match on field.name and field.args[*].name
        .filter(({ name, args }) => Boolean(fuzzyMatchAll(filter, [name, ...(args?.map(arg => arg.name) || [])], { splitSpace: true, loose: true })))
        .map(field => ({ ...field, parentName: type.name }));
      return [...acc, ...relevantFields];
    }, []);

    return fields;
  }

  renderFoundTypes() {
    const { onNavigateType } = this.props;
    const { foundTypes, displayedTypeBatches } = this.state;

    const numberOfAllTypes = foundTypes.length;
    const numberOfTypesToRender = BATCH_SIZE * displayedTypeBatches;

    if (!foundTypes.length) {
      return null;
    }

    return (
      <>
        <ul className="graphql-explorer__defs">
          {foundTypes.slice(0, numberOfTypesToRender).map(type => (
            <li key={type.name}>
              <GraphQLExplorerTypeLink type={type} onNavigate={onNavigateType} />
            </li>
          ))}
        </ul>
        {numberOfAllTypes > numberOfTypesToRender && (
          <a
            href="#"
            className="surprise"
            onClick={() => this.setState(({ displayedTypeBatches: oldValue }) => ({ displayedTypeBatches: oldValue + 1 }))}
          >
            And {numberOfAllTypes - numberOfTypesToRender} more types found... Click here to show {BATCH_SIZE} more.
          </a>
        )}
      </>
    );
  }

  renderFoundFields() {
    const { onNavigateType, onNavigateField } = this.props;
    const { foundFields, displayedFieldBatches } = this.state;

    const numberOfAllFields = foundFields.length;
    const numberOfFieldsToRender = BATCH_SIZE * displayedFieldBatches;

    if (!foundFields.length) {
      return null;
    }

    return (
      <>
        <GraphQLExplorerFieldsList
          fields={foundFields.slice(0, numberOfFieldsToRender)}
          onNavigateType={onNavigateType}
          onNavigateField={onNavigateField}
        />
        {numberOfAllFields > numberOfFieldsToRender && (
          <a
            href="#"
            className="surprise"
            onClick={() => this.setState(({ displayedFieldBatches: oldValue }) => ({ displayedFieldBatches: oldValue + 1 }))}
          >
            And {numberOfAllFields - numberOfFieldsToRender} more fields found... Click here to show {BATCH_SIZE} more.
          </a>
        )}
      </>
    );
  }

  render() {
    const { foundTypes, foundFields } = this.state;
    return (
      <div ref={this.ref} className="graphql-explorer__search-reults">
        {!foundTypes.length && !foundFields.length && <p>No results found.</p>}
        {foundTypes.length > 0 && <h2 className="graphql-explorer__subheading">Found Types</h2>}
        {this.renderFoundTypes()}
        {foundFields.length > 0 && <h2 className="graphql-explorer__subheading">Found Fields</h2>}
        {this.renderFoundFields()}
      </div>
    );
  }
}

export default GraphQLExplorerSearchResults;
