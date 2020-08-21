#!/usr/bin/env node

const path = require('path');
const { expect } = require('chai');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');


// CONFIGS
// performance config default from lighthouse library
const perfConfig = {
  extends: 'lighthouse:default',
  settings: {
    throttlingMethod: 'devtools',
    onlyCategories: ['performance'],
  },
};

const package = require(path.join(process.cwd(), 'package.json'));

if (!package.perfomatic || !package.perfomatic.urls) {
  throw new Error('No perfomatic config with urls in package.json found. Please add one to continue.');
}

// default config
let config = {
  verbose: false,
  showAvailableMetrics: false,
  overall: 90,
  timeoutOverall: 1000 * 60 * 5, // 5 minutes, in milliseconds,
  timeoutPerSite: 1000 * 60,     // 1 minuite, in milliseconds
  ...package.perfomatic,         // User config overrides defaults
};

const chromeLauncherOpts = {
  chromeFlags: ['--headless'],
  logLevel: config.verbose ? 'info' : '',   // info about chrome-launcher status
  ...package.perfomatic.chromeLauncherOpts  // user can override chrome-launcher opts
}

const lighthouseOpts = {
  ...perfConfig.settings,
  onlyCategories: ['performance'],
  ...package.perfomatic.lighthouseOpts  // user can ovverride lighthouse opts
};

// show available metrics, if asked
if (config.showAvailableMetrics) {
  try {
    const availMetricsList = lighthouse.generateConfig()
      .categories.performance.auditRefs
      .map(item => item.id)
    console.log('* Available budget metrics list:', availMetricsList)
  } catch (error) {
    console.error('Couldn\'t get list of available metrics, because:', error)
  }
}

/** show configs for verbose users */
if (config.verbose) {
  console.log('* User config, after merge with defaults', config)
  console.log('* Chrome launcher opts:', chromeLauncherOpts)
  console.log('* Lighthouse opts:', lighthouseOpts)
}

console.log('\nPreparing Perfomatic tests for Lighthouse...');


// RUNNING GUTS
/** Launch chrome headless and run lighthouse, obvs */
function launchChromeAndRunLighthouse(url) {
  return chromeLauncher
    .launch(chromeLauncherOpts)
    .then(chrome => {
      lighthouseOpts.port = chrome.port;
      return lighthouse(url, lighthouseOpts).then(results => chrome.kill().then(() => results));
    })
    .catch(err => {
      console.error(err);
      // couldn't load page, can't exit chrome exit script
      process.exit();
    });
}

/** Test one site */
function testUrl(url) {
  return launchChromeAndRunLighthouse(url)
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

async function runEverything(config) {
  const res = []
  for (let site of config.urls) {
    console.log(`   Testing site: ${site} ...`)
    const siteRes = await testUrl(site)
    res.push(siteRes)
    console.log('     done.')
  }
  return res
}


// TESTING GUTS
/** Run Audits in test framework */
describe('Running Lighthouse audits...\n', function () {
  this.timeout(config.timeoutOverall); // 5 minutes, in milliseconds
  let testData = [];

  before(function (done) {
    runEverything(config).then(data => {
      data.forEach(testResult => {
        testData.push(testResult.lhr);
      })
      done();
    });
  });

  after(function (done) {
    console.log('     done.')
    console.log('\n====================RESULTS====================\n')
    done();
  });

  it('Comparing test results to budget', () => {
    testData.forEach(site => {

      // Test this sites' overall score against config overall budget
      describe(`* ${site.requestedUrl}`, () => {
        this.timeout(config.timeoutPerSite)
        const overallScore = site.categories.performance.score * 100
        if (config.overall) {
          it('should pass overall score', () => {
            if (config.verbose) {
              console.log(`    Overall score: ${overallScore}\n`);
            }
            expect(overallScore).to.be.at.least(config.overall);
          })
        }

        // test this site against requested metric budgets
        Object.entries(config.budget).forEach(([budgetKey, budgetScore]) => {
          const audit = site.audits[budgetKey]
          const score = audit.score * 100
          // test against budget
          it(`should pass ${budgetKey} score`, () => {
            if (config.verbose) {
              console.log(`\n   ${budgetKey} score: ${score}\n`);
            }
            try {
              const result = expect(score).to.be.at.least(budgetScore)
              if (!result) {
              }
            } catch (error) {
              error.message += `\n      -- ${audit.description}`
              throw error
            }
          })
        })

      })

    })
  });
});
