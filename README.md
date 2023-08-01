# QSYS Control Connect
## Proof of concept for controlling 3rd party UCIs via an NPM package

### What is this repository for? ###
* To test and showcase how Controls can be manipulated via a Fronted application using a NPM package
* QDS Version 9.7.0 or higher

### How do I get set up? ###
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
* The Qrcc class has private & public methods and variables
  * Private: Obfuscating the websocket to prevent direct interaction & IP
  * Public: Serves as an interface to the above or a variable that shouldn't be secret

### Testing ###
* Currently the project is setup to test the built version available in `/dist`
* Simple tests with Jest & MockSocket
* A story is in the backlog to write more tests once more of requirements for functionality take place

### How do I get set up tests? ###
* `npm install`
* `npm run test`

### Implementation and use ###
* WIP

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