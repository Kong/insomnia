import { Property, PropertyList } from './properties';

/**
 * Represents the definition of an HTTP header.
 *
 * @property key - The name of the header.
 * @property value - The value of the header.
 * @property id - An optional unique identifier for the header.
 * @property name - An optional alternative name for the header.
 * @property disabled - An optional flag indicating whether the header is disabled.
 */
export interface HeaderDefinition {
  key: string;
  value: string;
  id?: string;
  name?: string;
  disabled?: boolean;
}

/**
 * Represents an HTTP header with a key-value pair structure.
 *
 * This class provides methods for creating, parsing, and manipulating HTTP headers.
 * It extends the `Property` class and includes additional functionality specific to headers.
 *
 * @remarks
 * - The `Header` class supports parsing raw header strings into structured objects.
 * - It also provides utilities for converting header objects back into string format.
 * - The `key` property represents the header name, while the `value` property represents its value.
 *
 * @example
 * ```typescript
 * const { Header } = require("insomnia-collection");
 *
 * const header = new Header('Content-Type: application/json');
 * console.log(header.key); // 'Content-Type'
 * console.log(header.value); // 'application/json'
 *
 * const parsedHeaders = Header.parse('Content-Type: application/json\nUser-Agent: MyClientLibrary/2.0\n');
 * console.log(parsedHeaders); // [{ key: 'Content-Type', value: 'application/json' }, { key: 'User-Agent', value: 'MyClientLibrary/2.0' }]
 *
 * const headerString = Header.unparse(parsedHeaders);
 * console.log(headerString); // 'Content-Type: application/json\nUser-Agent: MyClientLibrary/2.0'
 * ```
 */
export class Header extends Property {
  /** @ignore */
  override _kind = 'Header';

  /**
   * Represents the name of the header.
   */
  key: string;
  /**
   * Represents the value of a header.
   */
  value: string;

  /**
   * Constructs a new instance of the class with the provided header definition or string.
   *
   * @param opts - A `HeaderDefinition` object or a string representing a single header.
   *               If a string is provided, it will be parsed into a header object.
   * @param name - (Optional) A string that overrides the `key` property of the header.
   *               If not provided, the `name` property from the `opts` object will be used.
   */
  constructor(
    opts: HeaderDefinition | string,
    name?: string, // if it is defined, it overrides 'key' (not 'name')
  ) {
    super();

    if (typeof opts === 'string') {
      const obj = Header.parseSingle(opts);
      this.key = obj.key;
      this.value = obj.value;
    } else {
      this.id = opts.id ? opts.id : '';
      this.key = opts.key ? opts.key : '';
      this.name = name ? name : opts.name ? opts.name : '';
      this.value = opts.value ? opts.value : '';
      this.disabled = opts ? opts.disabled : false;
    }
  }

  /** @ignore */
  static override _index = 'key';

  /**
   * Creates a new `Header` instance.
   *
   * @param input - An object containing `key` and `value` properties, or a string.
   *                If not provided, defaults to an object with empty `key` and `value`.
   * @param name - An optional name for the header.
   * @returns A new `Header` instance.
   */
  static create(input?: { key: string; value: string } | string, name?: string): Header {
    return new Header(input || { key: '', value: '' }, name);
  }

  /**
   * Determines if the given object is a Header object.
   * @param obj - The object to check.
   * @returns `true` if the object is a Header, otherwise `false`.
   */
  static isHeader(obj: object) {
    return '_kind' in obj && obj._kind === 'Header';
  }

  // example: 'Content-Type: application/json\nUser-Agent: MyClientLibrary/2.0\n'
  /**
   * Parses a header string into an array of key-value pair objects.
   *
   * The input string is expected to have headers separated by newline characters.
   * Each non-empty line is processed and converted into an object with `key` and `value` properties.
   *
   * @param headerString - The raw header string to be parsed.
   * @returns An array of objects, where each object represents a header with `key` and `value` properties.
   */
  static parse(headerString: string): { key: string; value: string }[] {
    return headerString
      .split('\n')
      .filter(kvPart => kvPart.trim() !== '')
      .map(kvPart => Header.parseSingle(kvPart));
  }

