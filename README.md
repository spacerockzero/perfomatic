# Perfomatic

Run Lighthouse performance tests easily from your app

# Install
From your app's root:
```
npm install perfomatic --save-dev
```

Add a perfomatic config to your package.json
```
"perfomatic": {
  "urls": [
    "http://localhost:5000",
    "http://localhost:5000/sample"
  ],
  "budget": {
    "overall": 90,
    "score": {
      "speed-index-metric": 90
    },
    "boolean": {
      "time-to-first-byte": true
    }
  }
}
```

Run the testfile via npm scripts
```
"scripts": {
  "perf": "perfomatic"
}
```

Start up your server at the urls you want to test against, then run perfomatic:

```
npm run perf
```

OR

# Sample vscode debugger setup (put this in your app to run with F5 debugger)
```
{
  // Use IntelliSense to learn about possible attributes.
  // Hover to view descriptions of existing attributes.
  // For more information, visit: https://go.microsoft.com/fwlink/?linkid=830387
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Perfomatic Tests",
      "stopOnEntry": false,
      "program": "${workspaceFolder}/node_modules/mocha/bin/_mocha",
      "args": ["--no-timeouts", "--colors", "${workspaceFolder}/node_modules/perfomatic/test.js"],
      "internalConsoleOptions": "openOnSessionStart"
    }
  ]
}
```
