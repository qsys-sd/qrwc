# Q-SYS Remote WebSocket Control
## QRWC is a NPM library for controlling 3rd party software while interacting with Qsys design controls

### What is this repository for? ###
* QDS Version 9.7.0 or higher

### Implementation and use ###
#### Getting started with auto start ####
```typescript
import { Qrwc } from "qrwc" 
// const { Qrwc } = require('qrwc'); // for BE/node environments

const qrwc = new Qrwc()

const socket = new WebSocket("ws://{IP}/qrc-public-api/v0")

socket.onopen = () => {
  qrwc.attachWebSocket(socket)
}

qrwc.on("webSocketAttached", () => {
  qrwc.autoStart()
})

qrwc.on("autoStartComplete", () => {
  console.log("autoStartComplete", qrwc.components)

  // This is when all controls should be available for use by your application
})

qrwc.on("controlsUpdated", (updatedComponent: any) => {
  console.log("controlsUpdated", updatedComponent)
  // console.log("controlsUpdated", qrwc.components) // another option

  // This is when you application should update
})
```

#### Attempting reconnects ####
* Qrwc has an automated clean up that is triggered by the "disconnected" event.'
  * This cleans up all listeners attached to the instance / intervals / classes
* This also means that you should be creating a new WebSocket & instance of Qrwc to attempt a reconnect, along with the listeners

```typescript
// continued from above example
qrwc.on("disconnected", (event) => {
  // console.log("disconnected", event)

  // attempt reconnect strategy
})
```

#### Getting to controls ####
* After the event listener for "autoStartComplete" and subsequently after that "controlsUpdated", you can access all updated components/controls via `Qrwc.components`
* `Qrwc.components` is formatted as dictionary using component and control names as the field key name. 
```typescript
{
   "Gain": { // Component name
      "bypass": { // Control name
         // ... Control object
      },
      "gain": { // Control name
         // ... Control object
      },
      "invert": { // Control name
         // ... Control object
      },
      "mute": { // Control name
         // ... Control object
      }
   },
   "LED": { // Component name
      "led.1": { // Control name
         // ... Control object
      }
   }
}
```
* See below for control object API


#### Interacting with the control object ####
* Accessing a control object
```typescript
const { mute } = Qrwc.components.Gain

console.log("Mute: ", mute.Value)
// logs: Mute: true
```
* Accessing a control object with a complex name
```typescript
const control = Qrwc.components.Text_Box['text.1']

console.log("Text: ", control.String)
// logs: Text: Some string
```
### Control object API ###
The `ControlObject` is used to decorate a control, providing getters and setters for its properties. The decorator pattern allows us to add new behavior or responsibilities to objects without modifying their code.

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

## Events

- `qrwcEvents.error`: Emitted when there is a type mismatch for a property or when a property does not exist on the control.

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

### Developing ###
* The npm library is based off the `/dist` dir but development happens in src 
* Eslint will tartget `/src` dir
  * Please lint before commiting changes
* Tests target `/dist` dir
  * Please test before commiting changes
  * `npm run build`
  * `npm run test`
* The Qrwc class has private & public methods and variables
  * Private: Obfuscating the websocket to prevent direct interaction & IP
  * Public: Serves as an interface to private values or a variable that shouldn't be secret
* If changes are saved in `/src` 
  * `npm run build`
  * now in your FE project terminal you can use `npm link {path to control-connect}` to reinstall with new changes

### How do I get set up as a tester? ###
* Clone repo
* Open terimnal inside repo
* run the following commands
  * `npm install`
  * `npm run build`
  * `npm link`
  * now in your FE project terminal you can use `npm link {path to control-connect}`
  * this should install this project as a `node_module`

### Testing ###
* Currently the project is setup to test the built version available in `/dist`
* Simple tests with Jest & MockSocket
* A story is in the backlog to write more tests once more of requirements for functionality take place
* Currently the test suite hangs because of an unresolved promise. This is documented in a future testing ticket

### Who do I talk to? ###
* Devin Kapla (Devin.Kapla@qsc.com)

### Tech
* 14 Node or higher
* Typescript
* node/ws for BE support
* Jest
* MockSocket

### Some considerations ###
* Tests are currently broken due to a major refactor
* This being the main repo, a user will install this differently.
* Turning off your http server on the core...
```typescript
const agent = new https.Agent({
    rejectUnauthorized: false
  })
const socket = new WebSocket('wss://{your.core.ip.address}/qrc', {agent})
```