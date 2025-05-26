import { unsupportedError } from './properties';
import { Property, PropertyList } from './properties';

/**
 * Represents the definition of a variable for initializing the {@link Variable} class.
 *
 * @property id - (Optional) A unique identifier for the variable.
 * @property key - The key or identifier for the variable, used for referencing it.
 * @property name - (Optional) A human-readable name for the variable.
 * @property value - The value assigned to the variable.
 * @property type - (Optional) The type of the variable, which can be used for categorization or validation.
 * @property disabled - (Optional) A flag indicating whether the variable is disabled.
 */
export interface VariableDefinition {
  id?: string;
  key: string;
  name?: string;
  value: string;
  type?: string;
  disabled?: boolean;
}

/**
 * Represents a variable with a unique identifier, value, and type.
 * This class extends the `Property` class and provides methods to
 * get and set the variable's value, as well as a utility to cast
 * a value to its underlying value if it is a `Variable` object.
 *
 * @extends Property
 */
export class Variable extends Property {
  /**
   * Represents the unique identifier for a variable.
   */
  key: string;
  /**
   * Represents the value of a variable, which can be of any type.
   */
  value: any;
  /**
   * The type of the variable, represented as a string.
   */
  type: string;

  /** @ignore */
  override _kind = 'Variable';

  /**
   * Constructs a new instance of the class with the provided variable definition.
   *
   * @param def - An optional object containing the variable definition. If provided,
   *              it initializes the instance properties with the values from the object.
   *              If not provided, default values are used.
   */
  constructor(def?: VariableDefinition) {
    super();

    this.id = def ? def.id || '' : '';
    this.key = def ? def.key : '';
    this.name = def ? def.name : '';
    this.value = def ? def.value : '';
    this.type = def && def.type ? def.type : 'Variable';
    this.disabled = def ? def.disabled : false;
  }

  /** @ignore */
  static override _index = 'key';

  // unknown usage and unsupported
  /** @ignore */
  static types() {
    throw unsupportedError('types');
  }

  /**
   * This method casts the provided value to its underlying value if it is a Variable object.
   *
   * @param value - The value to be cast. It can be of any type.
   * @returns The underlying value of the Variable object if the input is a Variable; otherwise, returns `undefined`.
   */
  cast(value: any) {
    if ('_kind' in value && value._kind === 'Variable') {
      return value.value;
    }
    return undefined;
  }

  /**
   * Retrieves the current value of the variable.
   *
   * @returns The value of the variable.
   */
  get() {
    return this.value;
  }

  /**
   * Sets the value of the variable.
   *
   * @param value - The new value to assign to the variable.
   */
  set(value: any) {
    this.value = value;
  }
}

/**
 * A specialized list for managing variables, extending the `PropertyList` class.
 *
 * @template T - The type of variable that extends the `Variable` base class.
 *
 * @extends PropertyList<T>
 */
export class VariableList<T extends Variable> extends PropertyList<T> {
  /** @ignore */
  override _kind = 'VariableList';

  /**
   * Constructs a new instance of the class.
   *
   * @param parent - The parent `PropertyList` instance, or `undefined` if there is no parent.
   * @param populate - An array of items of type {@link Variable} used to populate the list.
   */
  constructor(parent: PropertyList<T> | undefined, populate: T[]) {
    super(Variable, undefined, populate);
    this.parent = parent;
  }

  /**
   * Determines if the given object is a VariableList.
   *
   * @param obj - The object to check.
   * @returns A boolean indicating whether the object is a VariableList.
   */
  static isVariableList(obj: any) {
    return '_kind' in obj && obj._kind === 'VariableList';
  }
}
