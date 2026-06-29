import { getExistingConsole } from './console';
import { getInterpolator } from './interpolator';


/**
 * Represents an environment object that stores key-value pairs and provides methods to interact with them.
 *
 * The `Environment` class allows for the creation of an environment with a name and an optional set of initial key-value pairs.
 * It provides methods to manage variables, retrieve values, and replace placeholders in strings using the stored variables.
 * `insomnia.environment`, `insomnia.globals` and `insomnia.baseEnvironment` are instances of this class.
 *
 * ### Example Usage
 * ```javascript
 * const env = new Environment('Development', { apiUrl: 'https://api.example.com' });
 * console.log(env.name); // Output: 'Development'
 * console.log(env.get('apiUrl')); // Output: 'https://api.example.com'
 * env.set('token', 'abc123');
 * console.log(env.get('token')); // Output: 'abc123'
 * env.unset('token');
 * console.log(env.has('token')); // Output: false
 * ```
 *
 * #### Features:
 * - Store and manage key-value pairs.
 * - Replace placeholders in strings with environment variable values.
 * - Convert the environment to a plain JavaScript object.
 * - Clear all stored variables.
 *
 * @class Environment
 */
export class Environment {
  /**
   * The name of the environment.
   * This property is used to store the identifier or display name of the environment.
   * It is intended to be a private field and should not be accessed directly outside the class.
   */
  private _name: string;
  private kvs = new Map<string, boolean | number | string | undefined>();

  /**
   * Constructs an instance of the environment object.
   * Initializes the environment with a name and a key-value store derived from the provided JSON object.
   *
   * @param name - The name of the environment.
   * @param jsonObject - An optional object containing key-value pairs to initialize the environment.
   *                     If undefined, an empty key-value store will be created.
   */
  constructor(name: string, jsonObject: object | undefined) {
    this._name = name;
    this.kvs = new Map(Object.entries(jsonObject || {}));
  }

  /**
   * Gets the name of the environment.
   *
   * @returns {string} The name of the environment.
   */
  get name() {
    return this._name;
  }

  /**
   * Checks if a variable with the specified name exists in the environment.
   *
   * @param variableName - The name of the variable to check for existence.
   * @returns `true` if the variable exists, otherwise `false`.
   */
  has = (variableName: string) => {
    return this.kvs.has(variableName);
  };

  /**
   * Retrieves the value associated with the specified environment variable name.
   *
   * @param variableName - The name of the environment variable to retrieve.
   * @returns The value of the specified environment variable, or `undefined` if it does not exist.
   */
  get = (variableName: string) => {
    return this.kvs.get(variableName);
  };

  /**
   * Sets a variable in the key-value store with the specified name and value.
   * If the provided value is `null`, a warning is logged and the variable is not set.
   *
   * @param variableName - The name of the variable to set.
   * @param variableValue - The value to assign to the variable. Can be a boolean, number, string, undefined, or null.
   *                        If `null`, the variable will not be set, and a warning will be logged.
   */
  set = (variableName: string, variableValue: boolean | number | string | undefined | null) => {
    if (variableValue === null) {
      getExistingConsole().warn(`Variable "${variableName}" has a null value`);
      return;
    }
    this.kvs.set(variableName, variableValue);
  };

  /**
   * Removes a variable from the environment by its name.
   *
   * @param variableName - The name of the variable to be removed.
   */
  unset = (variableName: string) => {
    this.kvs.delete(variableName);
  };

  /**
   * Clears all key-value pairs stored in the environment.
   * This method removes all entries from the internal storage.
   */
  clear = () => {
    this.kvs.clear();
  };

  /**
   * Replaces placeholders in the given template string with values from the environment object.
   *
   * It supports following placeholders:
   * - `insomnia.environment.replaceIn("My id is {{$randomUUID}}")`, which generates a random UUID.
   * - `insomnia.environment.replaceIn("Visiting URL: {{urlValueFromEnvironment}}")`, which replaces `urlValueFromEnvironment` with the value of that variable in the active environment.
   *
   * @param template - The template string containing placeholders to be replaced.
   * @returns The rendered string with placeholders replaced by their corresponding values.
   * 
   * @throws Will throw an error if template is not a string or object.
   */
  replaceIn = async (template: string | object) => {
    if (typeof template === 'object') {
      template = template.toString();
    } else if (typeof template !== 'string') {
      throw new TypeError('The template must be a string or an object');
    }

    return getInterpolator().render(template, this.toObject());
  };

  /**
   * Converts the key-value pairs stored in the current instance into a plain JavaScript object.
   *
   * @returns {Record<string, any>} A plain object representation of the key-value pairs.
   */
  toObject = () => {
    return Object.fromEntries(this.kvs.entries());
  };

  toJSON() {
    return this.toObject();
  }
}

