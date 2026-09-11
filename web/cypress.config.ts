import { defineConfig } from "cypress";
// eslint-disable-next-line @typescript-eslint/no-var-requires
const cypressGrepPlugin = require('@cypress/grep/src/plugin');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require('path');

export default defineConfig({
  viewportWidth: 1920,
  viewportHeight: 1080,
  defaultCommandTimeout: 30000,
  projectId: "tjknpb",
  screenshotsFolder: './gui_test_screenshots/cypress/screenshots',
  screenshotOnRunFailure: true,
  trashAssetsBeforeRuns: true,
  videosFolder: './gui_test_screenshots/cypress/videos',
  video: true,
  videoCompression: false,
  reporter: './node_modules/cypress-multi-reporters',
  reporterOptions: {
    configFile: 'reporter-config.json',
  },
  fixturesFolder: 'cypress/fixtures',
  env: {
    grepFilterSpecs: true,
    ...(process.env.IS_OPENSHIFT === 'true' && {
      'LOGIN_USERNAME': process.env.CYPRESS_LOGIN_USERS!.split(',')[0].split(':')[0],
      'LOGIN_PASSWORD': process.env.CYPRESS_LOGIN_USERS!.split(',')[0].split(':')[1],
      'NOO_CS_IMAGE': process.env.MULTISTAGE_PARAM_OVERRIDE_CYPRESS_NOO_CS_IMAGE,
    }),
  },

  e2e: {
    baseUrl: process.env.CYPRESS_BASE_URL || 'http://localhost:9001',
    testIsolation: false,
    experimentalMemoryManagement: true,
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      require("./cypress/plugins/index.js")(on, config);
      config = cypressGrepPlugin(config);
      on('before:browser:launch', (browser = {
        name: "",
        family: "chromium",
        channel: "",
        displayName: "",
        version: "",
        majorVersion: "",
        path: "",
        isHeaded: false,
        isHeadless: false
      }, launchOptions) => {
        if (browser.family === 'chromium' && browser.name !== 'electron') {
          // auto open devtools
          launchOptions.args.push('--enable-precise-memory-info')
        }

        return launchOptions

      });
      // `on` is used to hook into various events Cypress emits
      on('task', {
        log(message) {
          console.log(message);
          return null;
        },
        logError(message) {
          console.error(message);
          return null;
        },
        logTable(data) {
          console.table(data);
          return null;
        },
        readFileIfExists(filename) {
          if (fs.existsSync(filename)) {
            return fs.readFileSync(filename, 'utf8');
          }
          return null;
        },
        listDownloadsByExtension({ dir, extension }) {
          if (!fs.existsSync(dir)) {
            return [];
          }
          return fs.readdirSync(dir).filter((file: string) => file.endsWith(`.${extension}`));
        },
        renameDownload({ from, to }) {
          fs.renameSync(from, to);
          return null;
        },
        deleteDownload(filePath) {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          return null;
        },
      });
      on('after:screenshot', (details) => {
        // Prepend "1_", "2_", etc. to screenshot filenames because they are sorted alphanumerically in CI's artifacts dir
        const pathObj = path.parse(details.path);
        fs.readdir(pathObj.dir, (error, files) => {
          const newPath = `${pathObj.dir}${path.sep}${files.length}_${pathObj.base}`;
          return new Promise((resolve, reject) => {
            // eslint-disable-next-line consistent-return
            fs.rename(details.path, newPath, (err) => {
              if (err) return reject(err);
              // because we renamed and moved the image, resolve with the new path
              // so it is accurate in the test results
              resolve({ path: newPath });
            });
          });
        });
      });
      on(
        'after:spec',
        (spec: Cypress.Spec, results: CypressCommandLine.RunResult) => {
          if (results && results.video) {
            // Do we have failures for any retry attempts?
            const failures = results.tests.some((test) =>
              test.attempts.some((attempt) => attempt.state === 'failed')
            )
            if (!failures && fs.existsSync(results.video)) {
              // delete the video if the spec passed and no tests retried
              fs.unlinkSync(results.video)
            }
          }
        }
      );
      return config;
    },
    specPattern: "cypress/{e2e,integration-tests}/**/*{.cy,.spec}.{js,jsx,ts,tsx}",
  },
  numTestsKeptInMemory: 5,
  // required for guidedTour to not pop when running with cypress.
  userAgent: 'ConsoleIntegrationTestEnvironment'
});
