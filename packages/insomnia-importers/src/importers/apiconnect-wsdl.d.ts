// eslint-disable-next-line @typescript-eslint/no-explicit-any -- this is a temporary hold-me-over while we get the types into better condition
type UNKNOWN = any;
type UNKNOWN_OBJ = {
  [key: string]: UNKNOWN;
};

type WSDL = UNKNOWN;

interface Service {
  service: string;
  filename: string;
}

interface ServiceData {
  services: Service[];
}

type WSDLEntry = {
  serviceJSON: UNKNOWN;
  fullName: string;
  filename: string;
};

declare module 'apiconnect-wsdl' {
  export function getJsonForWSDL(
    location: string,
    /** Authorization header */
    auth?: string,
    options?: {
      selfContained?: boolean;
      config?: UNKNOWN;
      req?: UNKNOWN;
      flatten?: boolean;
      sanitizeWSDL?: boolean;
    }
  ): Promise<WSDL[]>;

  export function getWSDLServices(
    allWSDLs: WSDL[],
    options?: UNKNOWN_OBJ
  ): ServiceData;

  export function findWSDLForServiceName(
    allWSDLs: WSDL[],
    serviceName: string,
    serviceFilename?: string
  ): WSDLEntry;

  export interface Swagger {
    definitions: {
      Security?: UNKNOWN;
    };
    paths: UNKNOWN_OBJ;
  }

  export function getSwaggerForService(
    wsdlEntry: WSDLEntry,
    serviceName: string,
    wsdlId: string,
    createOptions?: UNKNOWN_OBJ
  ): Swagger;
}
