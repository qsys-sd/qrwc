# QSYS Control Connect
## Proof of concept for controlling 3rd party UCIs via an NPM package

### What is this repository for? ###
* To test and showcase how Controls can be manipulated via a Fronted application using a NPM package
* QDS Version 9.7.0 or higher

### How do I get set up as a tester? ###
* Clone repo
* Open terimnal inside repo
* run the following commands
  * `npm install`
  * `npm run build`
  * `npm link`
  * now in your FE project terminal you can use `npm link {path to control-connect}`
  * this should install this project as a `node_module`

### Developing ###
* The npm library is based off the `/dist` dir but development happens in src 
* Eslint will tartget `/src` dir
  * Please lint before commiting changes
* Tests target `/dist` dir
  * Please test before commiting changes
  * `npm run build`
  * `npm run test`
* The Qrcc class has private & public methods and variables
  * Private: Obfuscating the websocket to prevent direct interaction & IP
  * Public: Serves as an interface to the above or a variable that shouldn't be secret
* If changes are saved in `/src` 
  * `npm run build`
  * now in your FE project terminal you can use `npm link {path to control-connect}` to reinstall with new changes

### Testing ###
* Currently the project is setup to test the built version available in `/dist`
* Simple tests with Jest & MockSocket
* A story is in the backlog to write more tests once more of requirements for functionality take place
* Currently the test suite hangs because of an unresolved promise. This is documented in a future testing ticket

### How do I get set up tests? BROKEN! ### 
* `npm install`
* `npm run build`
* `npm run test`

### Implementation and use ###
#### Getting started with auto start ####
```
import Qrcc from "control-connect"

const cc = new Qrcc()

const socket = new WebSocket("ws://{IP}/qrc")

socket.onopen = () => {
  cc.attachWebSocket(socket)
}

cc.on("webSocketAttached", () => {
  cc.autoStart()
})

cc.on("autoStartComplete", () => {
  console.log("autoStartComplete", cc.components)
})

cc.on("controlsUpdated", (updatedComponent: any) => {
  console.log("controlsUpdated", updatedComponent)
  // console.log("controlsUpdated", cc.components) // another option
})
```
#### Setting components/controls ####
* Use `cc.setComponent(componentName, updatedControls)` to set/update controls, it takes in...
  * the name (string) of the respective component for the given control
  * an array of controls containing the requested changes
    ```
      [
        {
          Name: string
          Value?: string | number | boolean
          String?: string
          Position?: number
        },
        ...
      ]
    ```
* Once the component change request has been sent, the Qrcc library will listen for a resoponse and update onve the core has changed. Qrcc does NOT update its own state before recieving a positive result from the core.

#### Getting started with submitting your own controls (No autostart) ####
* Not available yet
* Still a WIP

### Who do I talk to? ###
* Devin Kapla (Devin.Kapla@qsc.com)

### Tech
* 14 Node or higher
* Typescript
* Jest
* MockSocket

### Some considerations ###
* Minor testing has been setup as guide for further tests
* This is currently meant for Frontend/UI applications only and won't work on server
* This being a POC, this won't be how the install and final project will look