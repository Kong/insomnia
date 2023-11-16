import type { BaseModel } from '.';
import { type BaseRequest, init as initRequest } from './request';

export const name = 'GraphQL Request';
export const type = 'GraphQLRequest';
export const prefix = 'gqlreq';
export const canDuplicate = true;
export const canSync = true;

interface BaseGraphQLRequest extends BaseRequest {
    variables: string;
};

export type GraphqlRequest = BaseModel & BaseGraphQLRequest;

export function init(): BaseGraphQLRequest {
    return {
        ...initRequest(),
        variables: '',
    };
}

export function migrate(doc: GraphqlRequest): GraphqlRequest {
    return doc;
}
