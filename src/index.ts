export default class Qrc {
  #ip = location.hostname
  #socket: WebSocket | null
  controls: {}
  constructor(ip: string) {
    this.#ip = ip
    this.#socket = null
    this.controls = null
  }

  check() {
    console.log('In QRC')
  }

  connect() {
    this.#socket = new WebSocket(`ws://${this.#ip}/qrc`)
    this.#socket.onopen = this.handleOpen
  }

  close(code?: number, reason?: string) {
    this.#socket.close(code, reason)
  }

  handleOpen() {
    console.log(`socket opened @ ${this.#socket.url}`)
  }
}