import type { Config } from 'jest';

const config: Config = {
  verbose: true,
  collectCoverage: true,
  coverageReporters: [
    "cobertura"
  ],
  maxWorkers: 1,
  globals: {
  },
  setupFiles: [
    "<rootDir>/jest.setup.ts"
  ],
  setupFilesAfterEnv: [
    "<rootDir>setup-tests.tsx"
  ],
  preset: "ts-jest",
  moduleFileExtensions: [
    "js",
    "jsx",
    "ts",
    "tsx"
  ],
  modulePathIgnorePatterns: [
    "cypress"
  ],
  moduleNameMapper: {
    "\\.(s?css|less)$": "<rootDir>/pluginToStandaloneMapper/mapper.tsx",
    "^@console/.*$": "<rootDir>/pluginToStandaloneMapper/mapper.tsx"
  },
  testEnvironment: 'jsdom',
  transform: {
    "^.+\\.[t|j]sx?$": "ts-jest"
  },
  transformIgnorePatterns: [
    "<rootDir>/node_modules/(?!(@patternfly|@openshift-console|@spice-project|d3.*|internmap|delaunator|robust-predicates\\S*?)/.*)"
  ],
  resolver: "ts-jest-resolver"
};

export default config;
