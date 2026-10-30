import type {
  Environment as AppEnvironment,
  EnvironmentKvPairData,
  EnvironmentKvPairDataType as AppEnvironmentKvPairDataType,
} from "insomnia-data";

// Mirrors `models.environment.type`; a runtime import of insomnia-data would drag the whole data package into the CJS framework.
const ENVIRONMENT_TYPE = "Environment";

// Mirrors the app's enum. insomnia-data is ESM-only, so only the type is imported and the values are inlined here.
export type EnvironmentKvPairDataType = AppEnvironmentKvPairDataType;
// eslint-disable-next-line @typescript-eslint/no-redeclare -- type and value intentionally share a name, like an enum
export const EnvironmentKvPairDataType = {
  JSON: "json",
  STRING: "str",
  SECRET: "secret",
} as unknown as {
  JSON: AppEnvironmentKvPairDataType.JSON;
  STRING: AppEnvironmentKvPairDataType.STRING;
  SECRET: AppEnvironmentKvPairDataType.SECRET;
};
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
