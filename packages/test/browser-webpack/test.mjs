import jsdom from 'jsdom'

const { JSDOM } = jsdom
const pass = () => {
  console.log(
    ' \x1b[30m\x1b[42m PASS \x1b[0m - \x1b[30m\x1b[47m browser-webpack \x1b[0m'
  )
  process.exit(0)
}
const fail = () => {
  console.warn(
    ' \x1b[30m\x1b[41m FAIL \x1b[0m - \x1b[30m\x1b[47m browser-webpack \x1b[0m'
  )
  process.exit(1)
}
;(async () => {
  const dom = await JSDOM.fromFile('dist/index.html', {
    runScripts: 'dangerously',
    resources: 'usable'
  })
  const testElement = dom.window.document.getElementById('test')
  testElement.addEventListener('click', () => {
    if (testElement.textContent !== 'TestComponent1') {
      fail()
    } else {
      pass()
    }
  })
  setTimeout(fail, 3000)
})()
