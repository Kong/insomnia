import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { SchemaReference } from 'codemirror-graphql/utils/SchemaReference';
import { GraphQLField, GraphQLNamedType, GraphQLSchema, GraphQLType, isNamedType } from 'graphql';
import { GraphQLEnumType } from 'graphql';
import React, { PureComponent } from 'react';
import { createRef } from 'react';

import { AUTOBIND_CFG } from '../../../common/constants';
import { hotKeyRefs } from '../../../common/hotkeys';
import { executeHotKey } from '../../../common/hotkeys-listener';
import DebouncedInput from '../base/debounced-input';
import KeydownBinder from '../keydown-binder';
import GraphQLExplorerEnum from './graph-ql-explorer-enum';
import GraphQLExplorerField from './graph-ql-explorer-field';
import GraphQLExplorerSchema from './graph-ql-explorer-schema';
import GraphQLExplorerSearchResults from './graph-ql-explorer-search-results';
import GraphQLExplorerType from './graph-ql-explorer-type';
import { ActiveReference, GraphQLFieldWithParentName } from './graph-ql-types';

function getReferenceInfo(reference: SchemaReference) {
  let field: GraphQLField<any, any, { [key: string]: any }> | undefined;
  if ('field' in reference) {
    field = reference.field;
  }

  let type: GraphQLType | undefined;
  if ('type' in reference) {
    type = reference.type;
  }

  return { type, field };
}

function isSameFieldAndType(
  currentType?: GraphQLType,
  type?: GraphQLType,
  currentField?: GraphQLFieldWithParentName,
  field?: GraphQLField<any, any, { [key: string]: any }>
) {
  // @TODO Simplify this function since it's hard to follow along
  const compare = <
    T extends GraphQLNamedType | GraphQLFieldWithParentName,
    U extends GraphQLNamedType | GraphQLFieldWithParentName
  >(a?: T, b?: U) => (!a && !b) || (a && b && a.name === b.name);

  if (!isNamedType(currentType)) {
    currentType = undefined;
  }

  if (!isNamedType(type)) {
    type = undefined;
  }

  const isSameType = compare(currentType, type);

  const isSameField = compare(currentField, field);
  return isSameType && isSameField;
}

interface Props {
  handleClose: () => void;
  schema: GraphQLSchema | null;
  visible: boolean;
  reference: null | ActiveReference;
}

interface HistoryItem {
  currentType?: GraphQLType;
  currentField?: GraphQLFieldWithParentName;
}

interface State extends HistoryItem {
  history: HistoryItem[];
  filter: string;
}

const SEARCH_UPDATE_DELAY_IN_MS = 300;

@autoBindMethodsForReact(AUTOBIND_CFG)
class GraphQLExplorer extends PureComponent<Props, State> {
  state: State = {
    history: [],
    currentType: undefined,
    currentField: undefined,
    filter: '',
  };

  _searchInput = createRef<DebouncedInput>();

  _handleKeydown(e: KeyboardEvent) {
    executeHotKey(e, hotKeyRefs.GRAPHQL_EXPLORER_FOCUS_FILTER, () => {
      this._navigateToSchema();
      this._focusAndSelectFilterInput();
    });
  }

  _focusAndSelectFilterInput() {
    if (this._searchInput) {
      this._searchInput.current?.focus();
      this._searchInput.current?.select();
    }
  }

  _navigateToSchema() {
    this.setState({
      currentType: undefined,
      currentField: undefined,
      history: this._addToHistory(),
    });
  }

  _handleNavigateType(type: GraphQLType) {
    this.setState({
      currentType: type,
      currentField: undefined,
      history: this._addToHistory(),
    });
  }

  _handleNavigateField(field: GraphQLFieldWithParentName) {
    this.setState({
      currentType: field.type,
      currentField: field,
      history: this._addToHistory(),
    });
  }

  _handlePopHistory() {
    this.setState(({ history }) => {
      const last = history[history.length - 1] || null;
      return {
        history: history.slice(0, history.length - 1),
        currentType: last ? last.currentType : undefined,
        currentField: last ? last.currentField : undefined,
      };
    });
  }

