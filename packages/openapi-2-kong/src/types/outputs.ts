import { DCPlugin, DeclarativeConfig } from './declarative-config';
import { K8sManifest } from './kubernetes-config';

export interface Taggable {
  tags?: string[];
}

export interface Pluggable {
  plugins?: DCPlugin[];
}

export type ConversionResultType = 'kong-declarative-config' | 'kong-for-kubernetes';

export interface Warning {
  severity: number;
  message: string;
  range: {};
}

export interface DeclarativeConfigResult {
  type: 'kong-declarative-config';
  label: string;
  documents: DeclarativeConfig[];
  warnings: Warning[];
}

export interface KongForKubernetesResult {
  type: 'kong-for-kubernetes';
  label: string;
  documents: K8sManifest[];
  warnings: Warning[];
}

export type ConversionResult = DeclarativeConfigResult | KongForKubernetesResult;
