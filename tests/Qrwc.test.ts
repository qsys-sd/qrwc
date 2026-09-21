import { Qrwc } from '../src/entities/Qrwc'
import { WebSocket, Server } from 'mock-socket'
import {
  IComponentGetComponentsResult,
  IStartOptions
} from '../src/index.interface'
import { ConnectionInitializationError } from '../src/connection/WebSocketConnection'
import { jest } from '@jest/globals'

// QRC pushes an unsolicited EngineStatus message on connect; readiness now gates
// on it, so every mock core must send one when a client connects.
const MOCK_ENGINE_STATUS = {
  State: 'Active' as const,
  DesignName: 'test design',
  DesignCode: '1234567890',
  IsRedundant: false,
  IsEmulator: false
}

const pushEngineStatus = (
  socket: { send: (data: string) => void },
  params: object = MOCK_ENGINE_STATUS
) =>
  socket.send(
    JSON.stringify({
      jsonrpc: '2.0',
      method: 'EngineStatus',
      params
    })
  )

describe('Qrwc', () => {
  let mockServer: Server
  let mockSocket: WebSocket
  let qrwc: Qrwc

  // Mock component data that would be returned from the core
  const mockComponents: IComponentGetComponentsResult[] = [
    {
      ID: 'component-1',
      Name: 'TestComponent1',
      Type: 'custom_controls',
      Properties: [],
      Controls: null,
      ControlSource: 2
    },
    {
      ID: 'component-2',
      Name: 'TestComponent2',
      Type: 'custom_controls',
      Properties: [],
      Controls: null,
      ControlSource: 2
    }
  ]

  // Mock control data for Component.GetControls responses
  const mockControls = {
    TestComponent1: {
      Name: 'TestComponent1',
      Controls: [
        {
          Name: 'control1',
          Type: 'Text',
          String: 'Test Value 1',
          Direction: 'Read/Write',
          Position: 0,
          Value: 0
        }
      ]
    },
    TestComponent2: {
      Name: 'TestComponent2',
      Controls: [
        {
          Name: 'control2',
          Type: 'Boolean',
          String: 'false',
          Direction: 'Read/Write',
          Position: 0,
          Value: 0
        }
      ]
    }
  }

  beforeEach(() => {
    // Set up mock server
    mockServer = new Server('ws://localhost:8080')
    global.WebSocket = WebSocket // Replace global WebSocket with mock

    // Set up server to respond to RPC requests
    mockServer.on('connection', (socket) => {
      pushEngineStatus(socket)
      socket.on('message', (message) => {
        const data = JSON.parse(message as string)

        // Handle Component.GetComponents
        if (data.method === 'Component.GetComponents') {
          socket.send(
            JSON.stringify({
              id: data.id,
              result: mockComponents
            })
          )
        }

        // Handle Component.GetControls
        if (data.method === 'Component.GetControls') {
          const componentName = data.params.Name as keyof typeof mockControls
          socket.send(
            JSON.stringify({
              id: data.id,
              result: mockControls[componentName]!
            })
          )
        }

        // Handle ChangeGroup.AddComponentControl
        if (data.method === 'ChangeGroup.AddComponentControl') {
          socket.send(
            JSON.stringify({
              id: data.id,
              result: {
                Id: data.params.Id,
                Controls: data.params.Component.Controls.map((c: any) => c.Name)
              }
            })
          )
        }

        // Handle ChangeGroup.Poll
        if (data.method === 'ChangeGroup.Poll') {
          socket.send(
            JSON.stringify({
              id: data.id,
              result: {
                Id: data.params.Id,
                Changes: []
              }
            })
          )
        }
      })
    })

    // Create a new WebSocket that connects to our mock server
    mockSocket = new WebSocket('ws://localhost:8080')
  })

  afterEach(async () => {
    // Close and clean up after each test
    if (qrwc) {
      qrwc.close()
    }
    mockServer.stop()
  })

  it('should create a Qrwc instance with correct components', async () => {
    // Create a new Qrwc instance with our mock socket
    const options: IStartOptions = {
      socket: mockSocket,
      apiKey: 'test-api-key',
      pollingInterval: 100
    }

    qrwc = await Qrwc.createQrwc(options)

    // Verify components were properly loaded
    expect(Object.keys(qrwc.components)).toHaveLength(2)
    expect(qrwc.components.TestComponent1).toBeDefined()
    expect(qrwc.components.TestComponent2).toBeDefined()

    // Verify component properties
    expect(qrwc.components.TestComponent1?.name).toBe('TestComponent1')
    expect(qrwc.components.TestComponent2?.name).toBe('TestComponent2')

    // Verify controls were properly loaded
    expect(qrwc.components.TestComponent1?.controls.control1).toBeDefined()
    expect(qrwc.components.TestComponent2?.controls.control2).toBeDefined()

    // Verify control properties
    expect(qrwc.components.TestComponent1?.controls.control1!.name).toBe(
      'control1'
    )
    expect(qrwc.components.TestComponent2?.controls.control2!.name).toBe(
      'control2'
    )
  })

  it('should filter components based on componentFilter option', async () => {
    // Create Qrwc with a filter that only includes TestComponent1
    const options: IStartOptions = {
      socket: mockSocket,
      apiKey: 'test-api-key',
      pollingInterval: 100,
      componentFilter: (component) => component.Name === 'TestComponent1'
    }

    qrwc = await Qrwc.createQrwc(options)

    // Verify only the filtered component was loaded
    expect(Object.keys(qrwc.components)).toHaveLength(1)
    expect(qrwc.components.TestComponent1).toBeDefined()
    expect(qrwc.components.TestComponent2).toBeUndefined()
  })

  it('should emit error events when errors occur', async () => {
    // Create a Qrwc instance
    const options: IStartOptions = {
      socket: mockSocket,
      apiKey: 'test-api-key',
      pollingInterval: 100
    }

    qrwc = await Qrwc.createQrwc(options)

    // Set up a mock error listener
    const errorListener = jest.fn<(event: Error) => void>()
    qrwc.on('error', errorListener)

    // Simulate an error surfaced by the QrcClient
    qrwc['qrcClient'].emit('error', new Error('Test error'))

    // Verify the error event was emitted with the correct error
    expect(errorListener).toHaveBeenCalledWith(expect.any(Error))
    expect(errorListener.mock.calls[0][0].message).toBe('Test error')
  })

  it('should emit disconnected event when WebSocket is closed', async () => {
    // Create a Qrwc instance
    const options: IStartOptions = {
      socket: mockSocket,
      apiKey: 'test-api-key',
      pollingInterval: 100
    }

    qrwc = await Qrwc.createQrwc(options)

    // Set up a mock disconnected listener
    const disconnectedListener = jest.fn()
    qrwc.on('disconnected', disconnectedListener)

    // Simulate WebSocket close
    qrwc['qrcClient'].emit('disconnected', 'Connection closed')

    // Verify the disconnected event was emitted
    expect(disconnectedListener).toHaveBeenCalledWith('Connection closed')
  })

  it('should clean up properly when close is called', async () => {
    // Create a Qrwc instance
    const options: IStartOptions = {
      socket: mockSocket,
      apiKey: 'test-api-key',
      pollingInterval: 100
    }

    qrwc = await Qrwc.createQrwc(options)

    // Set up spies
    jest.spyOn(qrwc['changeGroup'], 'stopPolling')
    jest.spyOn(qrwc['changeGroup'], 'close')
    jest.spyOn(qrwc['qrcClient'], 'close')
    jest.spyOn(qrwc, 'removeAllListeners')

    // Mock component close methods
    const component1 = qrwc.components.TestComponent1!
    const component2 = qrwc.components.TestComponent2!
    jest.spyOn(component1, 'close')
    jest.spyOn(component2, 'close')

    // Call close
    qrwc.close()

    // Verify everything was cleaned up
    expect(qrwc['changeGroup'].stopPolling).toHaveBeenCalled()
    expect(qrwc['changeGroup'].close).toHaveBeenCalled()
    expect(qrwc['qrcClient'].close).toHaveBeenCalled()
    expect(qrwc.removeAllListeners).toHaveBeenCalled()
    expect(component1.close).toHaveBeenCalled()
    expect(component2.close).toHaveBeenCalled()
    expect(Object.keys(qrwc['_components'])).toHaveLength(0)
  })

  it('should gracefully handle connecting to a design with no components', async () => {
    // Create a new server that returns an empty components array
    const emptyComponentsServer = new Server('ws://localhost:8081')

    emptyComponentsServer.on('connection', (socket) => {
      pushEngineStatus(socket)
      socket.on('message', (message) => {
        const data = JSON.parse(message as string)

        // Handle Component.GetComponents with empty array response
        if (data.method === 'Component.GetComponents') {
          socket.send(
            JSON.stringify({
              id: data.id,
              result: [] // Empty array - no components
            })
          )
        }

        // Handle ChangeGroup.Poll
        if (data.method === 'ChangeGroup.Poll') {
          socket.send(
            JSON.stringify({
              id: data.id,
              result: {
                Id: data.params.Id,
                Changes: []
              }
            })
          )
        }
      })
    })

    // Create a new WebSocket that connects to our empty server
    const emptySocket = new WebSocket('ws://localhost:8081')

    try {
      // Create Qrwc instance with the empty socket
      const emptyQrwc = await Qrwc.createQrwc({
        socket: emptySocket,
        apiKey: 'test-api-key',
        pollingInterval: 100
      })

      // Verify components object exists but is empty
      expect(emptyQrwc.components).toBeDefined()
      expect(Object.keys(emptyQrwc.components)).toHaveLength(0)

      // Clean up
      emptyQrwc.close()
    } finally {
      emptyComponentsServer.stop()
    }
  })

  it('Websocket connection fail should throw an informative error', async () => {
    // Create a WebSocket that won't connect
    const failingSocket = new WebSocket('ws://non-existent-server:9999')

    // Expect QRWC creation to reject with a connection-initialization error
    await expect(
      Qrwc.createQrwc({
        socket: failingSocket,
        apiKey: 'test-api-key',
        pollingInterval: 100,
        timeout: 100
      })
    ).rejects.toBeInstanceOf(ConnectionInitializationError)

    // Clean up
    failingSocket.close()
  }, 200)

  it('QRWC should log with the dependency injected logger', async () => {
    // Create a mock logger
    const mockLogger = {
      trace: jest.fn(),
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    }

    // Spy on console methods to ensure they're not being used
    const consoleLogSpy = jest
      .spyOn(console, 'log')
      .mockImplementation(() => {})
    const consoleInfoSpy = jest
      .spyOn(console, 'info')
      .mockImplementation(() => {})
    const consoleDebugSpy = jest
      .spyOn(console, 'debug')
      .mockImplementation(() => {})
    const consoleErrorSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {})

    try {
      // Create a Qrwc instance with the mock logger
      const options: IStartOptions = {
        socket: mockSocket,
        apiKey: 'test-api-key',
        pollingInterval: 100,
        logger: mockLogger
      }

      qrwc = await Qrwc.createQrwc(options)

      // Verify that the logger was called
      expect(mockLogger.info).toHaveBeenCalled()
      expect(mockLogger.debug).toHaveBeenCalled()
      expect(mockLogger.trace).toHaveBeenCalled()

      // Test that the logger is used during cleanup
      qrwc.close()

      // Verify that console.log and console.info were NOT used
      expect(consoleLogSpy).not.toHaveBeenCalled()
      expect(consoleInfoSpy).not.toHaveBeenCalled()
      expect(consoleDebugSpy).not.toHaveBeenCalled()
      expect(consoleErrorSpy).not.toHaveBeenCalled()
    } finally {
      // Restore console methods
      consoleLogSpy.mockRestore()
      consoleInfoSpy.mockRestore()
      consoleDebugSpy.mockRestore()
      consoleErrorSpy.mockRestore()
    }
  })

  it('should expose engine status in qrc property', async () => {
    const options: IStartOptions = {
      socket: mockSocket,
      apiKey: 'test-api-key',
      pollingInterval: 100
    }

    qrwc = await Qrwc.createQrwc(options)

    expect(qrwc.engineStatus?.State).toBe('Active')
    expect(qrwc.engineStatus?.DesignName).toBe('test design')
    expect(qrwc.engineStatus?.DesignCode).toBe('1234567890')
    expect(qrwc.engineStatus?.IsRedundant).toBe(false)
    expect(qrwc.engineStatus?.IsEmulator).toBe(false)
  })
})

