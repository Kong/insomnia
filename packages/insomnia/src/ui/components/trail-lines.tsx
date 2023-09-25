// Left from @marckong here: slightly modified from this PR - https://github.com/Kong/insomnia-website/pull/41
import React, { forwardRef, memo, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react';
import styled from 'styled-components';

import { animateTrailPaths, internals, random } from './trail-lines-animation';

function renderPaths({
  id,
  width,
  height,
  totalLines,
}: {
  id: string;
  width: number;
  height: number;
  totalLines: number;
}) {
  const aControlPointX = width / 2;
  const bControlPointX = width - width / 3;
  const ySpace = height / (totalLines - 1);
  const ySpaceScaled = internals.COMPACT_VERTICAL_SPACE / 100;
  const yMid = Math.round(height / 2);
  const trim = (str: string) =>
    str
      .split(/\n/)
      .map(s => s.trim())
      .join(' ')
      .trim();

  return (
    <>
      {Array.from({ length: totalLines }, (_, i) => {
        const y = ySpace * i;
        const yScaled = Math.round((y - yMid) * ySpaceScaled + yMid);
        const motionPath = trim(`
          M 0 ${y}
          C ${aControlPointX} ${y}
          ${bControlPointX} ${yScaled}
          ${width + 20} ${yScaled}
        `);
        const motionPathReverse = trim(`
          v ${internals.LINE_WIDTH}
          C ${bControlPointX} ${yScaled + internals.LINE_WIDTH}
          ${aControlPointX} ${y + internals.LINE_WIDTH}
          0 ${y + internals.LINE_WIDTH}
        `);

        return (
          <g key={`group-${id}-${i}`} className="group-elements" data-motion-path={motionPath}>
            <path d={`${motionPath} ${motionPathReverse}`} fill={`url(#${id}-lgradient-base-lines)`} />
            <clipPath id={`${id}-clip-path-${i}`}>
              <path d={`${motionPath} ${motionPathReverse}`} />
            </clipPath>
            <rect
              id={`${id}-rect-${i}`}
              width={internals.TRIAL_SIZE_PERCENTAGE}
              height="100%"
              fill={`url(#${id}-lgradient-${random(internals.GRADIENT_SUFFIXES)})`}
              clipPath={`url(#${id}-clip-path-${i})`}
              x={`-${internals.TRIAL_SIZE_PERCENTAGE}`}
            />
            {/* eslint-disable-next-line no-template-curly-in-string */}
            <g id="${id}-circles-${i}" className="dot" style={{ opacity: 0 }}>
              <circle r={internals.LINE_WIDTH * 20} fill={`url(#${id}-rgradient-dot-back)`} />
              <circle r={internals.LINE_WIDTH * 10} fill={`url(#${id}-rgradient-dot-front)`} />
              <circle r={internals.LINE_WIDTH * 1.5} fill="white" />
            </g>
          </g>
        );
      })}
    </>
  );
}

const Lines = styled('svg')<{ reverse?: boolean }>(({ reverse = false }) => ({
  pointerEvents: 'none',
  maskSize: 'var(--trail-lines-width, auto) var(--trail-lines-height, auto)',
  maskPosition: 'top right',
  maskImage: 'linear-gradient(-90deg, rgba(0, 0, 0, 1) 80%, transparent)',
  WebkitMaskSize: 'var(--trail-lines-width, auto) var(--trail-lines-height, auto)',
  WebkitMaskPosition: 'top right',
  WebkitMaskImage: 'linear-gradient(-90deg, rgba(0, 0, 0, 1) 80%, transparent)',
  transform: reverse ? 'scaleX(-1)' : 'none',
}));

interface Props {
  id: string;
  reverse?: boolean;
  width?: number | undefined;
  height?: number | undefined;
  totalLines?: number | undefined;
  totalActiveLines?: number | undefined;
}
export interface TrailsLineHandle {
  toggle: (show: boolean) => void;
}

const TrailLines = forwardRef<TrailsLineHandle, Props>(
  ({ id, width = 442, height = 820, totalLines = 19, totalActiveLines = 2, reverse }, ref) => {
    const refRoot = useRef<SVGSVGElement>(null);
    const [showPaths, setShowPaths] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        toggle: (show: boolean) => {
          setShowPaths(show);
        },
      }),
      []
    );

    useEffect(() => {
      refRoot?.current?.style.setProperty('--trail-lines-width', `${width}px`);
      refRoot?.current?.style.setProperty('--trail-lines-height', `${height}px`);
    }, [width, height]);

    useLayoutEffect(() => {
      const stopAnimation = animateTrailPaths(totalActiveLines, [refRoot]);

      return () => {
        stopAnimation();
      };
    }, [refRoot, showPaths, totalActiveLines]);

    return (
      <Lines
        reverse={reverse}
        ref={refRoot}
        className="TrailLines"
        viewBox={`0 0 ${width} ${height}`}
        width={width}
        height={height}
        preserveAspectRatio="xMaxYMid slice"
      >
        <defs>
          <linearGradient id={`${id}-lgradient-base-lines`}>
            <stop offset="0" stopColor="#d530e0" stopOpacity="0" />
            <stop offset="1" stopColor="#d530e0" />
          </linearGradient>
          <linearGradient id={`${id}-lgradient-01`}>
            <stop offset="0.0" stopColor="rgba(255, 117, 134, 1)" stopOpacity="0" />
            <stop offset="0.5" stopColor="rgba(255, 117, 134, 1)" />
            <stop offset="1.0" stopColor="rgba(0, 217, 255, 1)" />
          </linearGradient>
          <linearGradient id={`${id}-lgradient-02`}>
            <stop offset="0.0" stopColor="rgba(255, 220, 0, 1)" stopOpacity="0" />
            <stop offset="0.5" stopColor="rgba(255, 220, 0, 1)" />
            <stop offset="1.0" stopColor="rgba(0, 255, 215, 1)" />
          </linearGradient>
          <linearGradient id={`${id}-lgradient-03`}>
            <stop offset="0.0" stopColor="rgba(0, 248, 255, 1)" stopOpacity="0" />
            <stop offset="0.5" stopColor="rgba(0, 248, 255, 1)" />
            <stop offset="1.0" stopColor="rgba(249, 253, 83, 1)" />
          </linearGradient>
          <linearGradient id={`${id}-lgradient-04`}>
            <stop offset="0.0" stopColor="rgba(255, 0, 31, 1)" stopOpacity="0" />
            <stop offset="0.5" stopColor="rgba(255, 0, 31, 1)" />
            <stop offset="1.0" stopColor="rgba(96, 255, 236, 1)" />
          </linearGradient>
          <radialGradient id={`${id}-rgradient-dot-back`}>
            <stop offset="0" stopColor="rgba(255, 233, 157, .2)" />
            <stop offset="1" stopColor="rgba(255, 233, 157, 0)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id={`${id}-rgradient-dot-front`}>
            <stop offset="0" stopColor="rgba(173, 68, 255, .96)" />
            <stop offset="1" stopColor="rgba(173, 68, 255, 0)" stopOpacity="0" />
          </radialGradient>
        </defs>
        {showPaths && renderPaths({ id, width, height, totalLines })}
      </Lines>
    );
  }
);

TrailLines.displayName = 'TrailLines';

export default memo(TrailLines);
