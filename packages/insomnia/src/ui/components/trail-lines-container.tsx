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
  const childrenContainerRef = useRef<HTMLDivElement>(null);
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

    const containerWidth = containerRef.current?.clientWidth;
    const containerHeight = containerRef.current?.clientHeight;

    const childrenWidth = childrenContainerRef.current?.clientWidth;
    const childrenHeight = childrenContainerRef.current?.clientHeight;

    console.log({ containerWidth, containerHeight, childrenWidth, childrenHeight });

    if (!containerWidth || !containerHeight || !childrenWidth || !childrenHeight) {
      return;
    }

    if (containerWidth < 500) {
      return;
    }

    const matrix: Size = { width: (containerWidth - childrenWidth) / 2, height: containerHeight };

    setDimensions(matrix);
  };

  return (
    <LineContainer ref={containerRef}>
      <div>
        {dimensions && <TrailLines id="start" ref={startTailRef} width={dimensions.width} height={dimensions.height} />}
      </div>
      <div className='flex w-min' ref={childrenContainerRef}>
        {children}
      </div>
      <div>
        {dimensions && (
          <TrailLines id="end" ref={endTailRef} width={dimensions.width} height={dimensions.height} reverse />
        )}
      </div>
    </LineContainer>
  );
};
