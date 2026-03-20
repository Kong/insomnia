declare module 'json-bigint' {
  interface JSONBigOptions {
    strict?: boolean;
    storeAsString?: boolean;
    alwaysParseAsBig?: boolean;
    useNativeBigInt?: boolean;
    protoAction?: 'error' | 'ignore' | 'preserve';
    constructorAction?: 'error' | 'ignore' | 'preserve';
  }

  interface JSONBigInt {
    parse(text: string): unknown;
    stringify(value: unknown): string;
  }

  function JSONBig(options?: JSONBigOptions): JSONBigInt;
  namespace JSONBig {
    function parse(text: string): unknown;
    function stringify(value: unknown): string;
  }

  export = JSONBig;
}
