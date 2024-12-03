import { AutoStartManager, WebSocketManager, ControlManager, EventManager } from '../src/managers'
import { RequestManager } from '../src/managers'
import { WebSocket, Server as MockServer } from 'mock-socket'

describe('AutoStartManager', () => {
  let autoStartManager: AutoStartManager
  let webSocketManager: WebSocketManager
  let controlManager: ControlManager
  let requestManager: RequestManager
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
    requestManager = new RequestManager(eventManager)
    controlManager = new ControlManager(eventManager, requestManager)
    autoStartManager = new AutoStartManager(
      webSocketManager.send.bind(webSocketManager),
      controlManager,
      eventManager,
      controlManager.getComponentNames.bind(controlManager)
    )
  })

  afterEach(() => {
    jest.clearAllMocks()
    mockServer.stop()
  })

  test('AutoStartManager starts correctly', () => {
    const spy = jest.spyOn(autoStartManager, 'start')
    autoStartManager.start()
    expect(spy).toHaveBeenCalled()
  })

  it('creates auto start change group', () => {
    const mockCallback = jest.fn()
    const eventName = 'autoStartChangeGroup'

    eventManager.on(eventName, mockCallback)
    eventManager.emit(eventName, { key: 'value' })

    expect(mockCallback).toHaveBeenCalledWith({ key: 'value' })
  })

  test('AutoStartManager cleans up correctly', () => {
    const spy = jest.spyOn(autoStartManager, 'cleanUp')
    autoStartManager.cleanUp()
    expect(spy).toHaveBeenCalled()
    expect(autoStartManager['changeGroupService']).toBeNull()
    expect(autoStartManager['controlManager']).toBeNull()
    expect(autoStartManager['eventManager']).toBeNull()
  })
})
