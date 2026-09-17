# Q-SYS Remote WebSocket Control

## QRWC is a NPM library for interacting with Q-SYS design controls from a Node or browser app using websockets

### What is this repository for?

- QDS Version 10.0.0 or higher

### Implementation and use

#### Installation

```bash
npm install @q-sys/qrwc
```

#### Getting started

```typescript
// This is in Typescript, but for Javascript you can just strip the types out

import { Qrwc } from '@q-sys/qrwc'

// Managed mode: give QRWC the core's address and your access key, and it opens
// and maintains the connection for you (see "Connecting to a core" below).
const qrwc = await Qrwc.createQrwc<{
  Gain_0: 'gain' | 'mute' // tell typescript there is a 'Gain_0' component with both 'gain' and 'mute' controls
  Gain_1: 'gain' // ...and a 'Gain_1' component with a 'gain' control
}>({
  host: '{core-hostname-or-ip}', // connects to wss://{host}/qrc-public-api/v0
  apiKey: '{your-qrc-access-key}', // only needed if the core has access control enabled
  pollingInterval: 350 // Optional: polling interval in milliseconds (default: 350)
})

// note that QRWC will only have access to components that have been marked as scriptable

// grab the EventEmitter for the control you care about
const gain0 = qrwc.components.Gain.controls.gain // Control
const gain1 = qrwc.components.Gain_1.controls.gain // Control

// only names declared in the generic parameter are accessible;
// e.g. `qrwc.components.Gain_2` would be a compile error
// (omit the generic parameter to access any component as `Component | undefined`)

// Listen for updates to the gain control. Listener parameter is a deconstructed IControlState
gain0.on('update', ({ Value, Position, String, Bool }) => {
  console.log(
    `Control updated with new values: ${Value} ${Position} ${String} ${Bool}`
  )
  if (Value > 10) {
    const updatedState = await gain0.update(10) // returns a promise for the updated state (IControlState)
  }
})

// when finished, close QRWC
qrwc.close()
```

#### Connecting to a core

QRWC supports two connection modes: **managed mode**, where you give QRWC the core's address and it opens and maintains the connection, and **unmanaged mode**, where you build and pass your own WebSocket.

##### Managed mode

Pass the core's `host`. QRWC builds the WebSocket, connects, and — if the link drops — automatically reconnects to the core with an exponential backoff upon failure. If the core has access control enabled, also pass your access key as `apiKey`.

```typescript
const qrwc = await Qrwc.createQrwc({
  host: '192.168.1.100', // hostname or IP; connects to wss://192.168.1.100/qrc-public-api/v0
  apiKey: '{your-qrc-access-key}' // only needed if the core has access control enabled
})
```

`host` defaults to a secure `wss://` connection. To connect without TLS you can pass an explicit scheme (`host: 'ws://192.168.1.100'`).

