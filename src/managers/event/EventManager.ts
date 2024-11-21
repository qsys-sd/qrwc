import { EventEmitter } from "events"
import FrontendEmitter from "./FrontendEvents";

export default class EventManager {
  private emitter: EventEmitter | FrontendEmitter;

  constructor() {
    const isInBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';
    this.emitter = isInBrowser ? new FrontendEmitter() : new EventEmitter();}

  public on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener);
  }

  public handleEvent(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args)
  }

  public removeListener(event: string, listener: (...args: any[]) => void): void {
    this.emitter.removeListener(event, listener);
  }

  public removeAllEventListeners() {
    this.emitter.removeAllListeners()
  }
}
