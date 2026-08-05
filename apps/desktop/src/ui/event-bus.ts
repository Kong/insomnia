type EventHandler = (...args: any[]) => void;

export const OAUTH2_AUTHORIZATION_STATUS_CHANGE = 'OAUTH2_AUTHORIZATION_STATUS_CHANGE';
// This event is emitted when remote cloud sync file is changed, including project, workspace creation, deletion and update.
export const CLOUD_SYNC_FILE_CHANGE = 'CLOUD_SYNC_FILE_CHANGE';

type UIEventType =
  | 'CLOSE_TAB'
  | 'CHANGE_ACTIVE_ENV'
  | typeof CLOUD_SYNC_FILE_CHANGE
  | typeof OAUTH2_AUTHORIZATION_STATUS_CHANGE;
class EventBus {
  private events: Record<UIEventType, EventHandler[]> = {
    CLOSE_TAB: [],
    CHANGE_ACTIVE_ENV: [],
    [CLOUD_SYNC_FILE_CHANGE]: [],
    [OAUTH2_AUTHORIZATION_STATUS_CHANGE]: [],
  };

  // Subscribe to event, returns unsubscribe function
  on(event: UIEventType, handler: EventHandler): () => void {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(handler);
    return () => this.off(event, handler);
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
