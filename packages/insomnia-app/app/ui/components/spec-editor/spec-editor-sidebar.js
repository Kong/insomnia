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

const StyledParagraph: React.ComponentType<{}> = styled.span`
  padding: 100px;
  border: 1px solid red;
  color: green;
  font-weight: bold;
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

    let itemPath = [];
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

    const _handleItemClick = (section: string, item: Array<string>): void => {
      itemPath = [section];
      itemPath.push.apply(itemPath, item);
      const itemPosition = sourceMap.lookup(itemPath, specMap);
      // Hack for servers array due to offest in YAML CST mapping
      if (section === 'servers') {
        scrollPosition.start.line = itemPosition.start.line;
      } else {
        scrollPosition.start.line = itemPosition.start.line - 1;
      }
      scrollPosition.end.line = scrollPosition.start.line;
      scrollPosition.end.col = 200;
      // Scroll to selection
      this._handleScrollEditor(scrollPosition);
    };

    return (
      <StyledParagraph className="spec-editor-sidebar">
        <Sidebar jsonData={specJSON} onClick={_handleItemClick} />
      </StyledParagraph>
    );
  }
}

export default SpecEditorSidebar;
