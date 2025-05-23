import { Component } from '../src/entities/Component'
import { WebSocketManager } from '../src/entities/WebSocketManager'
import { ChangeGroup } from '../src/entities/ChangeGroup'
import { Qrwc } from '../src/entities/Qrwc'
import { Control } from '../src/entities/Control'
import {
  IComponentState,
  IComponentGetControlsResult
} from '../src/index.interface'
import { jest } from '@jest/globals'

describe('Component', () => {
  let mockWebSocketManager: WebSocketManager
  let mockChangeGroup: ChangeGroup
  let mockQrwc: Qrwc
  let mockComponentState: IComponentState
  let mockControlsResponse: IComponentGetControlsResult

  beforeEach(() => {
    // Mock dependencies
    mockWebSocketManager = {
      sendRpc: jest.fn(),
      on: jest.fn(),
      emit: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn()
    } as unknown as WebSocketManager

    mockChangeGroup = {
      registerControl: jest.fn(),
      deregisterControl: jest.fn()
    } as unknown as ChangeGroup

    mockQrwc = {
      emit: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn()
    } as unknown as Qrwc

    mockComponentState = {
      ID: 'component-1',
      Name: 'TestComponent',
      Type: 'custom_controls',
      Properties: [{ Name: 'type_1', Value: '15', PrettyName: 'Type' }],
      Controls: null,
      ControlSource: 2
    }

    // Mock GetControls response with multiple controls
    mockControlsResponse = {
      Name: 'TestComponent',
      Controls: [
        {
          Name: 'control1',
          Type: 'Text',
          String: 'Test Value 1',
          Direction: 'Read/Write',
          Position: 0,
          Value: 0
        },
        {
          Name: 'control2',
          Type: 'Text',
          String: 'Test Value 2',
          Direction: 'Read/Write',
          Position: 0,
          Value: 0
        }
      ]
    }

    // Set default mock response
    ;(
      mockWebSocketManager.sendRpc as jest.Mock<
        typeof mockWebSocketManager.sendRpc
      >
    ).mockResolvedValue(mockControlsResponse)
  })

  it('should create a component instance with correct initial state', async () => {
    const component = await Component.createComponent(
      mockWebSocketManager,
      mockChangeGroup,
      mockQrwc,
      'TestComponent',
      mockComponentState
    )

    // Check component properties
    expect(component.name).toBe('TestComponent')
    expect(component.state).toEqual(mockComponentState)
    expect(component.qrwc).toBe(mockQrwc)

    // Check controls were created
    expect(Object.keys(component.controls)).toHaveLength(2)
    expect(component.controls.control1).toBeDefined()
    expect(component.controls.control1.name).toBe('control1')
    expect(component.controls.control2).toBeDefined()
    expect(component.controls.control2.name).toBe('control2')
  })

  it('should propagate control update events to the qrwc instance', async () => {
    const component = await Component.createComponent(
      mockWebSocketManager,
      mockChangeGroup,
      mockQrwc,
      'TestComponent',
      mockComponentState
    )
    const mockControl = {} as Control
    const mockState = {
      Name: 'control1',
      Type: 'Text',
      String: 'Test Value 1',
      Direction: 'Read/Write',
      Position: 0,
      Value: 0,
      Bool: false
    }
    component.emit('update', mockControl, mockState)
    expect(mockQrwc.emit).toHaveBeenCalledWith(
      'update',
      component,
      mockControl,
      mockState
    )
  })

  it('should propagate error events to the qrwc instance', async () => {
    const component = await Component.createComponent(
      mockWebSocketManager,
      mockChangeGroup,
      mockQrwc,
      'TestComponent',
      mockComponentState
    )
    const mockError = new Error('Test error')
    component.emit('error', mockError)
    expect(mockQrwc.emit).toHaveBeenCalledWith('error', mockError)
  })

  it('should handle RPC errors when fetching controls', async () => {
    // Mock RPC error
    ;(
      mockWebSocketManager.sendRpc as jest.Mock<
        typeof mockWebSocketManager.sendRpc
      >
    ).mockRejectedValueOnce('RPC Error')

    // suppress console.error in test
    jest.spyOn(console, 'error').mockImplementationOnce(() => {})

    await expect(
      Component.createComponent(
        mockWebSocketManager,
        mockChangeGroup,
        mockQrwc,
        'TestComponent',
        mockComponentState
      )
    ).resolves.not.toThrowError()
  })

  it('should clean up properly when cleanUp is called', async () => {
    const component = await Component.createComponent(
      mockWebSocketManager,
      mockChangeGroup,
      mockQrwc,
      'TestComponent',
      mockComponentState
    )

    // Mock the cleanUp methods on controls
    component.controls.control1.cleanUp = jest.fn()
    component.controls.control2.cleanUp = jest.fn()

    jest.spyOn(component, 'removeAllListeners')
    jest.spyOn(component.controls.control1, 'cleanUp')
    jest.spyOn(component.controls.control2, 'cleanUp')

    component.cleanUp()

    expect(component.removeAllListeners).toHaveBeenCalled()
    // Verify both controls were cleaned up
    expect(component.controls.control1.cleanUp).toHaveBeenCalled()
    expect(component.controls.control2.cleanUp).toHaveBeenCalled()
  })

  it('should gracefully handle a component with no controls', async () => {
    // Mock GetControls response with empty controls array
    const emptyControlsResponse = {
      Name: 'TestComponent',
      Controls: [] // Empty array - no controls
    }

    // Set mock response to return empty controls
    ;(
      mockWebSocketManager.sendRpc as jest.Mock<
        typeof mockWebSocketManager.sendRpc
      >
    ).mockResolvedValueOnce(emptyControlsResponse)

    // Create component with empty controls
    const component = await Component.createComponent(
      mockWebSocketManager,
      mockChangeGroup,
      mockQrwc,
      'TestComponent',
      mockComponentState
    )

    // Verify component was created successfully
    expect(component).toBeDefined()
    expect(component.name).toBe('TestComponent')

    // Verify controls object exists but is empty
    expect(component.controls).toBeDefined()
    expect(Object.keys(component.controls)).toHaveLength(0)

    // Test that cleanUp doesn't throw errors with no controls
    expect(() => component.cleanUp()).not.toThrow()
  })
})