  _addToHistory() {
    const { currentType, currentField, history } = this.state;

    // Nothing to add
    if (!currentType && !currentField) {
      return history;
    }

    return [
      ...history,
      {
        currentType,
        currentField,
      },
    ];
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    const { reference } = nextProps;

    if (!reference) {
      return;
    }

    const { currentField, currentType } = this.state;
    const { type, field } = getReferenceInfo(reference);

    if (isSameFieldAndType(currentType, type, currentField, field)) {
      return;
    }

    const history = this._addToHistory();

    this.setState({
      history,
      currentType: type,
      currentField: field,
    });
  }

  renderHistoryItem() {
    const { history, currentField, currentType } = this.state;

    if (history.length === 0 && (currentType || currentField)) {
      return (
        <a
          href="#"
          className="graphql-explorer__header__back-btn"
          onClick={e => {
            e.preventDefault();

            this._handlePopHistory();
          }}
        >
          <i className="fa--skinny fa fa-angle-left" /> Schema
        </a>
      );
    } else if (history.length === 0) {
      return null;
    }

    const { currentType: lastType, currentField: lastField } = history[history.length - 1];
    let name: string | null = null;

    if (lastField) {
      name = lastField.name || 'Unknown';
    } else if (lastType) {
      if (isNamedType(lastType)) {
        name = lastType.name;
      } else {
        name = 'Unknown';
      }
    } else {
      return null;
    }

    return (
      <a
        href="#"
        className="graphql-explorer__header__back-btn"
        onClick={e => {
          e.preventDefault();

          this._handlePopHistory();
        }}
      >
        <i className="fa--skinny fa fa-angle-left" /> {name}
      </a>
    );
  }

  _handleFilterChange(filter: string) {
    this.setState({ filter });
  }

  renderSearchInput() {
    return (
      <div className="graphql-explorer__search">
        <div className="form-control form-control--outlined form-control--btn-right">
          <DebouncedInput
            ref={this._searchInput}
            onChange={this._handleFilterChange}
            placeholder="Search the docs..."
            delay={SEARCH_UPDATE_DELAY_IN_MS}
            initialValue={this.state.filter}
          />
          {this.state.filter && (
            <button
              className="form-control__right"
              onClick={() => {
                this._searchInput.current?.setValue('');
                this._handleFilterChange('');
              }}
            >
              <i className="fa fa-times-circle" />
            </button>
          )}
        </div>
      </div>
    );
  }

  render() {
    const { schema, handleClose, visible } = this.props;

    if (!visible) {
      return null;
    }

    const { currentType, currentField } = this.state;
    let child: JSX.Element | null = null;

    if (currentField) {
      child = (
        <GraphQLExplorerField onNavigateType={this._handleNavigateType} field={currentField} />
      );
    } else if (currentType && currentType instanceof GraphQLEnumType) {
      child = <GraphQLExplorerEnum type={currentType} />;
    } else if (currentType) {
      child = (
        <GraphQLExplorerType
          schema={schema}
          type={currentType}
          onNavigateType={this._handleNavigateType}
          onNavigateField={this._handleNavigateField}
        />
      );
    } else if (schema) {
      child = (
        <>
          {this.renderSearchInput()}
          {this.state.filter ? (
            <GraphQLExplorerSearchResults
              schema={schema}
              filter={this.state.filter}
              onNavigateType={this._handleNavigateType}
              onNavigateField={this._handleNavigateField}
            />
          ) : (
            <GraphQLExplorerSchema
              onNavigateType={this._handleNavigateType}
              schema={schema}
            />
          )}
        </>
      );
    }

    if (!child) {
      return null;
    }

    const fieldName = currentField ? currentField.name : null;

    const typeName = isNamedType(currentType) ? currentType.name : null;
    const schemaName = schema ? 'Schema' : null;
    return (
      <KeydownBinder onKeydown={this._handleKeydown}>
        <div className="graphql-explorer theme--dialog">
          <div className="graphql-explorer__header">
            {this.renderHistoryItem()}
            <h1>{fieldName || typeName || schemaName || 'Unknown'}</h1>
            <button
              className="btn btn--compact graphql-explorer__header__close-btn"
              onClick={handleClose}
            >
              <i className="fa fa-close" />
            </button>
          </div>
          <div className="graphql-explorer__body">{child}</div>
        </div>
      </KeydownBinder>
    );
  }
}

export default GraphQLExplorer;
