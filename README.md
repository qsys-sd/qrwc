# Q-SYS Remote WebSocket Control
## QRWC is a NPM library for controlling 3rd party software while interacting with Qsys design controls

### What is this repository for?
* QDS Version 10.0.0 or higher

### Implementation and use

#### Installation
```bash
npm install @q-sys/qrwc
```

#### Getting started
For Node environments, the callback-style startup requires Node v22.4.0+. For older versions of Node, refer to the second example.
```typescript
import { setupQrwc } from "q-sys/qrwc"

const { closeQrwc } = setupQrwc({
   coreIpAddress: "{Core IP Address}",
   onStartComplete: (qrwc) => {
      setComponents(qrwc.components)
      setInitialized(true)
   },
   onControlsUpdated: (qrwc, updatedComponent) => {
      console.log("controlsUpdated", updatedComponent)
      // console.log("controlsUpdated", qrwc.components) // another option

      // This is when your application should update
   }
})

// when finished, close QRWC's websocket connection
closeQrwc()

```

If desired, you can also manage the websocket connection yourself:

```typescript
import { Qrwc, type IComponent } from "@q-sys/qrwc"
// const { Qrwc } = require('@q-sys/qrwc'); // for BE/node environments

const qrwc = new Qrwc()

const socket = new WebSocket("ws://{IP}/qrc-public-api/v0")

socket.onopen = async () => {
  await qrwc.attachWebSocket(socket)
  await qrwc.start()

  setComponents(qrwc.components) // Record<string, IComponent>
  setInitialized(true);
}

qrwc.on("controlsUpdated", (updatedComponent: IComponent) => {
  console.log("controlsUpdated", updatedComponent)
  // console.log("controlsUpdated", qrwc.components) // another option

  // This is when your application should update
})

// when finished, close QRWC's websocket connection
socket.close()
```

#### Start options
`setupQrwc()` accepts an object with options. `qrwc.start()` can optionally take an object. That contains options
- componentFilter
  - Allows users to set a filter, enabling a specific change group to be created upon start
  - IComponentFilter must be a call back that returns a boolean, it will recieve a sinle instance of a component

IStartOptions
```typescript
interface IStartOptions {
  componentFilter?: IComponentFilter
  pollingInterval?: IPollingInterval
}

type IPollingInterval = number // must be equal to or greater than 34

interface IComponentFilter {
  (component: IComponent): boolean
}
```
##### example
```typescript
setupQrwc({
   coreIpAddress: "{Core IP Address}",
   componentFilter: (component)=>component.Name === "Gain",
   pollingInterval: 34 // roughly 30 times a second
   onStartComplete: (qrwc) => {
      setComponents(qrwc.components)
      setInitialized(true)
   },
   onControlsUpdated: (qrwc, updatedComponent) => {
      console.log("controlsUpdated", updatedComponent)
   }
})
```

##### websocket example
```typescript
function componentFilter(component: IComponent){
  return component.Name === "Gain"
}

const options: IStartOptions = {
  componentFilter,
  pollingInterval: 34 // roughly 30 times a second
}

socket.onopen = async () => {
//...
  await qrwc.start(options)
//...
}
```

Note: If no options object is provided or if values are not present in the object, QRWC will perform all actions per default settings.

#### Default Settings
If no options are provided for specific values...
- componentFilter - All scriptable components and their nested controls will be made into one change group
- pollingInterval - A polling rate will be set of 350, or roughly 3 times a second

#### Attempting reconnects
* setupQrwc will attempt to reconnect if you supply it with a `maxReconnectAttempts` startup option:
```typescript
setupQrwc({
   coreIpAddress: "{Core IP Address}",
   maxReconnectAttempts: 2, // will attempt to reconnect twice before giving up
   onStartComplete: (qrwc) => {
      setComponents(qrwc.components)
      setInitialized(true)
   },
   onControlsUpdated: (qrwc, updatedComponent) => {
      console.log("controlsUpdated", updatedComponent)
   }
})
```
#### Attempting reconnects (websockets)
* Qrwc has an automated clean up that is triggered by the "disconnected" event.'
  * This cleans up all listeners attached to the instance / intervals / classes
* This also means that you should be creating a new WebSocket & instance of Qrwc to attempt a reconnect, along with the listeners

