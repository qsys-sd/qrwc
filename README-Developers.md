# Developing

### Tech
* 14 Node or higher
* Typescript
* node/ws for BE support
* Jest
* MockSocket

### Links to repos
* [FE QRWC React](https://bitbucket.qsc.com/projects/SANDBOX/repos/qrwc-react-example/browse)
  * This one should be updated with changes to QRWC
* [Thomas Holt Next.js](https://github.com/qsc-thomasholtronczy/qrwc-nextjs-demo)

### How do I get set up as a tester?
* Clone repo
* Open terminal inside repo
* Make sure you are managing your Node version it should be at least `16.18.1`
  * [NVM](https://github.com/nvm-sh/nvm) is a good option
* Run the following commands
  * `npm install`
  * `npm run build`
  * `npm link`
  * Now in your front-end (FE) project terminal, you can use `npm link {path to QRWC}`
  * This should install this QRWC as a `node_module` in your project
* The Qrwc class has private & public methods and variables
  * Private: Obfuscating the websocket to prevent direct interaction & IP
  * Public: Serves as an interface to private values or a variable that shouldn't be secret
* If changes are saved in QRWC `/src` 
  * `npm run build` - from the QRWC dir
  * If NPM link is set up properly, the node_modules in your app should automatically update with any saved & built changes

### Testing
* `npm run test`
* Simple tests with Jest & MockSocket
* Some tests are separated because they need a FE environment to work correctly.
* Ensure all tests pass before creating a pull request.
* Please write tests for new functionality.

### Deploying

#### Example release branch
* Create a release branch from the latest Develop
  * `git checkout -b release/1.1.0`

* Update version in package.json and commit
  * [For more info](https://docs.npmjs.com/about-semantic-versioning)
  * Bump version up in `package.json`
  * `git commit -m "Release version 1.1.0"`

#### SQA & Merges
* Build the release branch, checking for errors
* Test the release branch, looking for failing tests
* Document and fix any bugs on the release branch
* Create PRs for...
  * Release > Develop
  * Release > Main
* Get approvals for PRs
* Merge both PRs

#### NPM login to Publish
`npm login` - [For more info](https://docs.npmjs.com/cli/v9/commands/npm-login)
* You'll need read/write access to the Package

#### Publish/Deploying to NPM
* Once the PR on Main is merged and logged into NPM via CLI
* `git pull origin main` - get the latest main
* `git checkout main` - switch to the main branch
* `rm -rf dist` - removes previous builds if any
* `npm run build` - build the new package off of main in /dist
* `npm publish` - will publish/deploy main's build (/dist) to NPM

### Code Style and Conventions
* Follow the existing code style and conventions.
* Use ESLint to ensure code quality.
* Run `npm run lint` before committing changes.

### Managing Dependencies
* Adding new dependencies should be a last resort and should be heavily debated
  * We want QRWC to be as adoptable and easy to use as possible. Adding more dependencies will compromise that.
* Updating dependencies should be done on a regular basis
  * To update dependencies: `npm update`

### Who do I talk to?
* Devin Kapla (Devin.Kapla@qsc.com)

### Some considerations
* This being the main repo, a user will install this differently.
* Turning off your HTTP server on the core...
```typescript
const agent = new https.Agent({
    rejectUnauthorized: false
  })
const socket = new WebSocket('wss://{your.core.ip.address}/qrc', {agent})
```