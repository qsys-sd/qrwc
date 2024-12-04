import { StartManager, WebSocketManager, ControlManager, EventManager, ChangeRequestManager, ComponentManager } from '../src/managers'
import { WebSocket, Server as MockServer } from 'mock-socket'

describe('startManager', () => {
  let startManager: StartManager
  let webSocketManager: WebSocketManager
  let componentManager: ComponentManager
  let controlManager: ControlManager
  let changeRequestManager: ChangeRequestManager
  let mockServer: MockServer
  let mockWebSocket: WebSocket
  const eventManager = new EventManager()

  eventManager.initializeEmitter()

  beforeEach(done => {
    mockServer = new MockServer('ws://localhost:1234')
    mockWebSocket = new WebSocket('ws://localhost:1234')
    mockWebSocket.onopen = () => {
      done()
    }

    webSocketManager = new WebSocketManager(mockWebSocket, eventManager)
    const webSocketSend = webSocketManager.send.bind(webSocketManager)
    changeRequestManager = new ChangeRequestManager(eventManager)
    controlManager = new ControlManager(webSocketSend, eventManager, changeRequestManager)
    componentManager = new ComponentManager(
      eventManager.on.bind(eventManager),
      eventManager.emit.bind(eventManager),
      webSocketSend
    )
    startManager = new StartManager(
      webSocketManager.send.bind(webSocketManager),
      componentManager,
      controlManager,
      eventManager
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
    mockServer.stop()
  })

  test('startManager starts correctly', () => {
    const spy = jest.spyOn(startManager, 'start')
    startManager.start()
    expect(spy).toHaveBeenCalled()
  })

  it('creates start change group', () => {
    const mockCallback = jest.fn()
    const eventName = 'startChangeGroup'

    eventManager.on(eventName, mockCallback)
    eventManager.emit(eventName, { key: 'value' })

    expect(mockCallback).toHaveBeenCalledWith({ key: 'value' })
  })

  test('startManager cleans up correctly', () => {
    const spy = jest.spyOn(startManager, 'cleanUp')
    startManager.cleanUp()
    expect(spy).toHaveBeenCalled()
    expect(startManager['changeGroupManager']).toBeNull()
    expect(startManager['controlManager']).toBeNull()
    expect(startManager['eventManager']).toBeNull()
  })
})
