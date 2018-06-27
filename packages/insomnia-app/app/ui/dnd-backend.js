import HTML5Backend from 'react-dnd-html5-backend/lib/HTML5Backend';

class DNDBackend extends HTML5Backend {
  handleTopDragEndCapture(e) {
    if (this.isDraggingNativeItem()) {
      setTimeout(() => {
        this.actions.endDrag();
      });
      return;
    }

    super.handleTopDragEndCapture(e);
  }

  handleTopDragOver(e) {
    if (this.isDraggingNativeItem()) return;
    super.handleTopDragOver(e);
  }

  handleTopDragLeaveCapture(e) {
    if (this.isDraggingNativeItem()) return;
    super.handleTopDragLeaveCapture(e);
  }

  handleTopDropCapture(e) {
    if (this.isDraggingNativeItem()) return;
    super.handleTopDropCapture(e);
  }

  handleTopDrop(e) {
    if (!this.monitor.isDragging() || this.isDraggingNativeItem()) return;
    super.handleTopDrop(e);
  }
}

export default function(manager) {
  return new DNDBackend(manager);
}
