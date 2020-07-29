// @flow
import * as React from 'react';
import styled from 'styled-components';
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

const StyledSpecEditorSidebar: React.ComponentType<{}> = styled.div`
  overflow: hidden;
  overflow-y: auto;
`;

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

  _mapPosition(itemPath: array<any>) {
    const sourceMap = new YAMLSourceMap();
    const specMap = sourceMap.index(
      YAML.parseDocument(this.props.apiSpec.contents, { keepCstNodes: true }),
    );
    const itemMappedPosition = sourceMap.lookup(itemPath, specMap);
    const isServersSection = itemPath[0] === 'servers';
    const scrollPosition = {
      start: {
        line: 0,
        col: 0,
      },
      end: {
        line: 0,
        col: 200,
      },
    };
    isServersSection
      ? (scrollPosition.start.line = itemMappedPosition.start.line)
      : (scrollPosition.start.line = itemMappedPosition.start.line - 1);
    scrollPosition.end.line = scrollPosition.start.line;
    return scrollPosition;
  }

  render() {
    const { error } = this.state;
    if (error) {
      return <p className="notice error margin-sm">{error}</p>;
    }

    const specJSON = YAML.parse(this.props.apiSpec.contents);
    const _handleItemClick = (...itemPath): void => {
      const mappedPosition = this._mapPosition(itemPath);
      this._handleScrollEditor(mappedPosition);
    };

    return (
      <StyledSpecEditorSidebar>
        <Sidebar jsonData={specJSON} onClick={_handleItemClick} />
      </StyledSpecEditorSidebar>
    );
  }
}

export default SpecEditorSidebar;
