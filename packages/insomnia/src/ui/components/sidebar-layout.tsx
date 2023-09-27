import React, { FC, forwardRef, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useRouteLoaderData } from 'react-router-dom';
import styled from 'styled-components';

import { COLLAPSE_SIDEBAR_REMS, DEFAULT_PANE_HEIGHT, DEFAULT_PANE_WIDTH, DEFAULT_SIDEBAR_WIDTH, MAX_PANE_HEIGHT, MAX_PANE_WIDTH, MAX_SIDEBAR_REMS, MIN_PANE_HEIGHT, MIN_PANE_WIDTH, MIN_SIDEBAR_REMS } from '../../common/constants';
import { debounce } from '../../common/misc';
import * as models from '../../models';
import { useRootLoaderData } from '../routes/root';
import { WorkspaceLoaderData } from '../routes/workspace';
import { ErrorBoundary } from './error-boundary';
import { Sidebar } from './sidebar/sidebar';
const verticalStyles = {
  '.sidebar': {
    gridColumnStart: '2',
    gridRowStart: '1',
    gridRowEnd: 'span 3',
    minWidth: '0',
  },
  '.pane-one': {
    gridColumnStart: '4',
    gridColumnEnd: 'span 3',
    gridRowStart: '1',
    gridRowEnd: 'span 2',
  },

  // Expand the .pane-one if it has a sibling .pane-two
  '.pane-one:has(~.pane-two)': {
    gridRowEnd: 'span 1',
  },

  '.pane-two': {
    gridColumnStart: '4',
    gridColumnEnd: 'span 3',
    gridRowStart: '3',
    gridRowEnd: 'span 1',
    borderTop: '1px solid var(--hl-md)',
  },

  '.drag--pane-horizontal': {
    display: 'none',
  },

  '.drag--pane-vertical': {
    display: 'block !important',
    gridColumnStart: '4',
    gridColumnEnd: 'span 3',
    gridRowStart: '2',
    gridRowEnd: 'span 1',

    '& > *': {
      cursor: 'ns-resize',
      height: 'var(--drag-width)',
      width: '100%',
      left: '0',
      // More to the right so it doesn't cover scroll bars
      top: 'calc(var(--drag-width) / 2 * -1)',
    },
  },
};

const LayoutGrid = styled.div<{orientation: 'vertical' | 'horizontal'}>(props => ({
  gridArea: 'Content',
  backgroundColor: 'var(--color-bg)',
  boxSizing: 'border-box',
  color: 'var(--color-font)',
  display: 'grid',
  overflow: 'hidden',
  '.filter-icon': {
    float: 'right',
    marginRight: 'var(--padding-sm)',
    marginTop: '-22px',
    position: 'relative',
    zIndex: '1',
    color: 'var(--hl-xl)',
  },

  '.btn-create': {
    padding: 'var(--padding-sm) var(--padding-md)',
  },

  '.btn-sync': {
    textAlign: 'center',
    borderRadius: 'var(--radius-md)',
    fontSize: 'var(--font-size-sm)',
    height: 'var(--line-height-xs)',
    display: 'flex',
    flexDirection: 'row',
    WebkitBoxAlign: 'center',
    alignItems: 'center',
    paddingLeft: 'var(--padding-md)',
    paddingRight: 'var(--padding-md)',

    color: 'var(--color-font-surprise)',
    backgroundColor: 'var(--color-surprise)',
    transition: 'none',

    '&:hover': {
      filter: 'brightness(0.8)',
    },
  },

  height: '100%',
  width: '100%',

  '.sidebar': {
    gridColumnStart: '2',
    gridRowStart: '1',
    gridRowEnd: 'span 3',
    minWidth: '0',
  },

  '.drag': {
    gridRowStart: '1',
    gridRowEnd: 'span 3',
    position: 'relative',

    '&.drag--pane-vertical': {
      display: 'none',
    },

    '& > *': {
      // background-color: rgba(255, 0, 0, 0.5);
      cursor: 'ew-resize',
      position: 'absolute',
      height: '100%',
      zIndex: '9',
      width: 'var(--drag-width)',
      top: '0',
      // More to the right so it doesn't cover scroll bars
      left: 'calc((var(--drag-width) / 8) * -1)',
    },
  },

  '.pane-one, .pane-two': {
    minWidth: '0',
    maxHeight: '100%',
    borderLeft: '1px solid var(--hl-md)',
    background: 'var(--color-bg)',
    color: 'var(--color-font)',
  },

  '.pane-one': {
    gridColumnStart: '4',
    gridRowStart: '1',
    gridRowEnd: 'span 3',
  },

  '.pane-two': {
    gridColumnStart: '6',
    gridRowStart: '1',
    gridRowEnd: 'span 3',
  },

  '.migration': {
    gridColumnStart: '1',
    gridColumnEnd: 'span 6',
    gridRowStart: '1',
    gridRowEnd: 'span 3',
  },

  '.drag--sidebar': {
    gridColumnStart: '3',
    zIndex: '999',
    gridColumnEnd: 'span 1',
  },

  '.drag--pane-horizontal': {
    gridColumnStart: '5',
    gridColumnEnd: 'span 1',
  },

  '@media (max-width: 1200px)': {
    ...verticalStyles,
  },

  ...props.orientation === 'vertical' && verticalStyles,
}));

