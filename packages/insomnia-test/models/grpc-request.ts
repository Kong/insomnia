import type {
  GrpcRequest as AppGrpcRequest,
  GrpcRequestHeader,
} from "insomnia-data";

export interface GrpcRequestInit extends Pick<AppGrpcRequest, "name" | "url"> {
  method?: string;
  body?: string;
  headers?: GrpcRequestHeader[];
  id?: string;
}

export class GrpcRequest implements GrpcRequestInit {
  name: string;
  url: string;
  method?: string;
  body?: string;
  headers?: GrpcRequestHeader[];
  id?: string;

  constructor(init: GrpcRequestInit) {
    this.name = init.name;
    this.url = init.url;
    this.method = init.method;
    this.body = init.body;
    this.headers = init.headers;
    this.id = init.id;
  }
}

export type { GrpcRequestHeader };
