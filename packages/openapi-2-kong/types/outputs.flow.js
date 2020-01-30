// @flow

declare type ConversionResultType = 'kong-declarative-config' | 'kong-for-kubernetes';

declare type DeclarativeConfigResult = {
  type: 'kong-declarative-config',
  label: string,
  document: DeclarativeConfig,
  warnings: Array<{severity: number, message: string, range: {/* TODO */}}>,
}

declare type KongForKubernetesResult = {
  type: 'kong-for-kubernetes',
  label: string,
  document: KubernetesConfig,
  warnings: Array<{severity: number, message: string, range: {/* TODO */}}>,
}

declare type ConversionResult = DeclarativeConfigResult | KongForKubernetesResult;