const Pane = forwardRef<HTMLElement, { position: string; children: ReactNode }>(
  function Pane({ children, position }, ref) {
    return (
      <section ref={ref} className={`pane-${position} theme--pane`}>
        {children}
      </section>
    );
  }
);

export const SidebarFooter = styled.div({
  gridRowStart: 6,
});

interface Props {
  renderPageSidebar?: ReactNode;
  renderPaneOne?: ReactNode;
  renderPaneTwo?: ReactNode;
  className?: string;
}

export const SidebarLayout: FC<Props> = ({
  renderPaneOne,
  renderPaneTwo,
  renderPageSidebar,
  className,
}) => {
  const {
    settings,
  } = useRootLoaderData();
  const { forceVerticalLayout } = settings;

  const workspaceData = useRouteLoaderData(':workspaceId') as WorkspaceLoaderData | undefined;
  const { activeWorkspaceMeta } = workspaceData || {};
  const requestPaneRef = useRef<HTMLElement>(null);
  const responsePaneRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [showDragOverlay, setShowDragOverlay] = useState(false);
  const [draggingSidebar, setDraggingSidebar] = useState(false);
  const [draggingPaneHorizontal, setDraggingPaneHorizontal] = useState(false);
  const [draggingPaneVertical, setDraggingPaneVertical] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(activeWorkspaceMeta?.sidebarWidth || DEFAULT_SIDEBAR_WIDTH);
  const [paneWidth, setPaneWidth] = useState(activeWorkspaceMeta?.paneWidth || DEFAULT_PANE_WIDTH);
  const [paneHeight, setPaneHeight] = useState(activeWorkspaceMeta?.paneHeight || DEFAULT_PANE_HEIGHT);

  useEffect(() => {
    const unsubscribe = window.main.on('toggle-sidebar', () => {
      if (activeWorkspaceMeta) {
        models.workspaceMeta.update(activeWorkspaceMeta, { sidebarHidden: !activeWorkspaceMeta.sidebarHidden });
      }
    });
    return () => unsubscribe();
  }, [activeWorkspaceMeta]);

  const handleSetPaneWidth = useCallback((paneWidth: number) => {
    setPaneWidth(paneWidth);
    if (activeWorkspaceMeta) {
      debounce(() => models.workspaceMeta.update(activeWorkspaceMeta, { paneWidth }));
    }
  }, [activeWorkspaceMeta]);
  const handleSetPaneHeight = useCallback((paneHeight: number) => {
    setPaneHeight(paneHeight);
    if (activeWorkspaceMeta) {
      debounce(() => models.workspaceMeta.update(activeWorkspaceMeta, { paneHeight }));
    }
  }, [activeWorkspaceMeta]);
  const handleSetSidebarWidth = useCallback((sidebarWidth: number) => {
    setSidebarWidth(sidebarWidth);
    if (activeWorkspaceMeta) {
      debounce(() => models.workspaceMeta.update(activeWorkspaceMeta, { sidebarWidth }));
    }
  }, [activeWorkspaceMeta]);

  const handleMouseUp = useCallback(() => {
    if (draggingSidebar) {
      setDraggingSidebar(false);
      setShowDragOverlay(false);
    }
    if (draggingPaneHorizontal) {
      setDraggingPaneHorizontal(false);
      setShowDragOverlay(false);
    }
    if (draggingPaneVertical) {
      setDraggingPaneVertical(false);
      setShowDragOverlay(false);
    }
  }, [draggingPaneHorizontal, draggingPaneVertical, draggingSidebar]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (draggingPaneHorizontal) {
      // Only pop the overlay after we've moved it a bit (so we don't block doubleclick);
      const distance = (activeWorkspaceMeta?.paneWidth || DEFAULT_PANE_WIDTH) - paneWidth;

      if (!showDragOverlay && Math.abs(distance) > 0.02) {
        setShowDragOverlay(true);
      }

      if (requestPaneRef.current && responsePaneRef.current) {
        const requestPaneWidth = requestPaneRef.current.offsetWidth;
        const responsePaneWidth = responsePaneRef.current.offsetWidth;

        const pixelOffset = event.clientX - requestPaneRef.current.offsetLeft;
        let paneWidth = pixelOffset / (requestPaneWidth + responsePaneWidth);
        paneWidth = Math.min(Math.max(paneWidth, MIN_PANE_WIDTH), MAX_PANE_WIDTH);

        handleSetPaneWidth(paneWidth);
      }
    } else if (draggingPaneVertical) {
      // Only pop the overlay after we've moved it a bit (so we don't block doubleclick);
      const distance = (activeWorkspaceMeta?.paneHeight || DEFAULT_PANE_HEIGHT) - paneHeight;
      /* % */
      if (!showDragOverlay && Math.abs(distance) > 0.02) {
        setShowDragOverlay(true);
      }

      if (requestPaneRef.current && responsePaneRef.current) {
        const requestPaneHeight = requestPaneRef.current.offsetHeight;
        const responsePaneHeight = responsePaneRef.current.offsetHeight;
        const pixelOffset = event.clientY - requestPaneRef.current.offsetTop;
        let paneHeight = pixelOffset / (requestPaneHeight + responsePaneHeight);
        paneHeight = Math.min(Math.max(paneHeight, MIN_PANE_HEIGHT), MAX_PANE_HEIGHT);

        handleSetPaneHeight(paneHeight);
      }
    } else if (draggingSidebar) {
      // Only pop the overlay after we've moved it a bit (so we don't block doubleclick);
      const distance = (activeWorkspaceMeta?.sidebarWidth || DEFAULT_SIDEBAR_WIDTH) - sidebarWidth;
      /* ems */
      if (!showDragOverlay && Math.abs(distance) > 2) {
        setShowDragOverlay(true);
      }

      if (sidebarRef.current) {
        const currentPixelWidth = sidebarRef.current.offsetWidth;
        const ratio = (event.clientX - sidebarRef.current.offsetLeft) / currentPixelWidth;
        const width = sidebarWidth * ratio;
        let localSidebarWidth = Math.min(width, MAX_SIDEBAR_REMS);
        if (localSidebarWidth < COLLAPSE_SIDEBAR_REMS) {
          localSidebarWidth = MIN_SIDEBAR_REMS;
        }
        handleSetSidebarWidth(localSidebarWidth);
      }
    }
  }, [activeWorkspaceMeta?.paneHeight, activeWorkspaceMeta?.paneWidth, activeWorkspaceMeta?.sidebarWidth, draggingPaneHorizontal, draggingPaneVertical, draggingSidebar, handleSetPaneHeight, handleSetPaneWidth, handleSetSidebarWidth, paneHeight, paneWidth, showDragOverlay, sidebarWidth]);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('mousemove', handleMouseMove);
    return () => {
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove, handleMouseUp]);

  function handleResetDragSidebar() {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => handleSetSidebarWidth(DEFAULT_SIDEBAR_WIDTH), 50);
  }

  function handleStartDragPaneHorizontal() {
    setDraggingPaneHorizontal(true);
  }

  function handleStartDragPaneVertical() {
    setDraggingPaneVertical(true);
  }

  function handleResetDragPaneHorizontal() {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => handleSetPaneWidth(DEFAULT_PANE_WIDTH), 50);
  }

  function handleResetDragPaneVertical() {
    // TODO: Remove setTimeout need be not triggering drag on double click
    setTimeout(() => handleSetPaneHeight(DEFAULT_PANE_HEIGHT), 50);
  }

  // Special request updaters
  const startDragSidebar = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDraggingSidebar(true);
  }, []);

  const realSidebarWidth = activeWorkspaceMeta?.sidebarHidden ? 0 : sidebarWidth;
  const gridRows = renderPaneTwo
    ? `minmax(0, ${paneHeight}fr) 0 minmax(0, ${1 - paneHeight}fr)`
    : '1fr';
  const gridColumns =
    `auto ${realSidebarWidth}rem 0 ` +
    `${renderPaneTwo ? `minmax(0, ${paneWidth}fr) 0 minmax(0, ${1 - paneWidth}fr)` : '1fr'}`;

  return (
    <LayoutGrid
      key="wrapper"
      id="wrapper"
      className={className}
      orientation={forceVerticalLayout ? 'vertical' : 'horizontal'}
      style={{
        gridTemplateColumns: gridColumns,
        gridTemplateRows: gridRows,
      }}
    >
      {renderPageSidebar && (
        <ErrorBoundary showAlert>
          <Sidebar
            ref={sidebarRef}
            hidden={activeWorkspaceMeta?.sidebarHidden || false}
            width={sidebarWidth}
          >
            {renderPageSidebar}
          </Sidebar>

          <div className="drag drag--sidebar">
            <div
              onDoubleClick={handleResetDragSidebar}
              onMouseDown={startDragSidebar}
            />
          </div>
        </ErrorBoundary>
      )}
      {renderPaneOne && (
        <ErrorBoundary showAlert>
          <Pane
            position="one"
            ref={requestPaneRef}
          >
            {renderPaneOne}
          </Pane>
        </ErrorBoundary>
      )}
      {renderPaneTwo && (
        <>
          <div className="drag drag--pane-horizontal">
            <div
              onMouseDown={handleStartDragPaneHorizontal}
              onDoubleClick={handleResetDragPaneHorizontal}
            />
          </div>

          <div className="drag drag--pane-vertical">
            <div
              onMouseDown={handleStartDragPaneVertical}
              onDoubleClick={handleResetDragPaneVertical}
            />
          </div>

          <ErrorBoundary showAlert>
            <Pane
              position="two"
              ref={responsePaneRef}
            >
              {renderPaneTwo}
            </Pane>
          </ErrorBoundary>
        </>
      )}
      {/* Block all mouse activity by showing an overlay while dragging */}
      {showDragOverlay ? <div className="blocker-overlay" /> : null}
    </LayoutGrid>
  );
};
