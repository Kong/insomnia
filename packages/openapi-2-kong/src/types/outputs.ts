import { DeclarativeConfig } from './declarative-config';
import { KubernetesDocument } from './kubernetes-config';

export type ConversionResultType = 'kong-declarative-config' | 'kong-for-kubernetes';

export interface Warnings {
  severity: number;
  message: string;
  range: {};
}

export interface DeclarativeConfigResult {
  type: 'kong-declarative-config';
  label: string;
  documents: DeclarativeConfig[];
  warnings: Warnings[];
}

export interface KongForKubernetesResult {
  type: 'kong-for-kubernetes';
  label: string;
  documents: KubernetesDocument[];
  warnings: Warnings[];
}

export type ConversionResult = DeclarativeConfigResult | KongForKubernetesResult;
