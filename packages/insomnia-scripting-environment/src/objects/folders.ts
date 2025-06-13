import { Environment } from './environments';

/**
 * Represents a folder with a unique identifier, name, and an associated environment.
 *
 * The `Folder` class provides functionality to manage folder-level environment variables
 * and convert the folder instance into a plain JavaScript object representation.
 */
export class Folder {
  /**
   * A unique identifier for the folder.
   */
  id: string;
  /**
   * The name of the folder.
   */
  name: string;
  /**
   * Represents the environment associated with the folder.
   * Provides access to folder-level environment variables.
   */
  environment: Environment;

  /**
   * Constructs a new instance of the Folder class.
   *
   * @param id - The unique identifier for the folder.
   * @param name - The name of the folder.
   * @param environmentObject - An optional object representing the associated folder-level environment.
   */
  constructor(id: string, name: string, environmentObject: object | undefined) {
    this.id = id;
    this.name = name;
    this.environment = new Environment(`${id}.environment`, environmentObject);
  }

  /**
   * Converts the folder instance into a plain JavaScript object representation.
   *
   * @returns An object containing the folder's `id`, `name`, and `environment` properties.
   *          The `environment` property is also converted to its object representation.
   */
  toObject = () => {
    return {
      id: this.id,
      name: this.name,
      environment: this.environment.toObject(),
    };
  };
}

/**
 * Represents a collection of parent folders and provides methods to interact with them.
 *
 * This class is designed to manage a hierarchy of folders, allowing retrieval of folders
 * by their ID or name, searching for specific values in folder environments, and converting
 * the folder structure into plain JavaScript objects.
 *
 * @example
 * ```typescript
 * const folders = new ParentFolders([folder1, folder2]);
 * const folderById = folders.getById('123');
 * const folderByName = folders.getByName('MyFolder');
 * const value = folders.findValue('key');
 * const folderObjects = folders.toObject();
 * const environments = folders.getEnvironments();
 * ```
 */
export class ParentFolders {
  /**
   * Creates an instance of the class with a list of folders.
   *
   * @param folders - An array of `Folder` objects to initialize the instance with, from bottom to top.
   */
  constructor(private folders: Folder[]) {}

  /**
   * Retrieves a folder by its ID or name.
   *
   * @param idOrName - The ID or name of the folder to retrieve.
   * @returns The folder object that matches the given ID or name.
   * @throws {Error} If no folder with the specified ID or name is found.
   */
  get = (idOrName: string) => {
    const folder = this.folders.find(folder => folder.name === idOrName || folder.id === idOrName);
    if (!folder) {
      throw new Error(`Folder "${idOrName}" not found`);
    }
    return folder;
  };

  /**
   * Retrieves a folder by its unique identifier.
   *
   * @param id - The unique identifier of the folder to retrieve.
   * @returns The folder object with the specified ID.
   * @throws Error if no folder with the given ID is found.
   */
  getById = (id: string) => {
    const folder = this.folders.find(folder => folder.id === id);
    if (!folder) {
      throw new Error(`Folder "${id}" not found`);
    }
    return folder;
  };

  /**
   * Retrieves a folder by its name.
   *
   * @param folderName - The name of the folder to retrieve.
   * @returns The folder object with the specified name.
   * @throws {Error} If no folder with the specified name is found.
   */
  getByName = (folderName: string) => {
    const folder = this.folders.find(folder => folder.name === folderName);
    if (!folder) {
      throw new Error(`Folder "${folderName}" not found`);
    }
    return folder;
  };

  /**
   * Searches for a specific value in the environments of the folders, starting from the nearest ancestor folder
   * and moving towards the top ancestor folder.
   *
   * @param valueKey - The key of the value to search for in the folder environments.
   * @returns The value associated with the specified key if found, otherwise `undefined`.
   */
  findValue = (valueKey: string) => {
    const targetEnv = [...this.folders].reverse().find(folder => folder.environment.has(valueKey));
    return targetEnv !== undefined ? targetEnv.environment.get(valueKey) : undefined;
  };

  /**
   * Converts the current folder structure into a plain JavaScript object representation.
   *
   * @returns An array of objects representing the folder structure.
   */
  toObject = () => {
    return this.folders.map(folder => folder.toObject());
  };

  /**
   * Retrieves the environments associated with the folders.
   *
   * @returns An array of environments extracted from the folders.
   */
  getEnvironments = () => {
    return this.folders.map(folder => folder.environment);
  };
}