```typescript
// continued from above example
qrwc.on("disconnected", (event: string) => {
  // console.log("disconnected", event)

  // attempt reconnect strategy
})
```

#### Getting to controls
* After the event listener for "startComplete" and subsequently after that "controlsUpdated", you can access all updated components/controls via `Qrwc.components`
* `Qrwc.components` is formatted as dictionary using component names as key names. Controls is also formatted as a dictionary within `component.Controls` with control names as key names.
```JSON
{
   "Text_Box": {
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
      "Controls": {
         "text.1": {
            "control": {
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
      "ControlSource": 2
   },
   "LED": {
      "ID": "LED",
      "Name": "LED",
      "Type": "custom_controls",
      "Properties": [
         {
            "Name": "type_1",
            "Value": "15",
            "PrettyName": "Type"
         },
         // continued ...
      ],
      "Controls": {
         "led.1": {
            "control": {
               "Name": "led.1",
               "Type": "Boolean",
               "Value": 0,
               "String": "false",
               "Position": 0,
               "Direction": "Read/Write",
               "Component": "LED",
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
      "ControlSource": 2
   }
}
```
* See below for control object API


#### Interacting with the control object
* Accessing a control object
```typescript
const { mute } = Qrwc.components.Gain.Controls

console.log("Mute: ", mute.Value)
// logs: Mute: true
```
* Accessing a control object with a complex name
```typescript
const control = Qrwc.components.Text_Box.Controls['text.1']

console.log("Text: ", control.String)
// logs: Text: Some string
```
### Updating the core:
To update the control on the core, just directly assign a value to the `Value`, `String`, `Position`, or `Bool` properties of the control:

```typescript
stringControl.String = "Hello world";

numberControl.Value = 20;

boolControl.Bool = true;
```

## Properties

- `Name`: The name of the control.
- `Component`: The name of the component.
- `Value`: The value of the control. Can be a string, number, boolean, or undefined.
- `String`: The string of the control. Can be a string or undefined. 
- `Position`: The position of the control. Can be a number or undefined.
- `Bool`: A boolean representation of the control's position. Returns `true` if the position is 0.5 or greater, `false` otherwise. If the control's type is not 'Boolean', it emits an error event and returns undefined.
- `Type`: The type of the control. Can be a string or undefined.

## Methods

- `getProperties()`: Returns a deep copy of all the properties of the control.
- `getMetaProperty(propertyName: string)`: Gets a property from the control that is not available via default getters. If the property does not exist, an error event is emitted and the function execution ends.

## Qrwc Events

- `controlsUpdated`: emitted when a control has been updated by the core:
```typescript
qrwc.on("controlsUpdated", (updatedComponent: IComponent) => {
  console.log("controlsUpdated", updatedComponent)
  // This is when your application should update
})
```
- `disconnected`: emitted when QRWC has lost its connection and indicates that a new websocket and instance of Qrwc should be created.
```typescript
qrwc.on("disconnected", (event: string) => {
   // attempt reconnect strategy
})
```
- `error`: Emitted when there is a type mismatch for a property or when a property does not exist on the control.
```typescript
qrwc.on("error", (error) => {
   console.error("Qrwc error: ", error)
})
```

## Example

```typescript
const controlObject = Qrwc.components.Text_Box['text.1']

console.log(controlObject.Name); // 'text.1'
console.log(controlObject.Component); // 'Text_Box'
console.log(controlObject.Value); // 0
console.log(controlObject.String); // '' 
console.log(controlObject.Position); // 0
console.log(controlObject.Bool); // undefined - emits error because not a boolean type control
console.log(controlObject.Type); // 'Text'

// Use ... no default string
console.log(controlObject.String); // '' 

controlObject.String = 'New Control String'; // update string
// Use of newly updated string
console.log(controlObject.String); // 'New Control String'

// Examples of other methods
const properties = controlObject.getProperties();
console.log(properties); // { Name: 'text.1', Component: 'Text_Box', Value: 0, String: 'New Control String', Position: 0, Type: 'Text', ...} plus all other properties not exposed via getters

const valueMin = controlObject.getMetaProperty('ValueMin');
console.log(valueMin); // The minimum value of the control, or undefined if the 'ValueMin' property does not exist.
```
### Documentation for Developers

For more information on developing and contributing to this library, please refer to the [Developer Guide](README-Developers.md).