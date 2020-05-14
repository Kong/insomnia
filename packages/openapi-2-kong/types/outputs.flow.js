// @flow

declare type ConversionResultType = 'kong-declarative-config' | 'kong-for-kubernetes';

declare type DeclarativeConfigResult = {
  type: 'kong-declarative-config',
  label: string,
  documents: DeclarativeConfig,
  warnings: Array<{
    severity: number,
    message: string,
    range: {
      /* TODO */
    },
  }>,
};

declare type KongForKubernetesResult = {
  type: 'kong-for-kubernetes',
  label: string,
  documents: Array<KubernetesConfig | KubernetesPluginConfig | KubernetesMethodConfig>,
  warnings: Array<{
    severity: number,
    message: string,
    range: {
      /* TODO */
    },
  }>,
};

declare type ConversionResult = DeclarativeConfigResult | KongForKubernetesResult;