// Managed mode connects to wss://<host>/qrc-public-api/v0.
const MANAGED_HOST = 'localhost'
const MANAGED_URL = 'wss://localhost/qrc-public-api/v0'

const managedComponents = [
  {
    ID: 'c1',
    Name: 'Gain1',
    Type: 'gain',
    Properties: [],
    Controls: null,
    ControlSource: 2
  }
]

const controlsByComponent: Record<string, any> = {
  Gain1: {
    Name: 'Gain1',
    Controls: [
      {
        Name: 'gain',
        Type: 'Float',
        String: '0',
        Direction: 'Read/Write',
        Position: 0,
        Value: 0
      }
    ]
  }
}

// Wire a mock Q-SYS core onto a server; onAddControl observes re-registration.
const wireCore = (server: Server, onAddControl?: (params: any) => void) => {
  server.on('connection', (socket) => {
    pushEngineStatus(socket)
    socket.on('message', (raw) => {
      const request = JSON.parse(raw as string)
      const reply = (result: unknown) =>
        socket.send(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }))
      switch (request.method) {
        case 'Component.GetComponents':
          reply(managedComponents)
          break
        case 'Component.GetControls':
          reply(controlsByComponent[request.params.Name])
          break
        case 'ChangeGroup.AddComponentControl':
          onAddControl?.(request.params)
          reply({
            Id: request.params.Id,
            Controls: request.params.Component.Controls.map((c: any) => c.Name)
          })
          break
        case 'ChangeGroup.Poll':
          reply({ Id: request.params.Id, Changes: [] })
          break
      }
    })
  })
}

