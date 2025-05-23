import { Control } from '../src/entities/Control'
import { WebSocketManager } from '../src/entities/WebSocketManager'
import { ChangeGroup } from '../src/entities/ChangeGroup'
import { Component } from '../src/entities/Component'
import { IControlState } from '../src/index.interface'
import { jest } from '@jest/globals'

describe('Control', () => {
  let mockWebSocketManager: WebSocketManager
  let mockChangeGroup: ChangeGroup
  let mockComponent: Component
  let control: Control
  let initialState: Omit<IControlState, 'Bool'>

  beforeEach(async () => {
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

    mockComponent = {
      name: 'TestComponent',
      emit: jest.fn(),
      on: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn()
    } as unknown as Component

    initialState = {
      Name: 'testControl',
      String: 'Test String',
      Value: 0,
      Position: 0,
      Type: 'Text',
      Direction: 'Read/Write'
    }

    control = await Control.createControl(
      mockWebSocketManager,
      mockChangeGroup,
      mockComponent,
      'testControl',
      initialState
    )
  })

  it('should compute Bool value correctly based on Value', async () => {
    // Create control with Value < 0.5

    let testControl = await Control.createControl(
      mockWebSocketManager,
      mockChangeGroup,
      mockComponent,
      'testControl',
      { ...initialState, Value: 0 }
    )
    expect(testControl.state.Bool).toBe(false)

    testControl = await Control.createControl(
      mockWebSocketManager,
      mockChangeGroup,
      mockComponent,
      'testControl',
      { ...initialState, Value: 0.4 }
    )
    expect(testControl.state.Bool).toBe(false)

    // Create control with Value >= 0.5
    testControl = await Control.createControl(
      mockWebSocketManager,
      mockChangeGroup,
      mockComponent,
      'testControl',
      { ...initialState, Value: 0.5 }
    )
    expect(testControl.state.Bool).toBe(true)

    testControl = await Control.createControl(
      mockWebSocketManager,
      mockChangeGroup,
      mockComponent,
      'testControl',
      { ...initialState, Value: 1 }
    )
    expect(testControl.state.Bool).toBe(true)
  })

  it('should register with the change group on construction', () => {
    expect(mockChangeGroup.registerControl).toHaveBeenCalledWith(
      control,
      expect.any(Function)
    )
  })

  it('should propagate updates to the component', () => {
    const newState = { ...initialState, Value: 1, Bool: true }
    control.emit('update', newState)
    expect(mockComponent.emit).toHaveBeenCalledWith('update', control, newState)
  })

  it('should propagate error events to the component', async () => {
    const mockError = new Error('Test error')
    control.emit('error', mockError)
    expect(mockComponent.emit).toHaveBeenCalledWith('error', mockError)
  })

  it('should update control state via the update method', async () => {
    const newValue = 'Updated String'
    const responseData = [
      {
        Name: 'testControl',
        String: newValue,
        Value: 0,
        Position: 0,
        Properties: [],
        ID: '',
        Type: '',
        Controls: null,
        ControlSource: 1
      }
    ]

    // Mock successful RPC response
    ;(
      mockWebSocketManager.sendRpc as jest.Mock<
        typeof mockWebSocketManager.sendRpc
      >
    ).mockResolvedValue(responseData)

    const result = await control.update(newValue)

    // Check RPC was called correctly
    expect(mockWebSocketManager.sendRpc).toHaveBeenCalledWith('Component.Set', {
      ResponseValues: true,
      Name: 'TestComponent',
      Controls: [
        {
          Name: 'testControl',
          Value: newValue
        }
      ]
    })

    // Check state was updated
    expect(result).toEqual({
      ...control.state,
      String: newValue
    })
  })

  it('should handle updating with boolean values (converting to numbers)', async () => {
    // Mock successful RPC response
    ;(
      mockWebSocketManager.sendRpc as jest.Mock<
        typeof mockWebSocketManager.sendRpc
      >
    ).mockResolvedValue([
      {
        Component: 'TestComponent',
        Name: 'testControl',
        Value: 1,
        String: 'true',
        Position: 1
      }
    ])

    await control.update(true)

    // Check that boolean was converted to number
    expect(mockWebSocketManager.sendRpc).toHaveBeenCalledWith(
      'Component.Set',
      expect.objectContaining({
        Controls: [
          expect.objectContaining({
            Value: 1 // true converted to 1
          })
        ]
      })
    )

    await control.update(false)

    // Check that boolean was converted to number
    expect(mockWebSocketManager.sendRpc).toHaveBeenCalledWith(
      'Component.Set',
      expect.objectContaining({
        Controls: [
          expect.objectContaining({
            Value: 0 // false converted to 0
          })
        ]
      })
    )
  })

  it('should handle RPC errors during update', async () => {
    jest.spyOn(control, 'emit')

    const error = new Error('RPC Error')
    ;(
      mockWebSocketManager.sendRpc as jest.Mock<
        typeof mockWebSocketManager.sendRpc
      >
    ).mockRejectedValue(error)

    await expect(control.update('New Value')).resolves.not.toThrowError()

    expect(control.emit).toHaveBeenCalledWith('error', expect.any(Error))
  })

  it('should clean up properly when cleanUp is called', () => {
    jest.spyOn(control, 'removeAllListeners')

    control.cleanUp()

    expect(mockChangeGroup.deregisterControl).toHaveBeenCalledWith(control)
    expect(control.removeAllListeners).toHaveBeenCalled()
  })
})
