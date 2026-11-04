export interface SendActionRuntime {
  appendTimeline: (timelinePath: string, logs: string[]) => Promise<void>;
  appendTimelineOnError: (timelinePath: string, data: string) => Promise<void>;
}
