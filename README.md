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

const socket = new WebSocket('ws://{IP}/qrc-public-api/v0')

// Create a new Qrwc instance with the open socket
const qrwc = await Qrwc.createQrwc<{
  Gain: 'gain' | 'mute' // tell typescript there is a 'Gain' component with both 'gain' and 'mute' controls
}>({
  socket,
  pollingInterval: 350 // Optional: polling interval in milliseconds (default: 350)
})

// note that QRWC will only have access to components that have been marked as scriptable

// grab the EventEmitter for the control you care about
const gain0 = qrwc.components.Gain.controls.gain // Control

// controls not in the generic parameter will need some type narrowing
const gain1 = qrwc.components.Gain_1?.controls.gain // Control | undefined

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

#### Start options

`Qrwc.createQrwc()` accepts an object with options:

- `socket`: Required WebSocket instance connected to a Q-SYS Core
- `pollingInterval`: Optional interval in milliseconds for polling control changes (minimum: 34, default: 350)
- `componentFilter` : Optional filter function callback to allow for connecting to a subset of components in a design
- `timeout`: Optional timeout in milliseconds for websocket messages (default 5000 ms)
- `logger`: Optional logger object with `error`, `warn`, `info`, `debug`, and `trace` functions. Should work with common loggers such as [`pino`](https://github.com/pinojs/pino) and JavaScript's built-in `console` logger.

```typescript
interface IStartOptions {
  socket: IWebSocket
  pollingInterval?: number
  componentFilter?: (componentState: IComponentState) => boolean
  timeout?: number
  logger?: Partial<ILogger>
}
```

Note: If no options object is provided or if values are not present in the object, QRWC will perform all actions per default settings.

#### Default Settings

If no options are provided for specific values:

- pollingInterval - A polling rate will be set of 350, or roughly 3 times a second
- componentFilter - All scriptable components in the design will be fetched from the core
- timeout - The timeout will be set to 5000ms
- logger - QRWC will not log anything

#### Connection handling

Qrwc provides a `disconnected` event that is triggered when the WebSocket connection is closed.

Qrwc automatically cleans up all listeners attached to the instance / intervals / classes when the `disconnected` event fires.

You should create a new WebSocket & instance of Qrwc to reconnect after disconnection.

```typescript
qrwc.on('disconnected', (reason: string) => {
  console.log('Disconnected:', reason)
  // implement your reconnect strategy here
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
  socket
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
  socket,
  pollingInterval: 1000,
  logger: pino({ level: 'info' }, pretty({ colorize: true }))
})
```

### Logging with [`console`](https://developer.mozilla.org/en-US/docs/Web/API/console):

```typescript
import { Qrwc } from '@q-sys/qrwc'

const qrwc = await Qrwc.createQrwc({
  socket,
  pollingInterval: 1000,
  logger: console // this logs everything, since console doesn't have a log level threshold
})
```

#### Muting verbose log levels with [`console`](https://developer.mozilla.org/en-US/docs/Web/API/console):

```typescript
import { Qrwc } from '@q-sys/qrwc'

const qrwc = await Qrwc.createQrwc({
  socket,
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
