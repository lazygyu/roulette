export function bound<T extends Function>(target: any, propertyKey: string, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> {
  return {
    configurable: true,
    get(this: T): T {
      const boundMethod = descriptor.value!.bind(this);
      Object.defineProperty(this, propertyKey, {
        value: boundMethod,
        configurable: true,
        writable: true,
      });
      return boundMethod;
    }
  };
}