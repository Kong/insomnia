import { DeclarativeConfig } from './declarative-config';
import {
  KubernetesConfig,
  KubernetesMethodConfig,
  KubernetesPluginConfig,
} from './kubernetes-config';

export type ConversionResultType = 'kong-declarative-config' | 'kong-for-kubernetes';

export interface DeclarativeConfigResult {
  type: 'kong-declarative-config';
  label: string;
  documents: DeclarativeConfig;
  warnings: {
    severity: number;
    message: string;
    range: {};
  }[];
}

export interface KongForKubernetesResult {
  type: 'kong-for-kubernetes';
  label: string;
  documents: (KubernetesConfig | KubernetesPluginConfig | KubernetesMethodConfig)[];
  warnings: {
    severity: number;
    message: string;
    range: {};
  }[];
}

export type ConversionResult = DeclarativeConfigResult | KongForKubernetesResult;
