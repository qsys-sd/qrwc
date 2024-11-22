export interface IEventEmitter {
  on(event: string, listener: (...args: unknown[]) => void): void;
  emit(event: string, ...args: unknown[]): void;
  removeListener(event: string, listener: (...args: unknown[]) => void): void;
  removeAllListeners(): void;
}