**Self-signed certificates.** A Q-SYS core presents a self-signed certificate by default, so a `wss://` connection will fail certificate verification unless you opt in. Pass a `dispatcher` (Node only) — an [undici](https://github.com/nodejs/undici) `Agent` that trusts self-signed certs:

```typescript
import { Agent } from 'undici'

const qrwc = await Qrwc.createQrwc({
  host: '192.168.1.100',
  dispatcher: new Agent({ connect: { rejectUnauthorized: false } })
})
```

In the browser, certificate trust is handled by the browser itself, so `dispatcher` is ignored. To use `wss://` in a browser, your core must be using a certificate that has been signed by a certificate authority.

**Reconnection tuning.** Managed mode retries automatically; override any default with `reconnect` (defaults shown):

```typescript
const qrwc = await Qrwc.createQrwc({
  host: '192.168.1.100',
  reconnect: {
    maxAttempts: 5, // give up (and emit a final `disconnected`) after this many failures
    delay: 5000, // first backoff in ms
    maxDelay: 5000, // backoff ceiling in ms
    backoffFactor: 1 // multiplier applied to the delay each attempt
  }
})
```

##### Unmanaged mode

Build the WebSocket yourself and pass it as `socket` when you need custom headers, a proxy/agent, a non-standard URL, or your own reconnect strategy. QRWC uses the socket as-is and does **not** reconnect on its own.

```typescript
const socket = new WebSocket('wss://192.168.1.100/qrc-public-api/v0')

const qrwc = await Qrwc.createQrwc({
  socket
})
```

`host` and `socket` are mutually exclusive — provide exactly one. `apiKey` is optional in both modes: include it only when the core has access control enabled.

#### Typing your design

The generic type parameter on `createQrwc<T>()` describes your design so components, controls, and control state are type-checked at the call site. It accepts **either** of two shapes, and the right one is detected automatically.

**Simple map** — component name → a union of its control names. Quick to author by hand:

```typescript
const qrwc = await Qrwc.createQrwc<{
  Gain_0: 'gain' | 'mute'
  Gain_1: 'gain'
}>({ host })

qrwc.components.Gain.controls.mute // Control
qrwc.components.Gain.controls.gain.state // IControlState
```

Every control's `state` is the generic `IControlState`, and every control is read/write (has `update()`).

**Expanded schema** — the full design: each component's controls and each control's `state` shape (including its `Direction`). This gives precise, per-control types:

```typescript
type MyDesign = {
  components: {
    Gain: {
      controls: {
        gain: {
          state: {
            Name: 'gain'
            Type: 'Float'
            Value: number
            Direction: 'Read/Write'
            // ...remaining state fields
          }
        }
      }
    }
    Status: {
      controls: {
        signal_present: {
          state: {
            Name: 'signal_present'
            Direction: 'Read Only'
            // ...
          }
        }
      }
    }
  }
}

const qrwc = await Qrwc.createQrwc<MyDesign>({ host })

qrwc.components.Gain.controls.gain.state.Value // number (not number | undefined)
await qrwc.components.Gain.controls.gain.update(0.5) // ok — Read/Write
await qrwc.components.Status.controls.signal_present.update(1) // ❌ Read Only — no update()
```

With the expanded schema, `state`, `update()`, and `update` event payloads are typed per control, and controls whose `Direction` is `'Read Only'` have no `update()` method in their TypeScript type.

**No generic parameter** — omit it entirely and components/controls become open records: any name is allowed, each typed as `Component`/`Control | undefined` with the generic `IControlState`.

> On a typed design (either shape), only the names you declare are accessible — reading an undeclared component or control is a compile error.

#### Start options

`Qrwc.createQrwc()` accepts an object with options. Exactly one of `host` (managed mode) or `socket` (unmanaged mode) is required.

Common to both modes:

- `apiKey`: Optional QRC access key. Required only when the core has access control (authentication) enabled; omit it otherwise.
- `pollingInterval`: Optional interval in milliseconds for polling control changes (minimum: 34, default: 350)
- `componentFilter`: Optional filter function callback to allow for connecting to a subset of components in a design
- `timeout`: Optional timeout in milliseconds for websocket messages (default 5000 ms)
- `logger`: Optional logger object with `error`, `warn`, `info`, `debug`, and `trace` functions. Should work with common loggers such as [`pino`](https://github.com/pinojs/pino) and JavaScript's built-in `console` logger.

Managed mode:

- `host`: Hostname or IP of the core. Connects to `wss://{host}/qrc-public-api/v0` by default; include an explicit `ws://`/`wss://` scheme to override.
- `dispatcher`: Optional [undici](https://github.com/nodejs/undici) `Agent` (Node only).
- `reconnect`: Optional reconnection tuning (`maxAttempts`, `delay`, `maxDelay`, `backoffFactor`).

Unmanaged mode:

- `socket`: A WebSocket instance you create and connect to the core yourself.

```typescript
type IStartOptions = {
  apiKey?: string // only when the core has access control enabled
  pollingInterval?: number
  componentFilter?: (componentState: IComponentState) => boolean
  timeout?: number
  logger?: Partial<ILogger>
} & (
  | {
      // Managed mode: QRWC opens and maintains the connection
      host: string
      dispatcher?: unknown // undici Agent (Node) to trust a self-signed cert
      reconnect?: {
        maxAttempts?: number // default 5
        delay?: number // default 5000 (ms)
        maxDelay?: number // default 5000 (ms)
        backoffFactor?: number // default 1
      }
    }
  | {
      // Unmanaged mode: you create and own the socket
      socket: IWebSocket
    }
)
```

Note: aside from the connection target (`host` or `socket`), all values fall back to their defaults when omitted.

#### Default Settings

If no options are provided for specific values:

- pollingInterval - A polling rate will be set of 350, or roughly 3 times a second
- componentFilter - All scriptable components in the design will be fetched from the core
- timeout - The timeout will be set to 5000ms
- logger - QRWC will not log anything
- reconnect (managed mode) - Retries up to 5 times, waiting 5 s between attempts

#### Connection handling

**Managed mode** reconnects for you. When the connection drops, QRWC emits `disconnected` and pauses polling; it then retries with backoff and, on success, emits `reconnected` after re-registering your controls and resuming polling. If it exhausts `reconnect.maxAttempts`, it emits a final `disconnected` and closes the instance.

```typescript
qrwc.on('disconnected', (reason: string) => {
  console.log('Connection lost, attempting to recover:', reason)
})

qrwc.on('reconnected', () => {
  console.log('Reconnected — controls re-registered and polling resumed')
})
```

**Unmanaged mode** does not reconnect on its own: `disconnected` is terminal. QRWC cleans up all listeners attached to the instance / intervals / classes when it fires, so create a new WebSocket and `Qrwc` instance to reconnect.

```typescript
qrwc.on('disconnected', (reason: string) => {
  console.log('Disconnected:', reason)
  // build a new socket + Qrwc instance to reconnect
})
```

#### Getting to controls

- After Qrwc has been initialized with `createQrwc()`, you can access all components/controls via `qrwc.components`
- `qrwc.components` is formatted as a dictionary using component names as key names. Controls are also formatted as a dictionary within `component.controls` with control names as key names.

```JSON
{
   "Text_Box": { // stable ref to the Component event emitter
     "name": "Text_Box",
      // `state` is a readonly grab-bag for misc properties
      // a property will likely be inside `state` even if it's not in the typescript type
      "state": {
        "ID": "Text_Box",
        "Name": "Text_Box",
        "Type": "custom_controls",
        "Properties": [
           {
              "Name":"type_1",
              "Value":"13",
              "PrettyName":"Type"
           },
           // continued ...
        ],
        "ControlSource": 2
      }
      "controls": {
        "text.1": { // stable ref to the Control event emitter
            "name": "text.1",
            "component": <object ref back to "Text_Box">,
            // state on the control functions similarly to state on the component
            // it gets a new readonly object with a new ref every update, so it can support functional patterns
            "state": {
              "Name": "text.1",
              "Type": "Text",
              "String": "textin",
              "Direction": "Read/Write",
              "Component": "Text_Box",
              "Value": 0,
              "Position": 0,
              "Choices": [],
              "Color": "",
              "Indeterminate": false,
              "Invisible": false,
              "Disabled": false,
              "Legend": "",
              "CssClass": ""
            }
         }
      },
   }
}
```

#### Interacting with the control object

Accessing a control object:

```typescript
const { mute /* Control */ } = qrwc.components.Gain.controls

mute.on('update', (state: IControlState) => {
  console.log('Mute: ', state.Value)
})

const newState: IControlState = await mute.update(true) // update param can be string, number, or boolean
```

Accessing a control object with a complex name:

```typescript
const text1: Control = qrwc.components.Text_Box.controls['text.1']
```

### Reading the engine status

When QRWC starts up, it requests the engine status from the core, which includes the design name, the type of core it is running on, and some other info. You can grab this using the `engineStatus` property on the root object returned by `Qrwc.createQrwc`:

```typescript
const qrwc = await Qrwc.createQrwc({
  host
})

const status = qrwc.engineStatus
/*{
  Platform: 'Core 8 Flex',
  State: 'Active',
  DesignName: 'QRWC_Basic_File',
  DesignCode: 'JFtMjsiUg05G',
  IsRedundant: false,
  IsEmulator: false,
  Status: { Code: 0, String: 'OK' }
}*/
```

### Updating the core:

To update a control on the core, use the control's update method:

```typescript
// The parameter can be either a primitive or an object
await control.update({ Value: 20 })
await control.update({ Position: 0.5 })

// primitives use Value
await control.update(20) // equivalent to { Value: 20 }

await control.update({ String: 'Hello world' })
await control.update('Hello world') // equivalent to { Value: 'Hello world' }

// Bools are coerced to 1 or 0
await control.update({ Bool: true }) // equivalent to { Value: 1 }
await control.update(false) // equivalent to { Value: 0 }

// The promise resolves to the new IControlState
const newState = await control.update(15) // newState.Value === 15

// you can also directly pass in an IControlState object if you want
control0.on('update', (state) => {
  control1.update(state)
})
```

## Control State Properties

The control state object provides the following properties:

- `Name`: The name of the control.
- `Component`: The name of the component.
- `Value`: The value of the control. Can be a string, number, or undefined.
- `String`: The string of the control. Can be a string or undefined.
- `Position`: The position of the control. Can be a number or undefined.
- `Bool`: A boolean representation of the control's position. Returns `true` if the position is 0.5 or greater, `false` otherwise. If the control's type is not 'Boolean', it emits an error event and returns undefined.
- `Type`: The type of the control. Can be a string or undefined.

This is not an exhaustive list. A control property is likely inside `state` even if it is not represented in the typescript type.

## Layered Event Listeners

This example shows how to work with different types of controls, listen for changes at different levels, and manage component/control interactions:

```typescript
  // --------- Setting up event listeners at different levels ---------

  // 1. Global level event listener (already set up in previous example)
  // This catches all control updates across all components
  qrwc.on('update', (component, control, state) => {
    console.log(`[Global] ${component.name}.${control.name} updated:`, state)
  })

  // 2. Component level event listeners
  // These catch all control updates for a specific component
  if (qrwc.components.Gain) {
    qrwc.components.Gain.on('update', (control, state) => {
      console.log(`[Component] Gain control ${control.name} changed:`, state)
    })
  }

  // 3. Control level event listeners (recommended)
  // Most specific, only catches updates for a single control
  if (qrwc.components.Text_Box?.controls['text.1']) {
    const textControl = qrwc.components.Text_Box.controls['text.1']

    textControl.on('update', (state) => {
      console.log(`[Control] Text updated to: ${state.String}`)
    })
  }
}
```

## Using the logger

QRWC has a startup option for a dependency-injected logger with various log levels, which can be helpful for debugging or if it is running in a cloud environment where logs need to conform to specific format. It has been tested with [`pino`](https://github.com/pinojs/pino) and JavaScript's built-in `console` logger, but it should work with any object that has the same shape/duck type.

### Logging with [`pino`](https://github.com/pinojs/pino) and [`pino-pretty`](https://github.com/pinojs/pino-pretty):

```typescript
import { Qrwc } from '@q-sys/qrwc'
import { pino } from 'pino'
import pretty from 'pino-pretty'

const qrwc = await Qrwc.createQrwc({
  host,
  pollingInterval: 1000,
  logger: pino({ level: 'info' }, pretty({ colorize: true }))
})
```

### Logging with [`console`](https://developer.mozilla.org/en-US/docs/Web/API/console):

```typescript
import { Qrwc } from '@q-sys/qrwc'

const qrwc = await Qrwc.createQrwc({
  host,
  pollingInterval: 1000,
  logger: console // this logs everything, since console doesn't have a log level threshold
})
```

#### Muting verbose log levels with [`console`](https://developer.mozilla.org/en-US/docs/Web/API/console):

```typescript
import { Qrwc } from '@q-sys/qrwc'

const qrwc = await Qrwc.createQrwc({
  host,
  pollingInterval: 1000,
  logger: {
    error: console.error,
    warn: console.warn,
    info: console.info,
    debug: console.debug
    // trace: console.trace -- Remove a function and you won't get logs from that level
  }
})
```

## Examples

- [QRWC React Example](./examples/qrwc-react-example/)
- [QRWC Node Example](./examples/qrwc-node-example/)

## Documentation for Developers

For more information on developing and contributing to this library, please refer to the [Developer Guide](README-Developers.md).
