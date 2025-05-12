import type { IEventEmitter } from '../index.interface'
import FrontendEventEmitter from './FrontendEvents'
import { EventEmitter as BackendEventEmitter } from 'events'

const isInBrowser =
  typeof window !== 'undefined' && typeof window.document !== 'undefined'

export class EventEmitter<T> implements IEventEmitter<T> {
  private emitter: IEventEmitter<T>

  constructor() {
    if (isInBrowser) {
      // In a browser environment, use the FrontendEventEmitter (fallback for when browser hint didn't work)
      this.emitter = new FrontendEventEmitter()
    } else {
      // In a Node.js environment, dynamically import the 'events' module
      // Create an instance of EventEmitter
      this.emitter = new BackendEventEmitter() as IEventEmitter<T>
    }
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
