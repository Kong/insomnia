import { Plugin } from './kong';
import { Pluggable, Taggable } from './outputs';

// In case this seems weird to you, it's an important semantic difference.
// The `Plugin` type is intentionally focused on the _Kong_ plugin definitions without knowledge of declarative-config or kubernetes or any other transforms.
// It happens to be the case, yes, that the DC shape directly matches the Kong plugin shape in all cases, but this is by coincidence, as far as the types are concerned.  Other transformers, e.g. Kubernetes, use this same `Plugin` type but resituate it quite a bit.  It just so happens that declarative config does not do this (yet).
// Finally, if nothing else it serves as useful documentation to distinguish when we're talking about declarative-config vs kong-config.
export type DCPlugin = Plugin;

export interface DCRoute extends Taggable, Pluggable {
  methods: string[];
  name: string;
  paths: string[];
  strip_path: boolean;
}

export interface DCService extends Taggable, Pluggable {
  host: DCUpstream['name'];
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
