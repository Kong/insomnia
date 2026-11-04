import { RequestPage } from "./request.page";

export class WebSocketRequestPage extends RequestPage {
  protected readonly urlBarId = "websocket-url-bar";
  protected readonly persistedDbFile = "insomnia.WebSocketRequest.db";
}
