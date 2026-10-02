import type {
  Request as AppRequest,
  RequestHeader,
  RequestParameter,
} from "insomnia-data";

import type { HttpMethod } from "../enums/http-method";
import type { HttpRequestBody } from "./http-request";

/**
 * A field's return type, following the GraphQL introspection standard's
 * `IntrospectionTypeRef` naming (see `graphql/utilities/getIntrospectionQuery`
 * — the `graphql` package this repo's mock server already depends on) —
 * simplified to booleans rather than a `kind`/`ofType` chain, since a
 * scalar/object/input-object `kind` can't be reliably told apart from the
 * doc explorer UI alone (e.g. `Int` and `CharacterResults` render as the
 * same link style).
 */
export interface GraphQLSchemaTypeRef {
  name: string;
  isList: boolean;
  isNonNull: boolean;
}

/** Mirrors `IntrospectionInputValue`'s `name`/`type`. */
export interface GraphQLSchemaArg {
  name: string;
  type: string;
}

/** Mirrors `IntrospectionField`'s `name`/`description`/`args`/`type`. */
export interface GraphQLSchemaField {
  name: string;
  description: string;
  args: GraphQLSchemaArg[];
  type: GraphQLSchemaTypeRef;
}

/**
 * Mirrors `IntrospectionSchema`'s `queryType`/`mutationType`/
 * `subscriptionType` (as bare type names rather than `{name}` refs) plus
 * the query root type's fields — scraped from the schema documentation
 * panel rather than a real introspection response, so it only covers what
 * that panel actually renders.
 */
export interface GraphQLSchema {
  queryType?: string;
  mutationType?: string;
  subscriptionType?: string;
  fields: GraphQLSchemaField[];
}

export interface GraphQLRequestInit extends Pick<
  AppRequest,
  "name" | "url" | "preRequestScript" | "afterResponseScript"
> {
  method: HttpMethod;
  body?: HttpRequestBody;
  params?: RequestParameter[];
  headers?: RequestHeader[];
  schema?: GraphQLSchema;
  id?: string;
}

export class GraphQLRequest implements GraphQLRequestInit {
  name: string;
  url: string;
  method: HttpMethod;
  body?: HttpRequestBody;
  params?: RequestParameter[];
  headers?: RequestHeader[];
  preRequestScript?: string;
  afterResponseScript?: string;
  id?: string;

  /** Populated by `GraphQLRequestFlow.create()`/`.get()` from the schema
   * documentation panel — the root types and the query root type's fields
   * (each with its args, return type, and description) — or `undefined` if
   * the schema hasn't resolved (e.g. the request doesn't point at a
   * GraphQL endpoint). */
  schema?: GraphQLSchema;

  constructor(init: GraphQLRequestInit) {
    this.name = init.name;
    this.url = init.url;
    this.method = init.method;
    this.body = init.body;
    this.params = init.params;
    this.headers = init.headers;
    this.schema = init.schema;
    this.preRequestScript = init.preRequestScript;
    this.afterResponseScript = init.afterResponseScript;
    this.id = init.id;
  }
}

export type { HttpRequestBody as GraphQLRequestBody };
export type { RequestHeader, RequestParameter };