  /**
   * Parses a single HTTP header string into an object containing the key and value.
   *
   * The input string should follow the format `Key: Value`, where the first colon (`:`)
   * separates the header key from its value. Leading and trailing whitespace around
   * the key and value will be trimmed.
   *
   * @param headerStr - The HTTP header string to parse.
   * @returns An object containing the `key` and `value` of the header.
   * @throws {Error} If the input string does not contain a colon or is otherwise invalid.
   *
   * @example
   * ```typescript
   * const header = Headers.parseSingle('Content-Type: application/json');
   * console.log(header); // { key: 'Content-Type', value: 'application/json' }
   * ```
   */
  static parseSingle(headerStr: string): { key: string; value: string } {
    // https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers
    // the first colon is the separator
    const separatorPos = headerStr.indexOf(':');

    if (separatorPos <= 0) {
      throw new Error('Header.parseSingle: the header string seems invalid');
    }

    const key = headerStr.slice(0, separatorPos);
    const value = headerStr.slice(separatorPos + 1);

    return { key: key.trim(), value: value.trim() };
  }

  /**
   * Converts an array of headers into a single string representation.
   *
   * @param headers - An array of header objects, each containing a `key` and `value` property,
   * or a `PropertyList` of `Header` objects.
   * @param separator - An optional string used to separate the headers in the resulting string.
   * Defaults to a newline character (`\n`) if not provided.
   * @returns A string representation of the headers, joined by the specified separator.
   */
  static unparse(headers: { key: string; value: string }[] | PropertyList<Header>, separator?: string): string {
    const headerArray: { key: string; value: string }[] = headers.map(header => this.unparseSingle(header), {});

    return headerArray.join(separator || '\n');
  }

  /**
   * Converts a header object into a single header string in the format "key: value".
   *
   * @param header - The header object to unparse. It can either be an object with
   *                 `key` and `value` properties or an instance of the `Header` class.
   * @returns The header represented as a string in the format "key: value".
   */
  static unparseSingle(header: { key: string; value: string } | Header): string {
    // both PropertyList and object contains 'key' and 'value'
    return `${header.key}: ${header.value}`;
  }

  /**
   * Updates the current header with a new key-value pair.
   *
   * @param newHeader - An object containing the new key and value for the header.
   *   - `key`: The new key for the header.
   *   - `value`: The new value for the header.
   */
  update(newHeader: { key: string; value: string }) {
    this.key = newHeader.key;
    this.value = newHeader.value;
  }

  /**
   * Return the value of the current object.
   *
   * @returns The value associated with the current object.
   */
  override valueOf() {
    return this.value;
  }
}

/**
 * Represents a list of headers, extending the functionality of `PropertyList`.
 * This class provides methods to manage and interact with a collection of headers.
 *
 * @template T - A type that extends the `Header` class.
 *
 * @extends PropertyList<T>
 */
export class HeaderList<T extends Header> extends PropertyList<T> {
  /**
   * Constructs a new instance of the class.
   *
   * @param parent - The parent `PropertyList` instance or `undefined` if there is no parent.
   * @param populate - An array of items of {@link Header} to initialize the list with.
   */
  constructor(parent: PropertyList<T> | undefined, populate: T[]) {
    super(Header, undefined, populate);
    this.parent = parent;
  }

  /**
   * Determines if the given object is a HeaderList.
   * @param obj - The object to check.
   * @returns `true` if the object is a HeaderList, otherwise `false`.
   */
  static isHeaderList(obj: any) {
    return '_kind' in obj && obj._kind === 'HeaderList';
  }

  /**
   * Calculates the total size of all headers in the list.
   *
   * This method maps each header to its string representation, calculates the
   * length of each string, and sums up the lengths to determine the total size.
   *
   * @returns The total size of all headers as a number.
   */
  contentSize(): number {
    return this.list
      .map(header => header.toString())
      .map(headerStr => headerStr.length) // TODO: handle special characters
      .reduce((totalSize, headerSize) => totalSize + headerSize, 0);
  }
}
