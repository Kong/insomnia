let monitoring = true;
let scriptPromises = new Array<Promise<any>>();

export const OriginalPromise = Promise;

export class ProxiedPromise<T> extends Promise<T> {
    constructor(
        executor: (
            resolve: (value: T | PromiseLike<T>) => void,
            reject: (reason?: any) => void,
        ) => void,
    ) {
        super(executor);
        if (monitoring) {
            scriptPromises.push(this);
        }
    }

    static override all(promises: Promise<any>[]) {
        const promise = super.all(promises);
        if (monitoring) {
            scriptPromises.push(promise);
        }
        return promise;
    }

    static override allSettled(promises: Promise<any>[]) {
        // promise will be counted in Promise.resolve
        return super.allSettled(promises);
    }

    // TODO: super.any seems not supported for the compile target (es2021)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static any(_: Promise<any>[]) {
        return super.reject("'super.any' not supported");
    }

    static override race(promises: Promise<any>[]) {
        const promise = super.race(promises);
        if (monitoring) {
            scriptPromises.push(promise);
        }
        return promise;
    }

    static override reject(value: any) {
        const promise = super.reject(value);
        if (monitoring) {
            scriptPromises.push(promise);
        }
        return promise;
    }

    static override resolve<T>(value?: T | PromiseLike<T>) {
        const promise = super.resolve(value);
        if (monitoring) {
            scriptPromises.push(promise);
        }
        return promise;
    }

    // TODO: Promise.any seems not supported for the compile target (es2021)
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    static withResolvers() {
        return super.reject("'Promise.withResolvers' not supported");
    }
}

export const asyncTasksAllSettled = async () => {
    await Promise.allSettled(scriptPromises);
    scriptPromises = [];
};

export const stopMonitorAsyncTasks = () => {
    monitoring = false;
};

export const resetAsyncTasks = async () => {
    scriptPromises = [];
    monitoring = true;
};
