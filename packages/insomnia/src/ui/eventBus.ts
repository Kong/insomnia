type EventHandler = (...args: any[]) => void;

export const OAUTH2_AUTHORIZATION_STATUS_CHANGE = 'OAUTH2_AUTHORIZATION_STATUS_CHANGE';

type UIEventType = 'CLOSE_TAB' | 'CHANGE_ACTIVE_ENV' | typeof OAUTH2_AUTHORIZATION_STATUS_CHANGE;
class EventBus {
  private events: Record<UIEventType, EventHandler[]> = {
    CLOSE_TAB: [],
    CHANGE_ACTIVE_ENV: [],
    [OAUTH2_AUTHORIZATION_STATUS_CHANGE]: [],
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
