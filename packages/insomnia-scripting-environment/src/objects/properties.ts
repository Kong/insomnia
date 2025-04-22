import clone from 'clone';
import equal from 'deep-equal';
import _ from 'lodash';

import { getInterpolator } from './interpolator';

export const unsupportedError = (featureName: string, alternative?: string) => {
  const message =
    `${featureName} is not supported yet` + (alternative ? `, please use ${alternative} instead temporarily.` : '');
  return new Error(message);
};

/**
 * Represents the base class for properties.
 * This class provides common functionality for managing hierarchical relationships,
 * metadata, and JSON serialization of properties.
 */
export class PropertyBase {
  public _kind = 'PropertyBase';

  /**
   * A reference to the parent property, if any. This allows for hierarchical
   * relationships between properties. If no parent exists, the value will be `undefined`.
   */
  protected _parent: PropertyBase | undefined = undefined;

  /**
   * An optional description providing additional details or context.
   */
  protected description?: string;

  /**
   * Creates an instance of the class with an optional description.
   *
   * @param description - An optional string providing a description.
   */
  constructor(description?: string) {
    this.description = description;
  }

  /**
   * Determines if a given property key is considered a "meta" property.
   * In the context of Insomnia, meta properties are defined as those
   * that start with an underscore (`_`). The underscore character itself
   * is also rejected as a valid meta property key.
   *
   * @param _value - The value associated with the property (currently unused in this method).
   * @param key - The property key to evaluate.
   * @returns `true` if the key starts with an underscore (`_`), otherwise `false`.
   */
  static propertyIsMeta(_value: any, key: string) {
    // no meta is defined in the Insomnia side and it basically find properties start with '_'
    // '_' is also rejected here
    return key && key.startsWith('_');
  }

  /**
   * Removes the leading underscore ('_') from the beginning of a given property key.
   *
   * @param _value - The value associated with the property (unused in this method).
   * @param key - The property key to process.
   * @returns The property key without the leading underscore.
   */
  static propertyUnprefixMeta(_value: any, key: string) {
    return _.trimStart(key, '_');
  }

  // TODO: this is currently implemented by each instance
  // static toJSON(obj: { toJSON: () => string }) {
  //     return obj.toJSON();
  // }

  /**
   * Retrieves metadata associated with the current context.
   * Currently it returns an empty object as no metadata keys is defined.
   *
   * @returns An object representing the metadata.
   */
  meta() {
    return {};
  }

  /**
   * Retrieves the parent object associated with the current instance.
   *
   * @returns The parent object of the current instance.
   */
  parent() {
    return this._parent;
  }

  /**
   * Iterates through the parent hierarchy of the current object, starting from its immediate parent.
   * The iteration continues until the provided iterator function returns `false` or there are no more parents.
   *
   * @param options - Options to control the iteration behavior.
   *   - `withRoot` (optional): A flag to include the root object in the iteration.
   * @param iterator - A callback function that is invoked for each parent object in the hierarchy.
   *   - The function receives a cloned instance of the parent object as its argument.
   *   - If the function returns `false`, the iteration stops.
   * @returns An array of cloned parent objects that were iterated over.
   */
  forEachParent(options: { withRoot?: boolean }, iterator: (obj: PropertyBase) => boolean) {
    const currentParent = this.parent();
    if (!currentParent) {
      return;
    }

    const queue: PropertyBase[] = [currentParent];
    const parents: PropertyBase[] = [];

    while (queue.length > 0) {
      const ancester = queue.shift();
      if (!ancester) {
        continue;
      }

      // TODO: check options
      const cloned = clone(ancester);
      const keepIterating = iterator(cloned);
      parents.push(cloned);
      if (!keepIterating) {
        break;
      }

      const olderAncester = ancester.parent();
      if (olderAncester) {
        queue.push(olderAncester);
      }
    }

    if (options && !options.withRoot && parents.length > 0) {
      const potentialRoot = parents[parents.length-1];
      if (potentialRoot && potentialRoot.parent() === undefined) {
        // remove the last element if it is root
        return parents.pop();
      }
    }
    return parents;
  }

