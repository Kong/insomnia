import { database } from '../../common/database';
import type { ModelTypes } from "../../models";
import * as models from '../../models';
import { ipcMainHandle } from "./electron";
export interface DatabaseBridgeAPI {
  getWhere: <T>(type: ModelTypes, options: Record<string, unknown>) => Promise<T>;
  find: <T>(type: ModelTypes, options: Record<string, unknown>) => Promise<T[]>;
  caCertificate: {
    create: (options: { parentId: string; path: string }) => Promise<string>;
  };
}
export const registerDataBaseHandlers = () => {
  ipcMainHandle('database.caCertificate.create', async (_, options: { parentId: string; path: string }) => {
    return models.caCertificate.create(options);
  });
  ipcMainHandle('database.getWhere', async (_, options: { type: ModelTypes; query: Record<string, unknown> }) => {
    return (await database.find(options.type, options.query))?.[0];
  })
  ipcMainHandle('database.find', async (_, options: { type: ModelTypes; query: Record<string, unknown> }) => {
    return database.find(options.type, options.query);
  })
}
