#!/usr/bin/env node

const path = require('path');
const {
  expect
} = require('chai');
const lighthouse = require('lighthouse');
const chromeLauncher = require('chrome-launcher');
// const perfConfig = require('lighthouse/lighthouse-core/config/perf-config');
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

const chromeLauncherOpts = {
  chromeFlags: ['--headless'],
  // logLevel: 'info'
}
const lighthouseOpts = {
  onlyCategories: ['performance']
};

// default config
let config = Object.assign({
  verbose: false,
  showAvailableMetrics: false,
  overall: 90,
}, package.perfomatic);

console.log('config', config)

// run in localhost or travis only
console.log('\nPreparing Perfomatic tests for Lighthouse...');

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

function printFeedback(helpData) {
  if (helpData.length > 0) {
    console.log('\n');
    helpData.forEach(help => console.log(`HELP (${help.key}): ${help.msg} \n`));
  }
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

describe('Running Lighthouse audits...\n', function () {
  this.timeout(30000);
  let testData = [];
  var helpData = [];

  before(function (done) {
    runEverything(config).then(data => {
      data.forEach(testResult => {
        testData.push(testResult.lhr);
      })
      done();
    });
  });

  after(function (done) {
    printFeedback(helpData);
    console.log('     done.')
    console.log('\n==========RESULTS==========\n')
    done();
  });

  it('Comparing test results to budget', () => {
    testData.forEach(site => {

      // Test this sites' overall score against config overall budget
      describe(`${site.requestedUrl}`, () => {
        after(() => {
        })
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
          // test against budget
          it(`should pass ${budgetKey} score`, () => {
            if (config.verbose) {
              console.log(`\n   ${budgetKey} score: ${overallScore}\n`);
            }
            expect(audit.score * 100).to.be.at.least(budgetScore)
          })
        })

      })

    })
    // Object.entries(testData.audits).forEach(([key, value]) => {
    //   // console.log('key,value', key, value)
    //   describe(`${testData.requestedUrl}`, () => {
    //     if (config.overall) {
    //       it('should pass overall score', () => {
    //         if (config.verbose) {
    //           console.log(`   Overall score: ${value.score}\n`);
    //         }
    //         expect(value.score).to.be.at.least(config.overall);
    //       })
    //     }
    // run tests against all budget metrics
    // Object.keys(config.budget).forEach(key => {
    //   if (config.showAvailableMetrics) {
    //     console.log('pageData.audits[key]', pageData.audits[key]);
    //     const metrics = Object.keys(pageData.audits).map(key => {
    //       console.log(`${key}: ${pageData.audits[key].scoringMode}`);
    //     });
    //   }
    //   it(`should pass ${key} score`, () => {
    //     try {
    //       if (config.verbose) {
    //         console.log(`   ${key} score: ${pageData.audits[key].score}`);
    //         console.log(`   ${key} time: ${pageData.audits[key].displayValue}\n`);
    //       }
    //       if (pageData.audits[key].scoringMode === 'numeric') {
    //         // numeric scoring mode
    //         const feedback = expect(pageData.audits[key].score).to.be.at.least(config.budget[key]);
    //       } else {
    //         // binary scoring mode
    //         const feedback = expect(pageData.audits[key].score).to.be.equal(config.budget[key]);
    //       }
    //     } catch (err) {
    //       // save helpful msgs until after the tests
    //       const help = {
    //         key: key,
    //         msg: pageData.audits[key].helpText
    //       }
    //       if (config.verbose) {
    //         console.log(`   HELP (${help.key}): ${help.msg} \n`);
    //       }
    //       throw err;
    //     }
    //   });
    // });
    // });
    // })
  });
});
