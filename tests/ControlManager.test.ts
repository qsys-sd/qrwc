import ControlManager from '../src/managers/control/ControlManager'
import { ControlDecorator } from '../src/managers/control/ControlDecorator'
import { IControl } from '../src/index.interface'
import EventManager from '../src/managers/event/EventManager'
import RequestManager from '../src/managers/qsys/RequestManager'
import WebSocketManager from '../src/managers/webSocket/WebSocketManager'
import { WebSocket, Server as MockWebSocketServer } from 'mock-socket'

jest.mock('../src/managers/event/EventManager')
jest.mock('../src/managers/qsys/RequestManager')
jest.mock('../src/managers/webSocket/WebSocketManager')

describe('ControlManager', () => {
  let controlManager: ControlManager
  let mockEventManager: EventManager
  let mockRequestManager: RequestManager
  let mockWebSocketManager: WebSocketManager
  let mockSocket: WebSocket
  let mockServer: MockWebSocketServer

  beforeEach(() => {
    mockEventManager = new EventManager()
    // Create a mock WebSocket server
    mockServer = new MockWebSocketServer('ws://localhost:8080')
    // Use the WebSocket from mock-socket to connect to the mock server
    mockSocket = new WebSocket('ws://localhost:8080')
    mockRequestManager = new RequestManager(mockEventManager)
    mockWebSocketManager = new WebSocketManager(mockSocket, mockEventManager)

    controlManager = new ControlManager(mockEventManager, mockRequestManager)
    controlManager.setWebSocketManager(mockWebSocketManager)
  })

  afterEach(() => {
    // Ensure the mock server is closed after tests to prevent open handles
    mockServer.close()
  })

  it('should add a new control', () => {
    const mockControl: IControl = {
      Name: 'TestControl',
      Component: 'TestComponent',
      Position: 1,
      Value: 'TestValue',
      String: 'TestString'
    }
    const newControl = new ControlDecorator(mockControl, jest.fn(), jest.fn())

    // Use type assertion to access private method
    const controlManagerWithPrivateMethods = controlManager as unknown as { updateControls: (control: ControlDecorator) => void }
    controlManagerWithPrivateMethods.updateControls(newControl)

    const retrievedControl = controlManager.getControl('TestComponent', 'TestControl')
    expect(retrievedControl).toBeDefined()
    expect(retrievedControl).toBeInstanceOf(ControlDecorator)
    expect(retrievedControl).toEqual(newControl)
  })

  it('should return undefined for a non-existent control', () => {
    const control = controlManager.getControl('NonExistentComponent', 'NonExistentControl')
    expect(control).toBeUndefined()
  })
})
