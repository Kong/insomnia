// @flow

declare type ConversionResultType = 'kong-declarative-config' | 'kong-for-kubernetes';

declare type DeclarativeConfigResult = {
  type: 'kong-declarative-config',
  label: string,
  documents: Object,
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
  documents: Array<Object>,
  warnings: Array<{
    severity: number,
    message: string,
    range: {
      /* TODO */
    },
  }>,
};

declare type ConversionResult = DeclarativeConfigResult | KongForKubernetesResult;

declare module 'openapi-2-kong' {
  declare module.exports: {
    generate: (specPath: string, type: ConversionResultType, tags?: Array<string>) => Promise<ConversionResult>,
    generateFromString: (specStr: string, type: ConversionResultType, tags?: Array<string>) => Promise<ConversionResult>,
  };
}
