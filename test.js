#!/usr/bin/env node

const path = require('path');
const {expect} = require('chai');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
const perfConfig = require('lighthouse/lighthouse-core/config/perf.json');
const package = require(path.join(process.cwd(), 'package.json'));

if (!package.perfomatic || !package.perfomatic.urls) {
  throw new Error('No perfomatic config with urls in package.json found. Please add one to continue.');
}

// scores out of 100 that we expect in each metric
let perfBudget = {
  score: {
    'speed-index-metric': 100,
    'first-meaningful-paint': 100,
    'estimated-input-latency': 100,
    'first-interactive': 100,
    'consistently-interactive': 100,
    'link-blocking-first-paint': 100,
    'script-blocking-first-paint': 100,
    'total-byte-weight': 100,
    redirects: 100,
    'dom-size': 100
  },
  boolean: {
    'time-to-first-byte': true,
    'mainthread-work-breakdown': true,
    'bootup-time': true
  }
};

const flags = {
  chromeFlags: ['--headless']
};

// default config
let config = {};
config.budget = perfBudget;
config.urls = package.perfomatic.urls;

if (package.perfomatic.budget) {
  config.budget = package.perfomatic.budget;
}

// run in localhost or travis only
console.log('Preparing Perfomatic tests for Lighthouse');

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

describe('Running...', function() {
  this.timeout(30000);
  let testData;
  var helpData = [];
  before(function(done) {
    runEverything(config).then(data => {
      testData = data;
      done();
    });
  });
  after(function(done) {
    printFeedback(helpData);
    done();
  });

  it('Comparing test results to budget', () => {
    testData.forEach(pageData => {
      // console.log('pageData.url', pageData.url);
      describe(`${pageData.url} performance`, () => {
        // run tests against all budget metrics
        // all score-based budgets
        Object.keys(config.budget.score).forEach(key => {
          it(`should pass ${key} score`, () => {
            try {
              console.log(`   ${key} score: ${pageData.audits[key].score}`);
              console.log(`   ${key} time: ${pageData.audits[key].displayValue}`);
              const feedback = expect(pageData.audits[key].score).to.be.at.least(config.budget.score[key]);
            } catch (err) {

              // save helpful msgs until after the tests
              helpData.push({key: key, msg: pageData.audits[key].helpText});
              throw err;
            }
          });
        });
        // all boolean-based budgets
        Object.keys(config.budget.boolean).forEach(key => {
          it(`should pass ${key} boolean`, () => {
            try {
              console.log(`   ${key} score: ${pageData.audits[key].score}`);
              console.log(`   ${key} time: ${pageData.audits[key].displayValue}`);
              const feedback = expect(pageData.audits[key].score).to.be.equal(config.budget.boolean[key]);
            } catch (err) {

              // save helpful msgs until after the tests
              helpData.push({key: key, msg: pageData.audits[key].helpText});
              throw err;
            }
          });
        });
      });
    });
  });
});
