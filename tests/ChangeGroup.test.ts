import { ChangeGroup } from '../src/entities/ChangeGroup'
import { WebSocketManager } from '../src/entities/WebSocketManager'
import { Control } from '../src/entities/Control'
import { jest } from '@jest/globals'

const emptyLogger = {
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
}

describe('ChangeGroup', () => {
  let mockWebSocketManager: WebSocketManager
  let changeGroup: ChangeGroup

  beforeEach(() => {
    mockWebSocketManager = {
      sendRpc: jest
        .fn<(...args: any[]) => any>()
        .mockResolvedValue({ Changes: [] }),
      on: jest.fn(),
      emit: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn()
    } as unknown as WebSocketManager

    changeGroup = new ChangeGroup(emptyLogger, mockWebSocketManager)
  })

  afterEach(() => {
    changeGroup.close()
  })

  it('registering a control adds it to the change group in QRC', async () => {
    const mockControl = {
      name: 'gain',
      component: { name: 'MyComponent' }
    } as unknown as Control

    const callback = jest.fn()
    await changeGroup.registerControl(mockControl, callback)

    expect(mockWebSocketManager.sendRpc).toHaveBeenCalledWith(
      'ChangeGroup.AddComponentControl',
      expect.objectContaining({
        Component: {
          Name: 'MyComponent',
          Controls: [{ Name: 'gain' }]
        }
      })
    )
  })

  it('should invoke callback on poll when change matches a registered control', async () => {
    const mockControl = {
      name: 'gain',
      component: { name: 'MyComponent' }
    } as unknown as Control

    const callback = jest.fn()
    await changeGroup.registerControl(mockControl, callback)

    const change = {
      Component: 'MyComponent',
      Name: 'gain',
      Value: 1,
      String: '1'
    }
    ;(
      mockWebSocketManager.sendRpc as jest.Mock<(...args: any[]) => any>
    ).mockResolvedValueOnce({
      Changes: [change]
    })

    await changeGroup.poll()
    expect(callback).toHaveBeenCalledWith(change)
  })
})