  /**
   * Traverses up the parent hierarchy to find an ancestor that contains the specified property.
   * Optionally, a customizer function can be provided to determine if the ancestor should be returned.
   *
   * @param property - The name of the property to search for in the ancestors.
   * @param customizer - An optional function that takes an ancestor as input and returns a boolean.
   *                     If provided, the traversal continues until the customizer returns a truthy value.
   *                     If not provided, the traversal stops at the first ancestor that contains the property.
   * @returns The first ancestor that satisfies the search criteria, or `undefined` if no such ancestor is found.
   */
  findInParents(property: string, customizer?: (ancester: PropertyBase) => boolean): PropertyBase | undefined {
    const currentParent = this.parent();
    if (!currentParent) {
      return;
    }

    const queue: PropertyBase[] = [currentParent];

    while (queue.length > 0) {
      const ancester = queue.shift();
      if (!ancester) {
        continue;
      }

      const cloned = clone(ancester);
      const hasProperty = Object.keys(cloned.meta()).includes(property);
      if (!hasProperty) {
        // keep traversing until parent has the property
        // no op
      } else {
        if (customizer) {
          if (customizer(cloned)) {
            // continue until customizer returns a truthy value
            return cloned;
          }
        } else {
          // customizer is not specified
          // stop at the first parent that contains the property
          return cloned;
        }
      }

      const olderAncester = ancester.parent();
      if (olderAncester) {
        queue.push(olderAncester);
      }
    }

    return undefined;
  }

  /**
   * Converts the current object instance into a JSON-serializable representation.
   *
   * @returns {Record<string, any>} A plain object containing the filtered properties
   * of the current instance, suitable for JSON serialization.
   */
  toJSON() {
    const entriesToExport = Object.entries(this).filter(
      (kv: [string, any]) => typeof kv[1] !== 'function' && kv[1] !== undefined && kv[0] !== '_kind',
    );

    return Object.fromEntries(entriesToExport);
  }

  /**
   * Converts the current instance to a plain JavaScript object.
   * This method internally calls `toJSON()` to perform the conversion.
   *
   * @returns {object} A plain JavaScript object representation of the instance.
   */
  toObject() {
    return this.toJSON();
  }

  /**
   * Converts the current object to a JSON string representation.
   *
   * @returns {string} A JSON string representation of the object.
   */
  toString() {
    return JSON.stringify(this.toJSON());
  }
}

export class Property extends PropertyBase {

  /**
   * A unique identifier represented as a string.
   */
  id: string;
  /**
   * The optional name property.
   * This can be used to specify a name or identifier.
   */
  name?: string;
  /**
   * Indicates whether the property is disabled.
   * When set to `true`, the property is considered inactive or unavailable.
   */
  disabled?: boolean;
  // TODO: parent property will be introduced when collection manipulation is supported

  /**
   * Constructs a new instance of the Property object.
   *
   * @param id - An optional identifier for the property. If not provided, it defaults to an empty string.
   * @param name - An optional name for the property. If not provided, it defaults to an empty string.
   * @param disabled - An optional flag indicating whether the property is disabled. Defaults to `false`.
   * @param info - An optional object containing additional information about the property.
   * @param info.id - An optional identifier within the `info` object. Overrides the `id` parameter if provided.
   * @param info.name - An optional name within the `info` object. Overrides the `name` parameter if provided.
   */
  constructor(id?: string, name?: string, disabled?: boolean, info?: { id?: string; name?: string }) {
    super();
    this._kind = 'Property';
    this.id = info?.id || id || '';
    this.name = info?.name || name || '';
    this.disabled = disabled || false;
  }

  static _index = 'id';

