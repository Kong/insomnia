import { BasicAuthPlugin, KeyAuthPlugin, OpenIDConnectPlugin, RequestTerminationPlugin, RequestValidatorPlugin } from './kong';
import { Pluggable, Taggable } from './outputs';

export type DCPlugin =
  | RequestValidatorPlugin
  | KeyAuthPlugin
  | RequestTerminationPlugin
  | BasicAuthPlugin
  | OpenIDConnectPlugin

export interface DCRoute extends Taggable, Pluggable {
  methods: string[];
  // eslint-disable-next-line camelcase -- this is defined by a spec that is out of our control
  name: string;
  paths: string[];
  strip_path: boolean;
}

export interface DCService extends Taggable, Pluggable {
  host: string;
  name: string;
  path: string | null;
  port: number;
  protocol: string | undefined;
  routes: DCRoute[];
}

export interface DCTarget extends Taggable {
  target: string;
}

export interface DCUpstream extends Taggable {
  name: string;
  targets: DCTarget[];
}

export interface DeclarativeConfig {
  _format_version: '1.1';
  services: DCService[];
  upstreams: DCUpstream[];
}
