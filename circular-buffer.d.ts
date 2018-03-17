/**
 * Mnemonist CircularBuffer Typings
 * =================================
 */
export default class CircularBuffer<T> implements Iterable<T> {

  // Members
  capacity: number;
  size: number;

  // Constructor
  constructor(ArrayClass: any, capacity: number);

  // Methods
  clear(): void;
  push(item: T): number;
  pop(): T | undefined;
  unshift(): T | undefined;
  peekFirst(): T | undefined;
  peekLast(): T | undefined;
  get(index: number): T | undefined;
  forEach(callback: (item: T, index: number, buffer: this) => void, scope?: any): void;
  toArray(): Iterable<T>;
  values(): Iterator<T>;
  entries(): Iterator<[number, T]>;
  [Symbol.iterator](): Iterator<T>;
  inspect(): any;

  // Statics
  static from<I>(iterable: Iterable<I> | {[key: string] : I}, ArrayClass: any, capacity?: number): CircularBuffer<I>;
}