describe('Qrwc (managed mode)', () => {
  let servers: Server[]

  beforeEach(() => {
    servers = []
    ;(global as any).WebSocket = WebSocket
  })

  afterEach(() => {
    servers.forEach((server) => {
      try {
        server.stop()
      } catch {
        /* already stopped */
      }
    })
  })

  const startServer = (): Server => {
    const server = new Server(MANAGED_URL)
    servers.push(server)
    return server
  }

  it('connects with { host, apiKey } and loads the design', async () => {
    wireCore(startServer())

    const qrwc = await Qrwc.createQrwc({
      host: MANAGED_HOST,
      apiKey: 'test-api-key',
      pollingInterval: 100,
      reconnect: { delay: 20, maxDelay: 20 }
    })

    expect(qrwc.engineStatus.DesignName).toBe('test design')
    expect(qrwc.components.Gain1).toBeDefined()
    expect(qrwc.components.Gain1!.controls.gain).toBeDefined()
    qrwc.close()
  })

  it('waits for EngineStatus before sending RPCs (QRC readiness quirk)', async () => {
    // Simulate a quirk with QRC: the Core Manager proxy accepts the socket before the
    // core can serve requests. A not-ready core just drops the connection.
    let coreReady = false
    const earlyRpcs: string[] = []
    const server = startServer()
    server.on('connection', (socket) => {
      socket.on('message', (raw) => {
        const request = JSON.parse(raw as string)
        if (!coreReady) {
          earlyRpcs.push(request.method)
          socket.close()
          return
        }
        const reply = (result: unknown) =>
          socket.send(
            JSON.stringify({ jsonrpc: '2.0', id: request.id, result })
          )
        switch (request.method) {
          case 'Component.GetComponents':
            reply(managedComponents)
            break
          case 'Component.GetControls':
            reply(controlsByComponent[request.params.Name])
            break
          case 'ChangeGroup.AddComponentControl':
            reply({
              Id: request.params.Id,
              Controls: request.params.Component.Controls.map(
                (c: any) => c.Name
              )
            })
            break
          case 'ChangeGroup.Poll':
            reply({ Id: request.params.Id, Changes: [] })
            break
        }
      })
      // The core becomes ready shortly after the proxy accepts the socket.
      setTimeout(() => {
        coreReady = true
        pushEngineStatus(socket)
      }, 50)
    })

    const qrwc = await Qrwc.createQrwc({
      host: MANAGED_HOST,
      apiKey: 'test-api-key',
      pollingInterval: 100,
      reconnect: { delay: 20, maxDelay: 20 }
    })

    // Nothing threw, and QRWC sent no RPC until the core was ready.
    expect(earlyRpcs).toHaveLength(0)
    expect(qrwc.engineStatus.State).toBe('Active')
    expect(qrwc.components.Gain1).toBeDefined()
    qrwc.close()
  })

  it('re-registers controls and emits reconnected after a drop', async () => {
    const addControlCalls: any[] = []
    const server = startServer()
    wireCore(server, (params) => addControlCalls.push(params))

    const qrwc = await Qrwc.createQrwc({
      host: MANAGED_HOST,
      apiKey: 'test-api-key',
      pollingInterval: 100,
      reconnect: { delay: 20, maxDelay: 20, backoffFactor: 1, maxAttempts: 20 }
    })

    const registrationsAtStartup = addControlCalls.length
    expect(registrationsAtStartup).toBeGreaterThanOrEqual(1)

    const reconnected = new Promise<void>((resolve) =>
      qrwc.on('reconnected', () => resolve())
    )
    server.close()
    const server2 = startServer()
    wireCore(server2, (params) => addControlCalls.push(params))

    await reconnected

    // the control was re-added to the core's fresh session
    expect(addControlCalls.length).toBeGreaterThan(registrationsAtStartup)
    qrwc.close()
  })

  it('auto-updates engineStatus and emits when the core pushes a change', async () => {
    let coreSocket: { send: (data: string) => void }
    const server = startServer()
    wireCore(server)
    server.on('connection', (socket) => {
      coreSocket = socket
    })

    const qrwc = await Qrwc.createQrwc({
      host: MANAGED_HOST,
      apiKey: 'test-api-key',
      pollingInterval: 100,
      reconnect: { delay: 20, maxDelay: 20 }
    })
    expect(qrwc.engineStatus.State).toBe('Active')

    const changed = new Promise((resolve) => qrwc.on('engineStatus', resolve))
    pushEngineStatus(coreSocket!, { ...MOCK_ENGINE_STATUS, State: 'Standby' })

    await expect(changed).resolves.toMatchObject({ State: 'Standby' })
    expect(qrwc.engineStatus.State).toBe('Standby')
    qrwc.close()
  })

  it('reports engineStatus Disconnected while the connection is down', async () => {
    const server = startServer()
    wireCore(server)

    const qrwc = await Qrwc.createQrwc({
      host: MANAGED_HOST,
      apiKey: 'test-api-key',
      pollingInterval: 100,
      reconnect: {
        delay: 500,
        maxDelay: 500,
        backoffFactor: 1,
        maxAttempts: 20
      }
    })
    expect(qrwc.engineStatus.State).toBe('Active')

    const disconnectedStatus = new Promise((resolve) =>
      qrwc.on('engineStatus', resolve)
    )
    server.close()

    await expect(disconnectedStatus).resolves.toEqual({ State: 'Disconnected' })
    expect(qrwc.engineStatus.State).toBe('Disconnected')
    qrwc.close()
  })
})
