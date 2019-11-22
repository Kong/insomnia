// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import YAML from 'yaml';
import type { ApiSpec } from '../../../models/api-spec';
import { trackEvent } from '../../../common/analytics';
import SpecEditorSidebarItem from './spec-editor-sidebar-item';

type Props = {|
  apiSpec: ApiSpec,
  handleSetSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => void,
|};

type State = {|
  error: string,
|};

@autobind
class SpecEditorSidebar extends React.PureComponent<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      error: '',
    };
  }

  _handleScrollEditor(pos: {
    start: { line: number, col: number },
    end: { line: number, col: number },
  }) {
    trackEvent('Spec Sidebar', 'Navigate');
    const { handleSetSelection } = this.props;

    // NOTE: We're subtracting 1 from everything because YAML CST uses
    //   1-based indexing and we use 0-based.
    handleSetSelection(pos.start.col - 1, pos.end.col - 1, pos.start.line - 1, pos.end.line - 1);
  }

  componentDidUpdate() {
    const { apiSpec } = this.props;
    const { error } = this.state;
    if (apiSpec.type === 'json') {
      this.setState({
        error:
          'Tree navigation is not yet supported for JSON-formatted spec ' +
          'files. Please use YAML instead.',
      });
    } else if (error) {
      this.setState({ error: '' });
    }
  }

  renderMap(collection: Object) {
    const children = [];
    const collectionKeys = [];
    for (let i = 0; i < collection.items.length; i++) {
      const curr: Object = collection.items[i];
      const next: ?Object = collection.items[i + 1];

      // If the next one is a map value, we know we have a key in current
      if (!next || next.type !== 'MAP_VALUE') {
        continue;
      }

      collectionKeys.push(curr.strValue);

      children.push(
        <SpecEditorSidebarItem
          key={curr.strValue}
          name={curr.strValue}
          onClick={() => this._handleScrollEditor(curr.rangeAsLinePos)}>
          {this.renderNext(next)}
        </SpecEditorSidebarItem>,
      );

      // Bump one more since we used both curr and next
      i++;
    }

    return <ul key={collectionKeys.join('::')}>{children}</ul>;
  }

  renderSequence(collection: Object) {
    const children = [];

    for (let i = 0; i < collection.items.length; i++) {
      const item = collection.items[i];
      if (item.type !== 'SEQ_ITEM') {
        continue;
      }

      children.push(
        <SpecEditorSidebarItem
          key={i}
          name={String(i)}
          onClick={() => this._handleScrollEditor(item.rangeAsLinePos)}>
          {this.renderNext(item)}
        </SpecEditorSidebarItem>,
      );
    }

    return <ul>{children}</ul>;
  }

  renderNext(thing: Object) {
    if (thing.type === 'MAP') {
      return this.renderMap(thing);
    } else if (thing.type === 'SEQ') {
      return this.renderSequence(thing);
    } else if (thing.node) {
      // Try rendering child node if it has one
      return this.renderNext(thing.node);
    }

    // Everything else terminates recursion (eg. FLOW_SEQ, MAP_SEQ)
    return null;
  }

  render() {
    const { error } = this.state;
    if (error) {
      return <p className="notice error margin-sm">{error}</p>;
    }

    const { apiSpec } = this.props;
    const specCst = YAML.parseCST(apiSpec.contents);

    if (!specCst) {
      return null;
    }

    const [document] = specCst;

    if (!document.contents) {
      return null;
    }

    const navigationEl = document.contents.map(v => this.renderNext(v));

    return <div className="spec-editor-sidebar">{navigationEl}</div>;
  }
}

export default SpecEditorSidebar;
