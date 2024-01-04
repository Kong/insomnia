import { database as db } from '../common/database';
import type { BaseModel } from './index';

export const name = 'RequestSetter';

export const type = 'RequestSetter';

export const prefix = 'rqes';

export const canDuplicate = true;
export enum SetterEventType {
    BEFORE_SEND_REQUEST,
    DURING_SEND_REQUEST,
    AFTER_RECEIVED_RESPONSE,
}

export const canSync = true;
interface BaseRequestSetter {
    event: SetterEventType;
    objectKey: string;
    setterValue: string;
    description: string;
    enabled: boolean;
    metaSortKey: number;
    multiline?: boolean;
}

export type RequestSetter = BaseModel & BaseRequestSetter;

export const isRequestSetter = (model: Pick<BaseModel, 'type'>): model is RequestSetter => (
    model.type === type
);

export function init(): BaseRequestSetter {
    return {
        event: SetterEventType.BEFORE_SEND_REQUEST,
        objectKey: '',
        setterValue: '',
        description: '',
        enabled: true,
        metaSortKey: -1 * Date.now(),
        multiline: false,
    };
}

export function sort(s1: RequestSetter, s2: RequestSetter) {
    return s1.metaSortKey - s2.metaSortKey;
}

export function migrate(doc: RequestSetter) {
    return doc;
}

export function create(patch: Partial<RequestSetter> = {}) {
    if (!patch.parentId) {
        throw new Error('New RequestSetter missing `parentId`: ' + JSON.stringify(patch));
    }

    return db.docCreate<RequestSetter>(type, patch);
}

export function update(requestSetter: RequestSetter, patch: Partial<RequestSetter> = {}) {
    return db.docUpdate<RequestSetter>(requestSetter, patch);
}

export function getById(id: string) {
    return db.get<RequestSetter>(type, id);
}

export function findByParentId(parentId: string) {
    return db.find<RequestSetter>(type, { parentId });
}

export function getAfterReceivedResponseSetters(setters: RequestSetter[]) {
    return setters
        ?.filter(s => s.event === SetterEventType.AFTER_RECEIVED_RESPONSE)
        ?.sort(sort) || [];
}

export function remove(requestGroup: RequestSetter) {
    return db.remove(requestGroup);
}

export function all() {
    return db.all<RequestSetter>(type);
}

export async function duplicate(requestGroup: RequestSetter, patch: Partial<RequestSetter> = {}) {
    if (!patch.name) {
        patch.name = `${requestGroup.name} (Copy)`;
    }

    // Get sort key of next request
    const q = {
        metaSortKey: {
            $gt: requestGroup.metaSortKey,
        },
    };

    // @ts-expect-error -- TSCONVERSION appears to be a genuine error
    const [nextRequestGroup] = await db.find<RequestSetter>(type, q, {
        metaSortKey: 1,
    });

    const nextSortKey = nextRequestGroup
        ? nextRequestGroup.metaSortKey
        : requestGroup.metaSortKey + 100;

    // Calculate new sort key
    const sortKeyIncrement = (nextSortKey - requestGroup.metaSortKey) / 2;
    const metaSortKey = requestGroup.metaSortKey + sortKeyIncrement;
    return db.duplicate<RequestSetter>(requestGroup, {
        metaSortKey,
        ...patch,
    });
}
