import type { IEventEmitter } from '../index.interface'
import FrontendEventEmitter from './FrontendEvents'

export default class EventEmitter<T> implements IEventEmitter<T> {
  private emitter: IEventEmitter<T>

  constructor() {
    this.emitter = new FrontendEventEmitter() as IEventEmitter<T>
  }

  public on<U extends keyof T>(event: U, listener: T[U]): void {
    this.emitter.on(event, listener)
  }

  public emit<U extends keyof T>(
    event: U,
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    ...args: T[U] extends (...args: any[]) => void ? Parameters<T[U]> : never
  ): void {
    this.emitter.emit(event, ...args)
  }

  public removeListener<U extends keyof T>(event: U, listener: T[U]): void {
    this.emitter.removeListener(event, listener)
  }

  public removeAllListeners(): void {
    this.emitter.removeAllListeners()
  }
}
