import React, { FC } from 'react';
import styled from 'styled-components';
import YAML from 'yaml';
import YAMLSourceMap from 'yaml-source-map';

import type { ApiSpec } from '../../../models/api-spec';
import { useAIContext } from '../../context/app/ai-context';
import { InsomniaAI } from '../insomnia-ai-icon';
import { Button } from '../themed-button';
import { Sidebar } from './sidebar';

interface Props {
  apiSpec: ApiSpec;
  handleSetSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => void;
}

const StyledSpecEditorSidebar = styled.div`
  overflow: hidden;
  overflow-y: auto;
`;

export const SpecEditorSidebar: FC<Props> = ({ apiSpec, handleSetSelection }) => {
  const {
    generating: loading,
    generateTestsFromSpec,
    access,
  } = useAIContext();
  const onClick = (...itemPath: any[]): void => {
    const scrollPosition = { start: { line: 0, col: 0 }, end: { line: 0, col: 200 } };

    try {
      JSON.parse(apiSpec.contents);
      // Account for JSON (as string) line number shift
      scrollPosition.start.line = 1;
    } catch { }

    const sourceMap = new YAMLSourceMap();
    const specMap = sourceMap.index(
      YAML.parseDocument(apiSpec.contents, {
        keepCstNodes: true,
      }),
    );
    const itemMappedPosition = sourceMap.lookup(itemPath, specMap);
    if (itemMappedPosition) {
      scrollPosition.start.line += itemMappedPosition.start.line;
    }
    const isServersSection = itemPath[0] === 'servers';
    if (!isServersSection) {
      scrollPosition.start.line -= 1;
    }

    scrollPosition.end.line = scrollPosition.start.line;
    // NOTE: We're subtracting 1 from everything because YAML CST uses
    //   1-based indexing and we use 0-based.
    handleSetSelection(scrollPosition.start.col - 1, scrollPosition.end.col - 1, scrollPosition.start.line - 1, scrollPosition.end.line - 1);
  };

  const specJSON = YAML.parse(apiSpec.contents);

  return (
    <StyledSpecEditorSidebar>
      <div>
        {access.enabled && <Button
          variant="text"
          disabled={loading}
          style={{
            width: '100%',
          }}
          onClick={generateTestsFromSpec}
        >
          <InsomniaAI /> <span
            style={{
              marginLeft: 'var(--padding-xs)',
            }}
          >
            Auto-generate Tests For Collection</span>
        </Button>}
      </div>
      <Sidebar jsonData={specJSON} onClick={onClick} />
    </StyledSpecEditorSidebar>
  );
};
