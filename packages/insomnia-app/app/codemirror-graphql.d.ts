import { GraphQLInfoOptions } from 'codemirror-graphql/info';

declare module 'codemirror-graphql/jump' {
  type ModifiedGraphQLJumpOptions = Omit<GraphQLJumpOptions, 'onClick'> & {
    onClick: GraphQLInfoOptions['onClick'];
  };
}
