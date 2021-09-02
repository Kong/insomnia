import { GraphQLArgument, GraphQLField, GraphQLType } from 'graphql';

type GraphQLFieldAny = GraphQLField<any, any>;

// It is possible for args to be undefined, but the exported type has it as required, so we override it here
export type GraphQLFieldWithOptionalArgs =
  & Omit<GraphQLFieldAny, 'args'>
  & Partial<Pick<GraphQLFieldAny, 'args'>>;

export interface GraphQLFieldWithParentName extends GraphQLFieldWithOptionalArgs {
  parentName?: string;
}

export interface ActiveReference {
  type: GraphQLType | null;
  argument: GraphQLArgument | null;
  field: GraphQLFieldWithOptionalArgs | null;
}
