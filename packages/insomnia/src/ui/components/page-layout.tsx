import classnames from 'classnames';
import React, { FC, forwardRef, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';

import { COLLAPSE_SIDEBAR_REMS, DEFAULT_PANE_HEIGHT, DEFAULT_PANE_WIDTH, DEFAULT_SIDEBAR_WIDTH, MAX_PANE_HEIGHT, MAX_PANE_WIDTH, MAX_SIDEBAR_REMS, MIN_PANE_HEIGHT, MIN_PANE_WIDTH, MIN_SIDEBAR_REMS } from '../../common/constants';
import { debounce } from '../../common/misc';
import * as models from '../../models';
import { selectActiveEnvironment, selectActiveWorkspaceMeta, selectSettings } from '../redux/selectors';
import { selectPaneHeight, selectPaneWidth, selectSidebarWidth } from '../redux/sidebar-selectors';
import { ErrorBoundary } from './error-boundary';
import { Sidebar } from './sidebar/sidebar';

const Pane = forwardRef<HTMLElement, { position: string; children: ReactNode }>(
  function Pane({ children, position }, ref) {
    return (
      <section ref={ref} className={`pane-${position} theme--pane`}>
        {children}
      </section>
    );
  }
);

interface Props {
  renderPageSidebar?: ReactNode;
  renderPageHeader?: ReactNode;
  renderPageBody?: ReactNode;
  renderPaneOne?: ReactNode;
  renderPaneTwo?: ReactNode;
}

export const PageLayout: FC<Props> = ({
  renderPaneOne,
  renderPaneTwo,
  renderPageBody,
  renderPageHeader,
  renderPageSidebar,
}) => {
  const activeEnvironment = useSelector(selectActiveEnvironment);
  const settings = useSelector(selectSettings);
  const activeWorkspaceMeta = useSelector(selectActiveWorkspaceMeta);
  const reduxPaneHeight = useSelector(selectPaneHeight);
  const reduxPaneWidth = useSelector(selectPaneWidth);
  const reduxSidebarWidth = useSelector(selectSidebarWidth);

  const requestPaneRef = useRef<HTMLElement>(null);
  const responsePaneRef = useRef<HTMLElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const [showDragOverlay, setShowDragOverlay] = useState(false);
  const [draggingSidebar, setDraggingSidebar] = useState(false);
  const [draggingPaneHorizontal, setDraggingPaneHorizontal] = useState(false);
  const [draggingPaneVertical, setDraggingPaneVertical] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(reduxSidebarWidth || DEFAULT_SIDEBAR_WIDTH);
  const [paneWidth, setPaneWidth] = useState(reduxPaneWidth || DEFAULT_PANE_WIDTH);
  const [paneHeight, setPaneHeight] = useState(reduxPaneHeight || DEFAULT_PANE_HEIGHT);

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
      const distance = reduxPaneWidth - paneWidth;

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
      const distance = reduxPaneHeight - paneHeight;
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
      const distance = reduxSidebarWidth - sidebarWidth;
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
  }, [draggingPaneHorizontal, draggingPaneVertical, draggingSidebar, handleSetPaneHeight, handleSetPaneWidth, handleSetSidebarWidth, paneHeight, paneWidth, reduxPaneHeight, reduxPaneWidth, reduxSidebarWidth, showDragOverlay, sidebarWidth]);

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
    ? `auto minmax(0, ${paneHeight}fr) 0 minmax(0, ${1 - paneHeight}fr)`
    : 'auto 1fr';
  const gridColumns =
    `auto ${realSidebarWidth}rem 0 ` +
    `${renderPaneTwo ? `minmax(0, ${paneWidth}fr) 0 minmax(0, ${1 - paneWidth}fr)` : '1fr'}`;
  return (
    <div
      key="wrapper"
      id="wrapper"
      className={classnames('wrapper', {
        'wrapper--vertical': settings.forceVerticalLayout,
      })}
      style={{
        gridTemplateColumns: gridColumns,
        gridTemplateRows: gridRows,
        boxSizing: 'border-box',
        borderTop:
          activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-top'
            ? '5px solid ' + activeEnvironment.color
            : undefined,
        borderBottom:
          activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-bottom'
            ? '5px solid ' + activeEnvironment.color
            : undefined,
        borderLeft:
          activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-left'
            ? '5px solid ' + activeEnvironment.color
            : undefined,
        borderRight:
          activeEnvironment &&
            activeEnvironment.color &&
            settings.environmentHighlightColorStyle === 'window-right'
            ? '5px solid ' + activeEnvironment.color
            : undefined,
      }}
    >
      {renderPageHeader && <ErrorBoundary showAlert>{renderPageHeader}</ErrorBoundary>}

      {renderPageSidebar && (
        <ErrorBoundary showAlert>
          <Sidebar
            ref={sidebarRef}
            activeEnvironment={activeEnvironment}
            environmentHighlightColorStyle={settings.environmentHighlightColorStyle}
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
      {renderPageBody ? (
        <ErrorBoundary showAlert>{renderPageBody}</ErrorBoundary>
      ) : (
        <>
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
        </>
      )}
      {/* Block all mouse activity by showing an overlay while dragging */}
      {showDragOverlay ? <div className="blocker-overlay" /> : null}
    </div>
  );
};
