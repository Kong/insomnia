import type {
  Environment as AppEnvironment,
  EnvironmentKvPairData,
} from "../../insomnia-data/src/models/environment";
import { type as ENVIRONMENT_TYPE } from "../../insomnia-data/src/models/environment";

export { EnvironmentKvPairDataType } from "../../insomnia-data/src/models/environment";
export type { EnvironmentKvPairData };
export { ENVIRONMENT_TYPE };

export interface EnvironmentInit
  extends
    Pick<AppEnvironment, "name">,
    Partial<Pick<AppEnvironment, "isPrivate" | "type">> {
  kvPairData?: EnvironmentKvPairData[];
  containerName?: string;
  id?: string;
}

export class Environment implements EnvironmentInit {
  name: string;
  isPrivate?: boolean;
  type?: AppEnvironment["type"];
  kvPairData?: EnvironmentKvPairData[];
  containerName?: string;
  id?: string;

  constructor(init: EnvironmentInit) {
    this.name = init.name;
    this.isPrivate = init.isPrivate;
    this.type = init.type;
    this.kvPairData = init.kvPairData;
    this.containerName = init.containerName;
    this.id = init.id;
  }
}

export function isEnvironmentItem(item: unknown): item is Environment {
  return (
    typeof item === "object" &&
    item !== null &&
    (item as { type?: unknown }).type === ENVIRONMENT_TYPE
  );
}
