type EventHandler = (...args: any[]) => void;

export enum UIEventType {
  CLOSE_TAB = 'closeTab',
}
class EventBus {
  private events: Record<UIEventType, EventHandler[]> = {
    [UIEventType.CLOSE_TAB]: [],
  };

  // Subscribe to event
  on(event: UIEventType, handler: EventHandler): void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);
  }

  // Unsubscribe from event
  off(event: UIEventType, handler: EventHandler): void {
    if (!this.events[event]) {
      return;
    }
    this.events[event] = this.events[event].filter(h => h !== handler);
  }

  // emit event
  emit(event: UIEventType, ...args: any[]): void {
    if (!this.events[event]) {
      return;
    }
    this.events[event].forEach(handler => handler(...args));
  }
}

const uiEventBus = new EventBus();
export default uiEventBus;