/** @ignore */
function mergeFolderLevelVars(folderLevelVars: Environment[]) {
  const mergedFolderLevelObject = folderLevelVars.reduce((merged: object, folderLevelEnv: Environment) => {
    return { ...merged, ...folderLevelEnv.toObject() };
  }, {});
  return new Environment('mergedFolderLevelVars', mergedFolderLevelObject);
}

/**
 * The `Variables` class provides a hierarchical structure for managing environment variables
 * across different scopes such as global, collection, environment, iteration data, folder-level,
 * and local variables. It offers methods to check for variable existence, retrieve values, set
 * local variables, replace placeholders in strings, and consolidate variables into a single object.
 *
 * ### Scopes
 * The class supports the following scopes:
 * - **Base Global Variables**: Default global variables.
 * - **Global Variables**: Selected global variables.
 * - **Collection Variables**: Variables specific to a collection.
 * - **Environment Variables**: Variables specific to the active environment.
 * - **Iteration Data Variables**: Variables from the collection runner's iteration data.
 * - **Folder-Level Variables**: Variables inherited from parent folders.
 * - **Local Variables**: Temporary variables valid during execution.
 *
 *
 * ### Usage Example
 * ```javascript
 * const variables = new Variables({
 *   baseGlobalVars: baseGlobalEnv,
 *   globalVars: globalEnv,
 *   collectionVars: collectionEnv,
 *   environmentVars: activeEnv,
 *   iterationDataVars: iterationDataEnv,
 *   folderLevelVars: folderVars,
 *   localVars: localEnv,
 * });
 *
 * const hasVariable = variables.has('myVariable');
 * const variableValue = variables.get('myVariable');
 * variables.set('myVariable', 'newValue');
 * const renderedString = variables.replaceIn('Hello, {{myVariable}}!');
 * const allVariables = variables.toObject();
 * ```
 */
export class Variables {
  // TODO: support vars for all levels
  private globalVars: Environment;
  private baseGlobalVars: Environment;
  private collectionVars: Environment;
  private environmentVars: Environment;
  private iterationDataVars: Environment;
  private folderLevelVars: Environment[];
  private localVars: Environment;

  /**
   * Constructs an instance of the class with the provided environment variables.
   *
   * @param args - An object containing various environment variables.
   * @param args.baseGlobalVars - The base global environment variables.
   * @param args.globalVars - The selected global environment variables.
   * @param args.collectionVars - The base environment variables.
   * @param args.environmentVars - The selected environment variables.
   * @param args.iterationDataVars - The iteration data (from the collectio runner) variables.
   * @param args.folderLevelVars - An array of folder-level environment variables from parent folders.
   * @param args.localVars - The local environment variables, which are only valid during the execution.
   */
  constructor(args: {
    baseGlobalVars: Environment;
    globalVars: Environment;
    collectionVars: Environment;
    environmentVars: Environment;
    iterationDataVars: Environment;
    folderLevelVars: Environment[];
    localVars: Environment;
  }) {
    this.baseGlobalVars = args.baseGlobalVars;
    this.globalVars = args.globalVars;
    this.collectionVars = args.collectionVars;
    this.environmentVars = args.environmentVars;
    this.iterationDataVars = args.iterationDataVars;
    this.folderLevelVars = args.folderLevelVars;
    this.localVars = args.localVars;
  }

  /**
   * Checks if a variable with the specified name exists in any of the defined variable scopes.
   *
   * The method searches through the following scopes in order:
   * 1. Local variables
   * 2. Folder-level variables
   * 3. Iteration data variables
   * 4. Environment variables
   * 5. Collection variables
   * 6. Global variables
   * 7. Base global variables
   *
   * @param variableName - The name of the variable to check for existence.
   * @returns `true` if the variable exists in any scope; otherwise, `false`.
   */
  has = (variableName: string) => {
    const baseGlobalVarsHas = this.baseGlobalVars.has(variableName);
    const globalVarsHas = this.globalVars.has(variableName);
    const collectionVarsHas = this.collectionVars.has(variableName);
    const environmentVarsHas = this.environmentVars.has(variableName);
    const iterationDataVarsHas = this.iterationDataVars.has(variableName);
    const folderLevelVarsHas = this.folderLevelVars.some(vars => vars.has(variableName));
    const localVarsHas = this.localVars.has(variableName);

    return (
      localVarsHas ||
      folderLevelVarsHas ||
      iterationDataVarsHas ||
      environmentVarsHas ||
      collectionVarsHas ||
      globalVarsHas ||
      baseGlobalVarsHas
    );
  };

