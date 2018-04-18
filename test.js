#!/usr/bin/env node

const path = require('path');
const {
  expect
} = require('chai');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const perfConfig = require('lighthouse/lighthouse-core/config/perf.json');
const package = require(path.join(process.cwd(), 'package.json'));

if (!package.perfomatic || !package.perfomatic.urls) {
  throw new Error('No perfomatic config with urls in package.json found. Please add one to continue.');
}

const flags = {
  chromeFlags: ['--headless']
};

// default config
let config = Object.assign({
  verbose: false,
  showAvailableMetrics: false,
  overall: 90
}, package.perfomatic);

// run in localhost or travis only
console.log('\nPreparing Perfomatic tests for Lighthouse');

function launchChromeAndRunLighthouse(url, flags = {}, config = null) {
  return chromeLauncher
    .launch()
    .then(chrome => {
      flags.port = chrome.port;
      return lighthouse(url, flags, perfConfig).then(results => chrome.kill().then(() => results));
    })
    .catch(err => {
      console.error(err);
      // couldn't load page, can't exit chrome exit script
      process.exit();
    });
}

function testUrl(url) {
  return launchChromeAndRunLighthouse(url, flags)
    .then(results => {
      // Use results!
      return results;
    })
    .catch(err => {
      console.error(err);
      console.log(`Server not found at ${url} when running tests.`);
      return;
    });
}

function printFeedback(helpData) {
  if (helpData.length > 0) {
    console.log('\n');
    helpData.forEach(help => console.log(`HELP (${help.key}): ${help.msg} \n`));
  }
}

async function runEverything(config) {
  return Promise.all(config.urls.map(url => testUrl(url)));
}

describe('Running...', function () {
  this.timeout(30000);
  let testData;
  var helpData = [];
  before(function (done) {
    runEverything(config).then(data => {
      testData = data;
      done();
    });
  });
  after(function (done) {
    printFeedback(helpData);
    done();
  });

  it('Comparing test results to budget', () => {
    testData.forEach(pageData => {
      describe(`${pageData.url}`, () => {
        if (config.overall) {
          it('should pass overall score', () => {
            if (config.verbose) {
              console.log(`   Overall score: ${pageData.score}\n`);
            }
            expect(pageData.score).to.be.at.least(config.overall);
          })
        }
        // run tests against all budget metrics
        Object.keys(config.budget).forEach(key => {
          if (config.showAvailableMetrics) {
            console.log('pageData.audits[key]', pageData.audits[key]);
            const metrics = Object.keys(pageData.audits).map(key => {
              console.log(`${key}: ${pageData.audits[key].scoringMode}`);
            });
          }
          it(`should pass ${key} score`, () => {
            try {
              if (config.verbose) {
                console.log(`   ${key} score: ${pageData.audits[key].score}`);
                console.log(`   ${key} time: ${pageData.audits[key].displayValue}\n`);
              }
              if (pageData.audits[key].scoringMode === 'numeric') {
                // numeric scoring mode
                const feedback = expect(pageData.audits[key].score).to.be.at.least(config.budget[key]);
              } else {
                // binary scoring mode
                const feedback = expect(pageData.audits[key].score).to.be.equal(config.budget[key]);
              }
            } catch (err) {
              // save helpful msgs until after the tests
              const help = {
                key: key,
                msg: pageData.audits[key].helpText
              }
              if(config.verbose) {
                console.log(`   HELP (${help.key}): ${help.msg} \n`);
              }
              throw err;
            }
          });
        });
      });
    });
  });
});
