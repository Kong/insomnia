// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import YAML from 'yaml';
import SpecEditorSidebarItem from './spec-editor-sidebar-item';
import { Sidebar } from 'insomnia-components';
import type { ApiSpec } from '../../../models/api-spec';
import { trackEvent } from '../../../common/analytics';

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

  renderMap(collection: Object, path: string) {
    const children = [];
    for (let i = 0; i < collection.items.length; i++) {
      const curr: Object = collection.items[i];
      const next: ?Object = collection.items[i + 1];

      // If the next one is a map value, we know we have a key in current
      if (!next || next.type !== 'MAP_VALUE') {
        continue;
      }

      const newPath = `${path}.${curr.strValue}`;
      children.push(
        <SpecEditorSidebarItem
          key={newPath}
          name={curr.strValue}
          onClick={() => this._handleScrollEditor(curr.rangeAsLinePos)}>
          {this.renderNext(next, newPath)}
        </SpecEditorSidebarItem>,
      );

      // Bump one more since we used both curr and next
      i++;
    }

    return <ul key={path}>{children}</ul>;
  }

  renderSequence(collection: Object, path: string) {
    const children = [];

    for (let i = 0; i < collection.items.length; i++) {
      const item = collection.items[i];
      if (item.type !== 'SEQ_ITEM') {
        continue;
      }

      const newPath = `${path}[${i}]`;

      children.push(
        <SpecEditorSidebarItem
          key={newPath}
          name={String(i)}
          onClick={() => this._handleScrollEditor(item.rangeAsLinePos)}>
          {this.renderNext(item, newPath)}
        </SpecEditorSidebarItem>,
      );
    }

    return <ul key={path}>{children}</ul>;
  }

  renderNext(thing: Object, path: string) {
    if (thing.type === 'MAP') {
      return this.renderMap(thing, path);
    } else if (thing.type === 'SEQ') {
      return this.renderSequence(thing, path);
    } else if (thing.node) {
      // Try rendering child node if it has one
      return this.renderNext(thing.node, path);
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

    let specJSON = {};

    if (apiSpec.contentType === 'yaml') {
      specJSON = YAML.parse(apiSpec.contents);
    }

    if (!specCst) {
      return null;
    }

    const [document] = specCst;

    if (!document.contents) {
      return null;
    }

    // const navigationEl = document.contents.map(v => this.renderNext(v, '$'));

    return (
      <div className="spec-editor-sidebar">
        <Sidebar jsonData={specJSON} />
        {/* navigationEl */}
      </div>
    );
  }
}

export default SpecEditorSidebar;
