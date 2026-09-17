import { ChangeGroup } from '../src/entities/ChangeGroup'
import { QrcClient } from '../src/connection/QrcClient'
import { Control } from '../src/entities/Control'
import { jest } from '@jest/globals'
import { IQrwcExpandedGenericParameter } from '../src/index.interface'

const emptyLogger = {
  trace: () => undefined,
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined
}

describe('ChangeGroup', () => {
  let mockQrcClient: QrcClient
  let changeGroup: ChangeGroup<IQrwcExpandedGenericParameter>

  beforeEach(() => {
    mockQrcClient = {
      sendRpc: jest
        .fn<(...args: any[]) => any>()
        .mockResolvedValue({ Changes: [] }),
      on: jest.fn(),
      emit: jest.fn(),
      removeListener: jest.fn(),
      removeAllListeners: jest.fn()
    } as unknown as QrcClient

    changeGroup = new ChangeGroup(emptyLogger, mockQrcClient)
  })

  afterEach(() => {
    changeGroup.close()
  })

  it('registering a control adds it to the change group in QRC', async () => {
    const mockControl = {
      name: 'gain',
      component: { name: 'MyComponent' }
    } as unknown as Control<IQrwcExpandedGenericParameter, string, string>

    const callback = jest.fn()
    await changeGroup.registerControl(mockControl, callback)

    expect(mockQrcClient.sendRpc).toHaveBeenCalledWith(
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
    } as unknown as Control<IQrwcExpandedGenericParameter, string, string>

    const callback = jest.fn()
    await changeGroup.registerControl(mockControl, callback)

    const change = {
      Component: 'MyComponent',
      Name: 'gain',
      Value: 1,
      String: '1'
    }
    ;(
      mockQrcClient.sendRpc as jest.Mock<(...args: any[]) => any>
    ).mockResolvedValueOnce({
      Changes: [change]
    })

    await changeGroup.poll()
    expect(callback).toHaveBeenCalledWith(change)
  })

  it('reregisterAll re-adds every registered control to the core', async () => {
    const makeControl = (component: string, name: string) =>
      ({
        name,
        component: { name: component }
      }) as unknown as Control<IQrwcExpandedGenericParameter, string, string>

    await changeGroup.registerControl(makeControl('CompA', 'gain'), jest.fn())
    await changeGroup.registerControl(makeControl('CompB', 'mute'), jest.fn())
    ;(mockQrcClient.sendRpc as jest.Mock<(...args: any[]) => any>).mockClear()

    await changeGroup.reregisterAll()

    expect(mockQrcClient.sendRpc).toHaveBeenCalledTimes(2)
    expect(mockQrcClient.sendRpc).toHaveBeenCalledWith(
      'ChangeGroup.AddComponentControl',
      expect.objectContaining({
        Component: { Name: 'CompA', Controls: [{ Name: 'gain' }] }
      })
    )
    expect(mockQrcClient.sendRpc).toHaveBeenCalledWith(
      'ChangeGroup.AddComponentControl',
      expect.objectContaining({
        Component: { Name: 'CompB', Controls: [{ Name: 'mute' }] }
      })
    )
  })
})
