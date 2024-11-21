class FrontendEventEmitter {
  private eventTarget: EventTarget;

  constructor() {
    this.eventTarget = new EventTarget();
  }

  public on(event: string, listener: (...args: any[]) => void): void {
    this.eventTarget.addEventListener(event, (e: Event) => {
      listener(...(e as CustomEvent).detail);
    });
  }

  public emit(event: string, ...args: any[]): void {
    const eventToDispatch = new CustomEvent(event, { detail: args });
    this.eventTarget.dispatchEvent(eventToDispatch);
  }

  public removeListener(event: string, listener: (...args: any[]) => void): void {
    this.eventTarget.removeEventListener(event, listener);
  }

  public removeAllListeners() {
    // remove all events
    this.eventTarget = new EventTarget();
  }
}

export default FrontendEventEmitter;