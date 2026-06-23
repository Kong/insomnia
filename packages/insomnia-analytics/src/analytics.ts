import { Analytics, type AnalyticsSettings } from '@segment/analytics-node';

export interface AppContext {
  appName: string;
  appVersion: string;
  osVersion: string | (() => string);
  platform: 'app' | 'cli';
}

export interface TrackOptions {
  event: string;
  properties?: Record<string, unknown>;
  anonymousId: string;
  userId?: string;
}

export interface PageOptions {
  name: string;
  anonymousId: string;
  userId?: string;
}

export interface InsomniaAnalyticsOptions {
  writeKey: string;
  app: AppContext;
  settings?: Omit<AnalyticsSettings, 'writeKey'>;
  onError?: (error: unknown) => void;
}

export function getNormalizedOsName(platform: NodeJS.Platform | string): string {
  switch (platform) {
    case 'darwin': {
      return 'mac';
    }
    case 'win32': {
      return 'windows';
    }
    default: {
      return platform;
    }
  }
}

export class InsomniaAnalytics {
  private readonly client: Analytics;
  private readonly app: AppContext;
  private readonly onError: (error: unknown) => void;

  constructor({ writeKey, app, settings, onError }: InsomniaAnalyticsOptions) {
    this.client = new Analytics({ writeKey, ...settings });
    this.app = app;
    this.onError = onError ?? (() => {});
  }

  track({ event, properties, anonymousId, userId }: TrackOptions): void {
    this.client.track(
      {
        event,
        anonymousId,
        userId: userId ?? '',
        properties: { ...properties, platform: this.app.platform },
        context: this.buildContext(),
      },
      error => {
        if (error) {
          this.onError(error);
        }
      },
    );
  }

  page({ name, anonymousId, userId }: PageOptions): void {
    this.client.page(
      {
        name,
        anonymousId,
        userId: userId ?? '',
        context: this.buildContext(),
      },
      error => {
        if (error) {
          this.onError(error);
        }
      },
    );
  }

  async closeAndFlush(timeoutMs = 5000): Promise<void> {
    try {
      await this.client.closeAndFlush({ timeout: timeoutMs });
    } catch (error) {
      this.onError(error);
    }
  }

  private buildContext() {
    const osVersion = typeof this.app.osVersion === 'function' ? this.app.osVersion() : this.app.osVersion;
    return {
      app: { name: this.app.appName, version: this.app.appVersion },
      os: { name: getNormalizedOsName(process.platform), version: osVersion },
    };
  }
}
