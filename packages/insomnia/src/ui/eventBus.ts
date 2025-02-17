type EventHandler = (...args: any[]) => void;

type UIEventType = 'CLOSE_TAB' | 'CHANGE_ACTIVE_ENV';
class EventBus {
  private events: Record<UIEventType, EventHandler[]> = {
    CLOSE_TAB: [],
    CHANGE_ACTIVE_ENV: [],
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
