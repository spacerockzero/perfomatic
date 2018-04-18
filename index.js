#!/usr/bin/env node

const Mocha = require('mocha');
const path = require('path');

// Instantiate a Mocha instance.
var mocha = new Mocha({ui: 'bdd'});
var testFile = path.join(process.cwd(),'./node_modules/perfomatic/test.js');
mocha.addFile(testFile);

// Run the tests.
mocha.run(function(failures) {
  process.on('exit', function() {
    process.exit(failures); // exit with non-zero status if there were failures
  });
});
