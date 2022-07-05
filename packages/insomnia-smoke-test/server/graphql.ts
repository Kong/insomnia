import { buildSchema } from 'graphql';

// Construct a schema, using GraphQL schema language
export const schema = buildSchema(`
  """Characters who at any time bore a Ring of Power."""
  enum RingBearer {
    Frodo
    Bilbo
    Thror
    Gandalf
    Galadriel
    WitchKing
    Nazgul
    Elrond
    GilGalad
    Cirdan
    Thrain
  }
  type Query {
    hello: String,
    bearer: RingBearer!
  }
`);

// The root provides a resolver function for each API endpoint
export const root = {
  hello: () => {
    return 'Hello world!';
  },
  bearer: () => {
    return 'Gandalf';
  },
};
