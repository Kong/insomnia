import HTML5Backend from 'react-dnd-html5-backend';

// @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
class DNDBackend extends HTML5Backend {
  handleTopDragEndCapture(event) {
    // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
    if (this.isDraggingNativeItem()) {
      setTimeout(() => {
        // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
        this.actions.endDrag();
      });
      return;
    }

    super.handleTopDragEndCapture(event);
  }

  handleTopDragOver(event) {
    // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
    if (this.isDraggingNativeItem()) {
      return;
    }
    super.handleTopDragOver(event);
  }

  handleTopDragLeaveCapture(event) {
    // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
    if (this.isDraggingNativeItem()) {
      return;
    }
    super.handleTopDragLeaveCapture(event);
  }

  handleTopDropCapture(event) {
    // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
    if (this.isDraggingNativeItem()) {
      return;
    }
    super.handleTopDropCapture(event);
  }

  handleTopDrop(event) {
    // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
    if (!this.monitor.isDragging() || this.isDraggingNativeItem()) {
      return;
    }
    super.handleTopDrop(event);
  }
}

export default function(manager) {
  // @ts-expect-error -- TSCONVERSION ignoring until we can update react-dnd-html5-backend to get accurate upstream types
  return new DNDBackend(manager);
}