  /**
   * Replaces placeholders in the given content string with values from the provided variables.
   * The placeholders are resolved using an interpolation mechanism, and the variables are merged
   * in reverse order to determine the final context for substitution.
   *
   * @param content - The string containing placeholders to be replaced.
   * @param variables - A list of objects containing key-value pairs for substitution.
   *                    The objects are merged in reverse order to form the final context.
   * @returns The content string with placeholders replaced by corresponding values from the context.
   * @throws {Error} If the `content` parameter is not a string or if `variables` is not an array.
   */
  static replaceSubstitutions(content: string, ...variables: object[]): string {
    if (!Array.isArray(variables) || typeof content !== 'string') {
      throw new Error(
        "replaceSubstitutions: the first param's type is not string or other parameters are not an array",
      );
    }

    let context: object = {};
    // the searching priority of rendering is from left to right
    variables.reverse().forEach(variable => (context = { ...context, ...variable }));

    return getInterpolator().render(content, context);
  }

  /**
   * Replaces substitutions in the given object using the provided variables.
   *
   * This method takes an object and a list of variable objects, and replaces
   * placeholders in the object with corresponding values from the variables.
   * The variables are merged in reverse order, meaning the last variable in
   * the list has the highest priority.
   *
   * @param obj - The object containing placeholders to be replaced.
   * @param variables - A list of objects containing substitution values.
   * @returns A new object with substitutions replaced.
   * @throws {Error} If the first parameter is not an object or if the variables
   *                 are not provided as an array.
   * @throws {Error} If an error occurs during the substitution process.
   */
  static replaceSubstitutionsIn(obj: object, ...variables: object[]): object {
    if (!Array.isArray(variables) || typeof obj !== 'object') {
      throw new Error(
        "replaceSubstitutions: the first param's type is not object or other parameters are not an array",
      );
    }

    try {
      const content = JSON.stringify(obj);

      let context: object = {};
      // the searching priority of rendering is from left to right
      variables.reverse().forEach(variable => {
        context = { ...context, ...variable };
      });

      const rendered = getInterpolator().render(content, context);
      return JSON.parse(rendered);
    } catch (e: any) {
      throw new Error(`replaceSubstitutionsIn: ${e.toString()}`);
    }
  }

  /**
   * Sets the description and type name for the current object.
   *
   * @param content - The description content to be assigned.
   * @param typeName - The type name to categorize the object.
   */
  describe(content: string, typeName: string) {
    this._kind = typeName;
    this.description = content;
  }
}

export class PropertyList<T extends Property> {
  protected _kind = 'PropertyList';
  protected list: T[] = [];

  constructor(
    protected typeClass: { _index?: string },
    protected parent: Property | PropertyList<any> | undefined,
    populate: T[],
  ) {
    this.parent = parent;
    this.list = populate;
  }

  static isPropertyList(obj: object) {
    return '_kind' in obj && obj._kind === 'PropertyList';
  }

  add(item: T) {
    this.list.push(item);
  }

  all() {
    return this.list.map(pp => pp.toJSON());
  }

  append(item: T) {
    this.add(item);
  }

  assimilate(source: T[] | PropertyList<T>, prune?: boolean) {
    // it doesn't update values from a source list
    if (prune) {
      this.clear();
    }
    if ('list' in source) {
      // it is PropertyList<T>
      this.list.push(...source.list);
    } else {
      this.list.push(...source);
    }
  }

  clear() {
    this.list = [];
  }

  count() {
    return this.list.length;
  }

  each(iterator: (item: T) => void, context: object) {
    interface Iterator {
      context?: object;
      (item: T): void;
    }
    const it: Iterator = iterator;
    it.context = context;

    this.list.forEach(it);
  }

  // TODO: unsupported yet as properties are not organized as hierarchy

  eachParent(_iterator: (parent: Property, prev: Property) => void, _context?: object) {
    throw unsupportedError('eachParent');
  }

