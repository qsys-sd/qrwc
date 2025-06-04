# QRWC Basic Node example

This is an example of using Q-Sys's QRWC library with a basic Node application.
It is interacting with a design containing 3 Gain components: `Gain`, `Gain_1`, and `Gain_2`.
Each Gain component also has a `gain` controller.

## Installation:

`npm install`

## Running:

1. Run `gainaverage.qsys` on a core.
1. Change `youCoreIP` in `index.ts` to be the IP address of your core.
1. `npm run build`
1. `npm run start`
