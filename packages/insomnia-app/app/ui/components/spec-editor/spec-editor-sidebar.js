// @flow
import * as React from 'react';
import autobind from 'autobind-decorator';
import YAML from 'yaml';
import YAMLSourceMap from 'yaml-source-map';
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
class SpecEditorSidebar extends React.Component<Props, State> {
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

  render() {
    const { error } = this.state;

    if (error) {
      return <p className="notice error margin-sm">{error}</p>;
    }

    const { apiSpec } = this.props;
    const specJSON = YAML.parse(apiSpec.contents);
    const sourceMap = new YAMLSourceMap();
    const specMap = sourceMap.index(
      YAML.parseDocument(apiSpec.contents, { keepCstNodes: true /* must specify this */ }),
    );

    const scrollPosition = {
      start: {
        line: 0,
        col: 0,
      },
      end: {
        line: 0,
        col: 0,
      },
    };

    const _handleItemClick = (...itemPath): void => {
      // Buid up path (no arr.flat() support)
      const itemPosition = [itemPath[0]].concat(...itemPath[1]);
      const itemMappedPosition = sourceMap.lookup(itemPosition, specMap);
      const isServersSection = itemPath[0] === 'servers';

      isServersSection
        ? (scrollPosition.start.line = itemMappedPosition.start.line)
        : (scrollPosition.start.line = itemMappedPosition.start.line - 1);

      scrollPosition.end.line = scrollPosition.start.line;
      scrollPosition.end.col = 200;
      this._handleScrollEditor(scrollPosition);
    };

    return (
      <div className="spec-editor-sidebar">
        <Sidebar jsonData={specJSON} onClick={_handleItemClick} />
      </div>
    );
  }
}

export default SpecEditorSidebar;
