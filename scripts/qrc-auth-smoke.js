#!/usr/bin/env node

/**
 * Minimal QRC websocket auth example.
 * Edit the constants below, run with `node scripts/qrc-auth-smoke.js`.
 */

const CORE_HOST = '10.126.13.8'
const API_KEY = '5b99c68f-a6c6-4720-b3d9-eac06ab80ebb'

if (typeof WebSocket === 'undefined') {
  fail(
    'Global WebSocket is not available in this Node runtime. Use a Node version with built-in WebSocket support.'
  )
}

const url = `ws://${CORE_HOST}/qrc-public-api/v0`
const requestId =
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : String(Date.now())

const ws = new WebSocket(url)

ws.addEventListener('open', () => {
  const request = {
    apiKey: API_KEY,
    jsonrpc: '2.0',
    method: 'StatusGet',
    params: undefined,
    id: requestId
  }

  ws.send(JSON.stringify(request))
})

ws.addEventListener('message', (event) => {
  let parsed
  try {
    parsed = JSON.parse(event.data)
  } catch {
    fail(`Received non-JSON message: ${String(event.data)}`)
  }

  if (!parsed || parsed.id !== requestId) {
    return
  }

  if (parsed.error) {
    console.error('RPC error:')
    console.error(JSON.stringify(parsed.error, null, 2))
    ws.close()
    process.exitCode = 1
    return
  }

  console.log('RPC result:')
  console.log(JSON.stringify(parsed.result, null, 2))
  ws.close()
  process.exit(0)
})

ws.addEventListener('error', (event) => {
  fail(`WebSocket error: ${event.type || 'unknown'}`)
})

function fail(message) {
  console.error(message)
  process.exit(1)
}