  filter(rule: (item: T) => boolean, context: object) {
    interface Iterator {
      context?: object;
      (item: T): boolean;
    }
    const it: Iterator = rule;
    it.context = context;

    return this.list.filter(it);
  }

  // TODO: support returning {Item|ItemGroup}
  find(rule: (item: T) => boolean, context?: object) {
    interface Finder {
      context?: object;
      (item: T): boolean;
    }
    const finder: Finder = rule;
    finder.context = context;

    return this.list.find(finder);
  }

  // it does not return underlying type of the item because they are not supported
  get(key: string) {
    return this.one(key);
  }

  // TODO: value is not used as its usage is unknown

  has(item: T, _value?: any) {
    // eslint-disable-next-line unicorn/prefer-includes
    return this.indexOf(item) >= 0;
  }

  idx(index: number) {
    if (index <= this.list.length - 1) {
      return this.list[index];
    }
    return undefined;
  }

  indexOf(item: string | T) {
    const indexFieldName = this.typeClass._index || 'id';

    for (let i = 0; i < this.list.length; i++) {
      const record = this.list[i] as Record<string, any>;

      if (typeof item === 'string' && record[indexFieldName] === item) {
        return i;
      }
      const itemRecord = item as Record<string, any>;
      if (record[indexFieldName] === itemRecord[indexFieldName]) {
        return i;
      }
    }
    return -1;
  }

  insert(item: T, before?: number) {
    if (before != null && before >= 0 && before <= this.list.length - 1) {
      this.list = [...this.list.slice(0, before), item, ...this.list.slice(before)];
    } else {
      this.append(item);
    }
  }

  insertAfter(item: T, after?: number) {
    if (after != null && after >= 0 && after <= this.list.length - 1) {
      this.list = [...this.list.slice(0, after + 1), item, ...this.list.slice(after + 1)];
    } else {
      this.append(item);
    }
  }

  map(iterator: (item: T) => any, context: object) {
    interface Iterator {
      context?: object;
      (item: T): any;
    }
    const it: Iterator = iterator;
    it.context = context;

    return this.list.map(it);
  }

  one(id: string) {
    const indexFieldName = this.typeClass._index || 'id';

    for (let i = this.list.length - 1; i >= 0; i--) {
      const record = this.list[i] as Record<string, any>;
      if (record[indexFieldName] === id) {
        return this.list[i];
      }
    }

    return undefined;
  }

  populate(items: T[]) {
    this.list = [...this.list, ...items];
  }

  prepend(item: T) {
    this.list = [item, ...this.list];
  }

  reduce(iterator: (acc: any, item: T) => any, accumulator: any, context: object) {
    interface Iterator {
      context?: object;
      (acc: any, item: T): any;
    }
    const it: Iterator = iterator;
    it.context = context;

    return this.list.reduce(it, accumulator);
  }

  remove(predicate: T | ((item: T) => boolean), context: object) {
    if (typeof predicate === 'function') {
      const reversePredicate = (item: T) => !predicate(item);
      this.list = this.filter(reversePredicate, context);
    } else {
      this.list = this.filter(item => !equal(predicate, item), context);
    }
  }

  repopulate(items: T[]) {
    this.clear();
    this.populate(items);
  }

  // TODO: unsupported yet

  toObject(_excludeDisabled?: boolean, _caseSensitive?: boolean, _multiValue?: boolean, _sanitizeKeys?: boolean) {
    // it just dump all properties of each element without arguments
    // then user is able to handle them by themself
    return this.list.map(elem => elem.toJSON());
  }

  toString() {
    const itemStrs = this.list.map(item => item.toString());
    return `[${itemStrs.join('; ')}]`;
  }

  upsert(item: T): boolean {
    if (item == null) {
      return false;
    }

    const itemIdx = this.indexOf(item);
    if (itemIdx >= 0) {
      this.list = [...this.list.splice(0, itemIdx), item, ...this.list.splice(itemIdx + 1)];
      return false;
    }

    this.add(item);
    return true;
  }
}
