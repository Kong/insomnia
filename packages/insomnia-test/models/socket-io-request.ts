import type { SocketIORequest as AppSocketIORequest } from "../../insomnia-data/src/models/socket-io-request";
import type { RequestHeader } from "../../insomnia-data/src/models/request";

export interface SocketIOMessage {
  eventName: string;
  payload: string;
}

export interface SocketIORequestInit extends Pick<
  AppSocketIORequest,
  "name" | "url"
> {
  headers?: RequestHeader[];
  message?: SocketIOMessage;
  id?: string;
}

export class SocketIORequest implements SocketIORequestInit {
  name: string;
  url: string;
  headers?: RequestHeader[];
  message?: SocketIOMessage;
  id?: string;

  constructor(init: SocketIORequestInit) {
    this.name = init.name;
    this.url = init.url;
    this.headers = init.headers;
    this.message = init.message;
    this.id = init.id;
  }
}

export type { RequestHeader };
