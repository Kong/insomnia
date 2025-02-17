import { Environment } from './environments';

// Folder reprensents a request folder in Insomnia.
export class Folder {
    id: string;
    name: string;
    environment: Environment;

    constructor(id: string, name: string, environmentObject: object | undefined) {
        this.id = id;
        this.name = name;
        this.environment = new Environment(`${id}.environment`, environmentObject);
    }

    toObject = () => {
        return {
            id: this.id,
            name: this.name,
            environment: this.environment.toObject(),
        };
    };
}

// ParentFolders reprensents ancestor folders of the active request
export class ParentFolders {
    constructor(private folders: Folder[]) { }

    get = (idOrName: string) => {
        const folder = this.folders.find(folder => folder.name === idOrName || folder.id === idOrName);
        if (!folder) {
            throw Error(`Folder "${idOrName}" not found`);
        }
        return folder;
    };

    getById = (id: string) => {
        const folder = this.folders.find(folder => folder.id === id);
        if (!folder) {
            throw Error(`Folder "${id}" not found`);
        }
        return folder;
    };

    getByName = (folderName: string) => {
        const folder = this.folders.find(folder => folder.name === folderName);
        if (!folder) {
            throw Error(`Folder "${folderName}" not found`);
        }
        return folder;
    };

    findValue = (valueKey: string) => {
        const targetEnv = [...this.folders].reverse().find(folder => folder.environment.has(valueKey));
        return targetEnv !== undefined ? targetEnv.environment.get(valueKey) : undefined;
    };

    toObject = () => {
        return this.folders.map(folder => folder.toObject());
    };
}
