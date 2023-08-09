export interface IQrccOptions {
  url: string
  pollInterval?: number
}

export interface IQrcc {
  getReadyState(): number | string
  send(data: object): void
  connect(): void
  close(code?: number, reason?: string): void
}
