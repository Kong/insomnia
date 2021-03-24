// TODO(TSCONVERSION) remove this when the conversion for o2k is complete

declare module 'openapi-2-kong' {
  /** TODO(TSCONVERSION) this can be taken from the official types OpenAPIV3.Document */
  type OpenAPI3Document = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [todo: string]: any;
  }

  export type ConversionResultType = 'kong-declarative-config' | 'kong-for-kubernetes'

  export type DeclarativeConfigResult = {
    type: 'kong-declarative-config',
    label: string,
    documents: Object,
    warnings: {
      severity: number,
      message: string,
      range: {
        /* TODO */
      },
    }[],
  };

  export type KongForKubernetesResult = {
    type: 'kong-for-kubernetes',
    label: string,
    documents: Object[],
    warnings: {
      severity: number,
      message: string,
      range: {
        /* TODO */
      },
    }[],
  };

  export type ConversionResult = DeclarativeConfigResult | KongForKubernetesResult;

  export function generateFromString(
    spec: string,
    type: ConversionResultType,
    tags?: string[],
  ): Promise<ConversionResult>

  export function generateFromSpec(
    spec: OpenAPI3Document,
    type: ConversionResultType,
    tags?: string[]
  ): Promise<ConversionResult>

  export function generate(
    filename: string,
    type: ConversionResultType,
    tags?: string[],
  ): Promise<ConversionResult>
}
