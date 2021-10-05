import { autoBindMethodsForReact } from 'class-autobind-decorator';
import { Sidebar } from 'insomnia-components';
import React, { Component } from 'react';
import styled from 'styled-components';
import YAML from 'yaml';
import YAMLSourceMap from 'yaml-source-map';

import { trackEvent } from '../../../common/analytics';
import { AUTOBIND_CFG } from '../../../common/constants';
import type { ApiSpec } from '../../../models/api-spec';

interface Props {
  apiSpec: ApiSpec;
  handleSetSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => void;
}

interface State {
  error: string;
  specContentJSON: boolean;
}

const StyledSpecEditorSidebar = styled.div`
  overflow: hidden;
  overflow-y: auto;
`;

@autoBindMethodsForReact(AUTOBIND_CFG)
export class SpecEditorSidebar extends Component<Props, State> {
  state: State = {
    error: '',
    specContentJSON: false,
  };

  _handleScrollEditor(pos: {
    start: {
      line: number;
      col: number;
    };
    end: {
      line: number;
      col: number;
    };
  }) {
    trackEvent('Spec Sidebar', 'Navigate');
    const { handleSetSelection } = this.props;
    // NOTE: We're subtracting 1 from everything because YAML CST uses
    //   1-based indexing and we use 0-based.
    handleSetSelection(pos.start.col - 1, pos.end.col - 1, pos.start.line - 1, pos.end.line - 1);
  }

  _mapPosition(itemPath: any[]) {
    const sourceMap = new YAMLSourceMap();
    const { contents } = this.props.apiSpec;
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

    // Account for JSON (as string) line number shift
    if (this.state.specContentJSON) {
      scrollPosition.start.line = 1;
    }

    const specMap = sourceMap.index(
      YAML.parseDocument(contents, {
        keepCstNodes: true,
      }),
    );
    const itemMappedPosition = sourceMap.lookup(itemPath, specMap);
    const isServersSection = itemPath[0] === 'servers';
    scrollPosition.start.line += itemMappedPosition.start.line;

    if (!isServersSection) {
      scrollPosition.start.line -= 1;
    }

    scrollPosition.end.line = scrollPosition.start.line;

    this._handleScrollEditor(scrollPosition);
  }

  _handleItemClick = (...itemPath): void => {
    this._mapPosition(itemPath);
  };

  componentDidMount() {
    const { contents } = this.props.apiSpec;

    try {
      JSON.parse(contents);
    } catch (e) {
      this.setState({
        specContentJSON: false,
      });
      return;
    }

    this.setState({
      specContentJSON: true,
    });
  }

  render() {
    const { error } = this.state;

    if (error) {
      return <p className="notice error margin-sm">{error}</p>;
    }

    const specJSON = YAML.parse(this.props.apiSpec.contents);
    return (
      <StyledSpecEditorSidebar>
        <Sidebar jsonData={specJSON} onClick={this._handleItemClick} />
      </StyledSpecEditorSidebar>
    );
  }
}
