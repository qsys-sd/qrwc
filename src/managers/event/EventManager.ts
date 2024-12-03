import { IEventEmitter } from '../../index.interface'
import FrontendEventEmitter from './FrontendEvents'

const isInBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined'

export default class EventManager {
  private emitter: IEventEmitter

  public async initializeEmitter() {
    if (isInBrowser) {
      // In a browser environment, use the FrontendEventEmitter
      this.emitter = new FrontendEventEmitter()
    } else {
      // In a Node.js environment, dynamically import the 'events' module
      const { EventEmitter } = await import('events')
      // Create an instance of EventEmitter
      this.emitter = new EventEmitter() as IEventEmitter
    }
  }

  public on(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.on(event, listener)
  }

  public emit(event: string, ...args: unknown[]): void {
    this.emitter.emit(event, ...args)
  }

  public removeListener(event: string, listener: (...args: unknown[]) => void): void {
    this.emitter.removeListener(event, listener)
  }

  public removeAllEventListeners(): void {
    this.emitter.removeAllListeners()
  }
}
