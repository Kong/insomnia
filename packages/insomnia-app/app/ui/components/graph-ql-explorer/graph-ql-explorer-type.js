// @flow
import * as React from 'react';
import GraphQLExplorerTypeLink from './graph-ql-explorer-type-link';
import autobind from 'autobind-decorator';
import MarkdownPreview from '../markdown-preview';
import GraphQLExplorerFieldLink from './graph-ql-explorer-field-link';
import type { GraphQLType, GraphQLField } from 'graphql';

type Props = {
  onNavigateType: (type: Object) => void,
  onNavigateField: (field: Object) => void,
  type: GraphQLType,
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
    const { type, onNavigateType } = this.props;

    if (
      Object.prototype.toString.call(type) !== '[object GraphQLUnionType]' &&
      Object.prototype.toString.call(type.getTypes) !== '[object Function]'
    ) {
      return null;
    }
    // $FlowFixMe
    const types = type.getTypes();
    return (
      <React.Fragment>
        <h2 className="graphql-explorer__subheading">Possible Types</h2>
        <ul className="graphql-explorer__defs">
          {Object.keys(types).map(key => {
            return (
              <li>
                <GraphQLExplorerTypeLink onNavigate={onNavigateType} type={types[key]} />
              </li>
            );
          })}
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

    return (
      <React.Fragment>
        <h2 className="graphql-explorer__subheading">Fields</h2>
        <ul className="graphql-explorer__defs">
          {Object.keys(fields).map(key => {
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

            const description = field.description;
            return (
              <li key={key}>
                {fieldLink}
                {argLinks}: {typeLink}
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
