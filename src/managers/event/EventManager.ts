import { IEventEmitter } from './IEventEmitter';
import FrontendEventEmitter from './FrontendEvents';

const isInBrowser = typeof window !== 'undefined' && typeof window.document !== 'undefined';

let EmitterClass: { new (): IEventEmitter };
if (isInBrowser) {
  EmitterClass = FrontendEventEmitter;
} else {
  EmitterClass = require('events').EventEmitter;
}

export default class EventManager {
  private emitter: IEventEmitter;

  constructor() {
    this.emitter = new EmitterClass();
  }

  public on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener);
  }

  public emit(event: string, ...args: any[]): void {
    this.emitter.emit(event, ...args);
  }

  public removeListener(event: string, listener: (...args: any[]) => void): void {
    this.emitter.removeListener(event, listener);
  }

  public removeAllEventListeners(): void {
    this.emitter.removeAllListeners();
  }
}
