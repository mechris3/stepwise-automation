# Sample Tests

Example consuming project for `@mechris3/stepwise-automation`.

## Setup

1. Start the sample app (in another terminal):
```bash
cd ../sample-app
npm install
npm start
```

2. Link the stepwise-automation package:
```bash
cd ../stepwise-automation
npm run build
npm link

cd ../sample-tests
npm install
npm link @mechris3/stepwise-automation
```

3. Run the dashboard:
```bash
npm run test:ui
```

4. Open http://localhost:3001 and select a journey to run.

## Headless mode
```bash
npm run test:run
```
