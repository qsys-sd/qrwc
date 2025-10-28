import { Qrwc } from '../src/entities/Qrwc'
import { WebSocket, Server } from 'mock-socket'
import {
  IComponentGetComponentsResult,
  IStartOptions
} from '../src/index.interface'
import { jest } from '@jest/globals'

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

        // Handle StatusGet
        if (data.method === 'StatusGet') {
          socket.send(
            JSON.stringify({
              id: data.id,
              result: {
                Platform: 'test core',
                State: 'Active',
                DesignName: 'test design',
                DesignCode: '1234567890',
                IsRedundant: false,
                IsEmulator: false,
                Status: { Code: 0, String: 'OK' }
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
      pollingInterval: 100,
      componentFilter: (component) => component.Name === 'TestComponent1'
    }

    qrwc = await Qrwc.createQrwc(options)

    // Verify only the filtered component was loaded
    expect(Object.keys(qrwc.components)).toHaveLength(1)
    expect(qrwc.components.TestComponent1).toBeDefined()
    expect(qrwc.components.TestComponent2).toBeUndefined()
  })

  it('should emit update events when controls are updated', async () => {
    // Create a Qrwc instance
    const options: IStartOptions = {
      socket: mockSocket,
      pollingInterval: 100
    }

    qrwc = await Qrwc.createQrwc(options)

    // Set up a mock update listener
    const updateListener = jest.fn()
    qrwc.on('update', updateListener)

    // Simulate a control update
    const component = qrwc.components.TestComponent1
    const control = component?.controls.control1

    // Mock the WebSocketManager.sendRpc to return the expected response
    jest.spyOn(control!['websocketManager'], 'sendRpc').mockResolvedValueOnce([
      {
        Name: 'control1',
        Component: 'TestComponent1',
        String: 'Updated Value',
        Value: 1,
        Position: 0
      }
    ])

    // Update the control
    await control!.update('Updated Value')

    // Verify the update event was emitted with the correct parameters
    expect(updateListener).toHaveBeenCalledWith(
      component,
      control,
      expect.objectContaining({
        Name: 'control1',
        String: 'Updated Value'
      })
    )
  })

  it('should emit error events when errors occur', async () => {
    // Create a Qrwc instance
    const options: IStartOptions = {
      socket: mockSocket,
      pollingInterval: 100
    }

    qrwc = await Qrwc.createQrwc(options)

    // Set up a mock error listener
    const errorListener = jest.fn<(event: Error) => void>()
    qrwc.on('error', errorListener)

    // Simulate an error in the WebSocketManager
    qrwc['webSocketManager'].emit('error', new Error('Test error'))

    // Verify the error event was emitted with the correct error
    expect(errorListener).toHaveBeenCalledWith(expect.any(Error))
    expect(errorListener.mock.calls[0][0].message).toBe('Test error')
  })

  it('should emit disconnected event when WebSocket is closed', async () => {
    // Create a Qrwc instance
    const options: IStartOptions = {
      socket: mockSocket,
      pollingInterval: 100
    }

    qrwc = await Qrwc.createQrwc(options)

    // Set up a mock disconnected listener
    const disconnectedListener = jest.fn()
    qrwc.on('disconnected', disconnectedListener)

    // Simulate WebSocket close
    qrwc['webSocketManager'].emit('disconnected', 'Connection closed')

    // Verify the disconnected event was emitted
    expect(disconnectedListener).toHaveBeenCalledWith('Connection closed')
  })

  it('should clean up properly when close is called', async () => {
    // Create a Qrwc instance
    const options: IStartOptions = {
      socket: mockSocket,
      pollingInterval: 100
    }

    qrwc = await Qrwc.createQrwc(options)

    // Set up spies
    jest.spyOn(qrwc['changeGroup'], 'stopPolling')
    jest.spyOn(qrwc['changeGroup'], 'close')
    jest.spyOn(qrwc['webSocketManager'], 'close')
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
    expect(qrwc['webSocketManager'].close).toHaveBeenCalled()
    expect(qrwc.removeAllListeners).toHaveBeenCalled()
    expect(component1.close).toHaveBeenCalled()
    expect(component2.close).toHaveBeenCalled()
    expect(Object.keys(qrwc['_components'])).toHaveLength(0)
  })

  it('should gracefully handle connecting to a design with no components', async () => {
    // Create a new server that returns an empty components array
    const emptyComponentsServer = new Server('ws://localhost:8081')

    emptyComponentsServer.on('connection', (socket) => {
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

        // Handle StatusGet
        if (data.method === 'StatusGet') {
          socket.send(
            JSON.stringify({
              id: data.id,
              result: {
                Platform: 'test core',
                State: 'Active',
                DesignName: 'test design',
                DesignCode: '1234567890',
                IsRedundant: false,
                IsEmulator: false,
                Status: { Code: 0, String: 'OK' }
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

    // Expect the QRWC creation to throw with a specific error message
    await expect(
      Qrwc.createQrwc({
        socket: failingSocket,
        pollingInterval: 100,
        timeout: 100
      })
    ).rejects.toThrow(
      'WebSocket failed to connect (error). Check Q-SYS core IP address or wait and retry.'
    )

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
      pollingInterval: 100
    }

    qrwc = await Qrwc.createQrwc(options)

    expect(qrwc.engineStatus?.Platform).toBe('test core')
    expect(qrwc.engineStatus?.State).toBe('Active')
    expect(qrwc.engineStatus?.DesignName).toBe('test design')
    expect(qrwc.engineStatus?.DesignCode).toBe('1234567890')
    expect(qrwc.engineStatus?.IsRedundant).toBe(false)
    expect(qrwc.engineStatus?.IsEmulator).toBe(false)
    expect(qrwc.engineStatus?.Status?.Code).toBe(0)
    expect(qrwc.engineStatus?.Status?.String).toBe('OK')
  })
})
