export interface DCPlugin {
  name: string;
  enabled?: boolean;
  tags?: string[];
  config?: Record<string, Record<string, any>>;
}

export interface DCRoute {
  methods: string[];
  // eslint-disable-next-line camelcase -- this is defined by a spec that is out of our control
  strip_path: boolean;
  tags: string[];
  name: string;
  paths: string[];
  plugins?: DCPlugin[];
}

export interface DCService {
  name: string;
  protocol: string;
  host: string;
  port: number;
  path: string;
  routes: DCRoute[];
  tags: string[];
  plugins?: DCPlugin[];
}

export interface DCTarget {
  target: string;
}

export interface DCUpstream {
  name: string;
  tags: string[];
  targets: DCTarget[];
}

export interface DeclarativeConfig {
  // eslint-disable-next-line camelcase -- this is defined by a spec that is out of our control
  _format_version: '1.1';
  services: DCService[];
  upstreams: DCUpstream[];
}
