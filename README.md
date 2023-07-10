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
  * `npm run prepare`
  * `npm link`
  * now in your FE project terminal you can use `npm link {path to control-connect}`
  * this should install this project as node_module

### Implementation and use ###

* WIP

### Who do I talk to? ###

* Devin Kapla (Devin.Kapla@qsc.com)

### Tech

* 14 Node or higher
* Typescript

### Some considerations ###

* No testing has been set up
* This is currently meant for Frontend/UI applications only and won't work on server
* This being a POC, this won't be how the install and final project will look