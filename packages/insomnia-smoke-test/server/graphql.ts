import { GraphQLEnumType, GraphQLInputObjectType, GraphQLInt, GraphQLObjectType, GraphQLSchema, GraphQLString } from 'graphql';

const TypeVars = new GraphQLObjectType({
  name: 'Vars',
  fields: () => ({
    stringVar: { type: GraphQLString },
    intVar: { type: GraphQLInt },
  }),
});

const InputVars = new GraphQLInputObjectType({
  name: 'VarsInput',
  fields: () => ({
    stringVar: { type: GraphQLString },
    intVar: { type: GraphQLInt },
  }),
});

export const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'Query',
    fields: {
      hello: {
        type: GraphQLString,
        resolve: () => 'Hello world!',
      },
      bearer: {
        type: new GraphQLEnumType({
          name: 'RingBearer',
          description: 'Characters who at any time bore a Ring of Power.',
          values: {
            Frodo: { value: 0 },
            Bilbo: { value: 1 },
            Thror: { value: 2 },
            Gandalf: { value: 3 },
            Galadriel: { value: 4 },
            WitchKing: { value: 5 },
            Nazgul: { value: 6 },
            Elrond: { value: 7 },
            GilGalad: { value: 8 },
            Cirdan: { value: 9 },
            Thrain: { value: 10 },
          },
        }),
        resolve: () => 3,
      },
      echoNum: {
        type: GraphQLInt,
        args: {
          'intVar': { type: GraphQLInt },
        },
        resolve: () => 777,
      },
      echoVars: {
        type: TypeVars,
        args: {
          'vars': { type: InputVars },
        },
        resolve: vars => vars,
      },
    },
  }),
});
