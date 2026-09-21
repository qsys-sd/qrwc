/**
 * Compile-time type tests for the createQrwc start options.
 *
 * IStartOptions is a discriminated union: exactly one of `socket` (unmanaged)
 * or `host` (managed). The type-only function body never runs; its assertions
 * are verified by the type-check (tsc --noEmit).
 */
import { Qrwc } from '../src/entities/Qrwc'
import type { IStartOptions, IWebSocket } from '../src/index.interface'
import { expectToBe } from './QRWC_Test_Types'

async function optionsTypeTest() {
  const socket = {} as IWebSocket

  // unmanaged: socket + apiKey
  void Qrwc.createQrwc({ socket, apiKey: 'k' } satisfies IStartOptions)
  // managed: host + apiKey, with optional dispatcher/reconnect
  void Qrwc.createQrwc({
    host: '192.168.1.1',
    apiKey: 'k',
    dispatcher: {},
    reconnect: { maxAttempts: 3, delay: 100 }
  } satisfies IStartOptions)
  // apiKey is optional — cores only require it when access control is enabled
  void Qrwc.createQrwc({ host: '192.168.1.1' } satisfies IStartOptions)
  void Qrwc.createQrwc({ socket } satisfies IStartOptions)
  // @ts-expect-error - `host` and `socket` are mutually exclusive
  void Qrwc.createQrwc({ host: '192.168.1.1', socket, apiKey: 'k' })

  const qrwc = await Qrwc.createQrwc({ host: '192.168.1.1', apiKey: 'k' })
  qrwc?.on('reconnected', () => undefined)
  qrwc?.on('disconnected', (reason) => expectToBe<string>(reason))
}

describe('createQrwc start options', () => {
  it('accepts exactly one of socket (unmanaged) or host (managed)', () => {
    // The assertion lives in the type-only function above; referencing it keeps
    // the linter happy and gives Jest a runnable assertion.
    expect(typeof optionsTypeTest).toBe('function')
  })
})
