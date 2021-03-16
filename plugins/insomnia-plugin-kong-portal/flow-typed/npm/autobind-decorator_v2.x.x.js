// flow-typed signature: cc80f72141d0475941ae738adbd17323
// flow-typed version: c6154227d1/autobind-decorator_v2.x.x/flow_>=v0.104.x

declare module 'autobind-decorator' {
    declare export interface TypedPropertyDescriptor<T> {
      enumerable?: boolean;
      configurable?: boolean;
      writable?: boolean;
      value?: T;
      get?: () => T;
      set?: (value: T) => void;
    }

    declare export type ConstructorFunction = () => void;
    declare export type ClassDecorator = <T: Class<{...}> | ConstructorFunction>(target: T) => T;
    declare export type MethodDecorator = <T>(target: {...}, propertyKey: string | Symbol, descriptor: TypedPropertyDescriptor<T>) => TypedPropertyDescriptor<T>;

    declare var autobind: ClassDecorator & MethodDecorator;

    declare export var boundMethod: MethodDecorator;
    declare export var boundClass: ClassDecorator;

    declare export default typeof autobind;
}
