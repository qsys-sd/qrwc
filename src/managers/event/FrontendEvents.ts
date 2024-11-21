class FrontendEventEmitter {
  private eventTarget: EventTarget;
  private listeners: Map<(...args: any[]) => void, EventListenerOrEventListenerObject>;

  constructor() {
    this.eventTarget = new EventTarget();
    this.listeners = new Map();
  }

  public on(event: string, listener: (...args: any[]) => void): void {
    const wrappedListener = (e: Event) => {
      listener(...(e as CustomEvent).detail);
    };
    this.listeners.set(listener, wrappedListener);
    this.eventTarget.addEventListener(event, wrappedListener);
  }

  public emit(event: string, ...args: any[]): void {
    const eventToDispatch = new CustomEvent(event, { detail: args });
    this.eventTarget.dispatchEvent(eventToDispatch);
  }

  public removeListener(event: string, listener: (...args: any[]) => void): void {
    const wrappedListener = this.listeners.get(listener);
    if (wrappedListener) {
      this.eventTarget.removeEventListener(event, wrappedListener);
      this.listeners.delete(listener);
    }
  }

  public removeAllListeners(): void {
    this.eventTarget = new EventTarget();
    this.listeners.clear();
  }
}

export default FrontendEventEmitter;