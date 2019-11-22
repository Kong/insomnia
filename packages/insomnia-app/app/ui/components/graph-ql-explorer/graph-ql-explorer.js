// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import GraphQLExplorerField from './graph-ql-explorer-field';
import GraphQLExplorerType from './graph-ql-explorer-type';
import type { GraphQLArgument, GraphQLField, GraphQLSchema, GraphQLType } from 'graphql';
import { GraphQLEnumType } from 'graphql';
import GraphQLExplorerSchema from './graph-ql-explorer-schema';
import GraphQLExplorerEnum from './graph-ql-explorer-enum';

type Props = {
  handleClose: () => void,
  schema: GraphQLSchema | null,
  visible: boolean,
  reference: null | {
    type: GraphQLType | GraphQLEnumType | null,
    argument: GraphQLArgument | null,
    field: GraphQLField<any, any> | null,
  },
};

type HistoryItem = {
  currentType: null | GraphQLType | GraphQLEnumType,
  currentField: null | GraphQLField<any, any>,
};

type State = HistoryItem & {
  history: Array<HistoryItem>,
};

@autobind
class GraphQLExplorer extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      history: [],
      currentType: null,
      currentField: null,
    };
  }

  _handleNavigateType(type: GraphQLType | GraphQLEnumType) {
    this.setState({
      currentType: type,
      currentField: null,
      history: this._addToHistory(),
    });
  }

  _handleNavigateField(field: GraphQLField<any, any>) {
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
        currentType: last ? last.currentType : null,
        currentField: last ? last.currentField : null,
      };
    });
  }

  _addToHistory() {
    const { currentType, currentField, history } = this.state;

    // Nothing to add
    if (!currentType && !currentField) {
      return history;
    }

    return [...history, { currentType, currentField }];
  }

  // eslint-disable-next-line camelcase
  UNSAFE_componentWillReceiveProps(nextProps: Props) {
    if (!nextProps.reference) {
      return;
    }

    const { type, field } = nextProps.reference;
    const { currentType, currentField } = this.state;

    const compare = (a: any, b: any) => (!a && !b) || (a && b && a.name === b.name);

    const sameType = compare(currentType, type);
    const sameField = compare(currentField, field);
    const nothingChanged = sameType && sameField;

    if (nothingChanged) {
      return;
    }

    let history = this._addToHistory();

    this.setState({
      history,
      currentType: type || null,
      currentField: field || null,
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
          }}>
          <i className="fa--skinny fa fa-angle-left" /> Schema
        </a>
      );
    } else if (history.length === 0) {
      return null;
    }

    const { currentType: lastType, currentField: lastField } = history[history.length - 1];

    let name = null;

    if (lastField) {
      name = (lastField: any).name || 'Unknown';
    } else if (lastType) {
      name = (lastType: any).name || 'Unknown';
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
        }}>
        <i className="fa--skinny fa fa-angle-left" /> {name}
      </a>
    );
  }

  render() {
    const { schema, handleClose, visible } = this.props;

    if (!visible) {
      return null;
    }

    const { currentType, currentField } = this.state;

    let child = null;
    if (currentField) {
      child = (
        <GraphQLExplorerField onNavigateType={this._handleNavigateType} field={currentField} />
      );
    } else if (currentType && currentType instanceof GraphQLEnumType) {
      child = <GraphQLExplorerEnum type={currentType} />;
    } else if (currentType) {
      child = (
        <GraphQLExplorerType
          type={currentType}
          onNavigateType={this._handleNavigateType}
          onNavigateField={this._handleNavigateField}
        />
      );
    } else if (schema) {
      child = <GraphQLExplorerSchema onNavigateType={this._handleNavigateType} schema={schema} />;
    }

    if (!child) {
      return null;
    }

    const fieldName = currentField ? (currentField: any).name : null;
    const typeName = currentType ? (currentType: any).name : null;
    const schemaName = schema ? 'Schema' : null;

    return (
      <div className="graphql-explorer theme--dialog">
        <div className="graphql-explorer__header">
          {this.renderHistoryItem()}
          <h1>{fieldName || typeName || schemaName || 'Unknown'}</h1>
          <button
            className="btn btn--compact graphql-explorer__header__close-btn"
            onClick={handleClose}>
            <i className="fa fa-close" />
          </button>
        </div>
        <div className="graphql-explorer__body">{child}</div>
      </div>
    );
  }
}

export default GraphQLExplorer;
