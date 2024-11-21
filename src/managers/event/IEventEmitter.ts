export interface IEventEmitter {
  on(event: string, listener: (...args: any[]) => void): void;
  emit(event: string, ...args: any[]): void;
  removeListener(event: string, listener: (...args: any[]) => void): void;
  removeAllListeners(): void;
}