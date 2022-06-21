import { buildSchema } from 'graphql';

// Construct a schema, using GraphQL schema language
export const schema = buildSchema(`
  enum LordOfTheRings {
    FELLOWSHIPOFTHERING
    THETWOTOWERS
    RETURNOFTHEKING
  }
  type Query {
    hello: String,
    exampleEnum: LordOfTheRings!
  }
`);

// The root provides a resolver function for each API endpoint
export const root = {
  hello: () => {
    return 'Hello world!';
  },
  exampleEnum: () => {
    return 'FELLOWSHIPOFTHERING';
  },
};
