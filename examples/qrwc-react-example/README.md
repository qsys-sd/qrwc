# QRWC REACT/MUI Example Demo

This repo is an example of how to use the QRWC library with React using MUI

## Getting started

- Pull down this repo
- Open design file save & run to your core
- `npm install` in the directory of this project
- `cp .env.example .env` from the project root to create an environment file
- Populate the `REACT_APP_CORE_IP_ADDRESS` environment variable in `.env` with your core's IP address
- `npm run start`

## Developing further

- Use existing code as a reference to setup further components/controls
- Currently `gain`, `mute`, and `text.1` are setup and working
- Feel free to reach out to Caroline Gingles with questions

## Some notes

- `/components` are the React components representing controls from a QSYS design
  - they should only recieve information relvant to the specific control
- The structure laid out in this project and above is what makes React re-render when something changes without using state
- MUI has extensive documentation for almost any UI elemnet you can think of and this project is setup to use them
- Making this prettier would take CSS time
