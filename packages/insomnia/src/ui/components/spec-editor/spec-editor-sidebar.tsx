import { Sidebar } from 'insomnia-components';
import React, { FC, useEffect, useState } from 'react';
import styled from 'styled-components';
import YAML from 'yaml';
import YAMLSourceMap from 'yaml-source-map';

import type { ApiSpec } from '../../../models/api-spec';

interface Props {
  apiSpec: ApiSpec;
  handleSetSelection: (chStart: number, chEnd: number, lineStart: number, lineEnd: number) => void;
}

const StyledSpecEditorSidebar = styled.div`
  overflow: hidden;
  overflow-y: auto;
`;
export const SpecEditorSidebar: FC<Props> = ({ apiSpec, handleSetSelection }) => {
  const [specContentJSON, setSpecContentJSON] = useState(false);

  useEffect(() => {
    try {
      JSON.parse(apiSpec.contents);
    } catch (error) {
      setSpecContentJSON(false);
      return;
    }
    setSpecContentJSON(true);
  }, [apiSpec.contents]);

  const onClick = (...itemPath: any[]): void => {
    const sourceMap = new YAMLSourceMap();
    const { contents } = apiSpec;
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
    if (specContentJSON) {
      scrollPosition.start.line = 1;
    }

    const specMap = sourceMap.index(
      YAML.parseDocument(contents, {
        keepCstNodes: true,
      }),
    );
    const itemMappedPosition = sourceMap.lookup(itemPath, specMap);
    const isServersSection = itemPath[0] === 'servers';
    // TODO: remove non-null assertion
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    scrollPosition.start.line += itemMappedPosition!.start.line;

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
      <Sidebar jsonData={specJSON} onClick={onClick} />
    </StyledSpecEditorSidebar>
  );
};
