import HTML5Backend from 'react-dnd-html5-backend';

// @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
class DNDBackend extends HTML5Backend {
  handleTopDragEndCapture(e) {
    // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
    if (this.isDraggingNativeItem()) {
      setTimeout(() => {
        // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
        this.actions.endDrag();
      });
      return;
    }

    super.handleTopDragEndCapture(e);
  }

  handleTopDragOver(e) {
    // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
    if (this.isDraggingNativeItem()) return;
    super.handleTopDragOver(e);
  }

  handleTopDragLeaveCapture(e) {
    // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
    if (this.isDraggingNativeItem()) return;
    super.handleTopDragLeaveCapture(e);
  }

  handleTopDropCapture(e) {
    // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
    if (this.isDraggingNativeItem()) return;
    super.handleTopDropCapture(e);
  }

  handleTopDrop(e) {
    // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
    if (!this.monitor.isDragging() || this.isDraggingNativeItem()) return;
    super.handleTopDrop(e);
  }
}

export default function(manager) {
  // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
  return new DNDBackend(manager);
}