  /**
   * Retrieves the value of a variable by searching through the variable hierarchy.
   *
   * The method searches for the variable in the following order of precedence:
   * 1. Local variables
   * 2. Folder-level variables
   * 3. Iteration data variables
   * 4. Environment variables
   * 5. Collection variables
   * 6. Global variables
   * 7. Base global variables
   *
   * Returns the first value found in the hierarchy.
   *
   * @param variableName - The name of the variable to retrieve
   * @returns The value of the variable if found, otherwise undefined
   */
  get = (variableName: string) => {
    let finalVal: boolean | number | string | object | undefined;
    [
      this.localVars,
      mergeFolderLevelVars(this.folderLevelVars),
      this.iterationDataVars,
      this.environmentVars,
      this.collectionVars,
      this.globalVars,
      this.baseGlobalVars,
    ].forEach(vars => {
      const value = vars.get(variableName);
      if (!finalVal && value) {
        finalVal = value;
      }
    });

    return finalVal;
  };

  /**
   * Sets a local variable with the specified name and value.
   * If the provided value is `null`, a warning is logged and the variable is not set.
   *
   * @param variableName - The name of the variable to set.
   * @param variableValue - The value to assign to the variable. Can be a boolean, number, string, undefined, or null.
   *                        If `null`, the variable will not be set and a warning will be logged.
   */
  set = (variableName: string, variableValue: boolean | number | string | undefined | null) => {
    if (variableValue === null) {
      getExistingConsole().warn(`Variable "${variableName}" has a null value`);
      return;
    }

    this.localVars.set(variableName, variableValue);
  };

  /**
   * Replaces placeholders in the given template string with values from the current environment context.
   *
   * It supports following placeholders:
   * - `insomnia.variables.replaceIn("My id is {{$randomUUID}}")`, which generates a random UUID.
   * - `insomnia.variables.replaceIn("Visiting URL: {{urlValueFromEnvironment}}")`, which replaces `urlValueFromEnvironment` with the value of that variable in the active environment.
   *
   * @param template - The template string containing placeholders to be replaced.
   * @returns The rendered string with placeholders replaced by their corresponding values.
   * 
   * @throws Will throw an error if template is not a string or object.
   */
  replaceIn = async (template: string | object) => {
    if (typeof template === 'object') {
      template = template.toString();
    } else if (typeof template !== 'string') {
      throw new TypeError('The template must be a string or an object');
    }

    const context = this.toObject();
    return getInterpolator().render(template, context);
  };

  /**
   * Converts the current environment variables into a single consolidated object.
   *
   * This method aggregates various levels of variables including global, collection,
   * environment, iteration data, folder-level, and local variables.
   *
   * @returns {Record<string, any>} A consolidated object containing all environment variables.
   */
  toObject = () => {
    return [
      this.baseGlobalVars,
      this.globalVars,
      this.collectionVars,
      this.environmentVars,
      this.iterationDataVars,
      mergeFolderLevelVars(this.folderLevelVars),
      this.localVars,
    ]
      .map(vars => vars.toObject())
      .reduce((ctx, obj) => ({ ...ctx, ...obj }), {});
  };

  /** @ignore */
  localVarsToObject = () => {
    return this.localVars.toObject();
  };
}

/**
 * Represents a secure environment vault that extends the {@link Environment} class.
 *
 * The `Vault` class provides controlled access to sensitive data.
 * Access to the vault's properties and methods is restricted in scripting environments
 * Accessing vault values from script must be turned on in preference. When disabled, any attempt to get or set
 * properties will throw an error, ensuring that vault data remains protected.
 *
 * @extends Environment
 *
 * @example
 * ```javascript
 * insomnia.vault.get(<ENV_NAME>)
 * ```
 *
 * @example
 * ```javascript
 * const vault = new Vault('MyVault', { secret: 'value' }, false);
 * ```
 */
export class Vault extends Environment {
  /**
   * Constructs an instance of the Vault class.
   *
   * @param name - The name associated with the environment.
   * @param jsonObject - An optional JSON object representing the vault's data.
   * @param enableVaultInScripts - A boolean flag indicating whether vault access is enabled in scripts.
   *
   * @throws Will throw an error if `enableVaultInScripts` is `false` and an attempt is made to get or set a property.
   */
  constructor(name: string, jsonObject: object | undefined, enableVaultInScripts: boolean) {
    super(name, jsonObject);
    return new Proxy(this, {
      // throw error on get or set method call if enableVaultInScripts is false
      get: (target, prop, receiver) => {
        if (!enableVaultInScripts) {
          throw new Error('Vault is disabled in script');
        }
        return Reflect.get(target, prop, receiver);
      },
      set: (target, prop, value, receiver) => {
        if (!enableVaultInScripts) {
          throw new Error('Vault is disabled in script');
        }
        return Reflect.set(target, prop, value, receiver);
      },
    });
  }

  /** @ignore */
  unset = () => {
    throw new Error('Vault can not be unset in script');
  };

  /** @ignore */
  clear = () => {
    throw new Error('Vault can not be cleared in script');
  };

  /** @ignore */
  set = () => {
    throw new Error('Vault can not be set in script');
  };
}
