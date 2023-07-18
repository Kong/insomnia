// Left from @marckong here: slightly modified from this PR - https://github.com/Kong/insomnia-website/pull/41
import type { PropsWithChildren } from 'react';
import React from 'react';
import { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';

import TrailLines, { TrailsLineHandle } from './trail-lines';

const LineContainer = styled('div')({
  position: 'relative',
  zIndex: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  margin: '0 auto',
  transform: 'translateZ(0)',
  width: '100%',
  overflow: 'hidden',
});

interface Size {
  width: number;
  height: number;
}

export const TrailLinesContainer = ({ children }: PropsWithChildren) => {
  const startTailRef = useRef<TrailsLineHandle>(null);
  const endTailRef = useRef<TrailsLineHandle>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState<Size | undefined>();

  useEffect(() => {
    startTailRef.current?.toggle(true);
    endTailRef.current?.toggle(true);
  }, [dimensions]);

  useEffect(() => {
    updateDimensions();

    window.addEventListener('resize', updateDimensions);

    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);

  const updateDimensions = () => {
    startTailRef.current?.toggle(false);
    endTailRef.current?.toggle(false);

    const width = containerRef.current?.clientWidth;
    const height = containerRef.current?.clientHeight;

    if (!width || !height) {
      return;
    }

    if (width < 500) {
      return;
    }

    const matrix: Size = { width: width / 2, height: height };

    setDimensions(matrix);
  };

  return (
    <LineContainer ref={containerRef}>
      <div>
        {dimensions && <TrailLines id="start" ref={startTailRef} width={dimensions.width} height={dimensions.height} />}
      </div>
      {children}
      <div>
        {dimensions && (
          <TrailLines id="end" ref={endTailRef} width={dimensions.width} height={dimensions.height} reverse />
        )}
      </div>
    </LineContainer>
  );
};
