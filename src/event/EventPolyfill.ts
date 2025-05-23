import type { IEventEmitter } from '../index.interface.js'

export class EventEmitterPolyfill<T> implements IEventEmitter<T> {
  private eventTarget: EventTarget
  /* eslint-disable no-undef */
  private listeners: Map<T[keyof T], EventListenerOrEventListenerObject>

  constructor() {
    this.eventTarget = new EventTarget()
    this.listeners = new Map()
  }

  public on<U extends keyof T>(
    event: U,
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    listener: T[U] extends (...args: any[]) => void ? T[U] : never
  ): void {
    const wrappedListener = (e: Event) => {
      listener(...(e as CustomEvent).detail)
    }
    this.listeners.set(listener, wrappedListener)
    this.eventTarget.addEventListener(event as string, wrappedListener)
  }

  public emit<U extends keyof T>(
    event: U,
    /* eslint-disable  @typescript-eslint/no-explicit-any */
    ...args: T[U] extends (...args: any[]) => void ? Parameters<T[U]> : never
  ): void {
    const eventToDispatch = new CustomEvent(event as string, { detail: args })
    this.eventTarget.dispatchEvent(eventToDispatch)
  }

  public removeListener<U extends keyof T>(event: U, listener: T[U]): void {
    const wrappedListener = this.listeners.get(listener)
    if (wrappedListener) {
      this.eventTarget.removeEventListener(event as string, wrappedListener)
      this.listeners.delete(listener)
    }
  }

  public removeAllListeners(): void {
    this.eventTarget = new EventTarget()
    this.listeners.clear()
  }
}
