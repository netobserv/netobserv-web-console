import '@testing-library/jest-dom';
import * as React from 'react';

// Mock i18n translation to return key
jest.mock('react-i18next', () => {
  return {
    useTranslation: () => {
      return {
        t: (s: string, ...args) => {
          if (args) {
            args.forEach(arg => {
              Object.keys(arg).forEach(key => {
                s = s.replace(`{{${key}}}`, arg[key]);
              });
            });
          }
          return s;
        }
      };
    }
  };
});

// Mock all console sdk components used here
jest.mock('@openshift-console/dynamic-plugin-sdk', () => {
  return {
    isModelFeatureFlag(e: never) {
      return null;
    },
    useResolvedExtensions: jest.fn(),
    useK8sWatchResource: jest.fn(() => [null, false, null]),
    useK8sModels: () => {
      return [{}, false];
    },
    ResourceIcon: () => {
      return <></>;
    },
    ResourceLink: () => {
      return <></>;
    }
  };
});

// Mock useLayoutEffect to useEffect
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  useLayoutEffect: jest.requireActual('react').useEffect
}));

// SpyOn localStorage setItem
jest.spyOn(window.localStorage.__proto__, 'setItem');

// Mock react-router
jest.mock('react-router', () => ({
  useNavigate: () => jest.fn(),
  useParams: () => ({}),
  Link: () => {
    return null;
  }
}));

// Mock @patternfly/react-charts/victory to use actual module
// This is needed because Jest has issues resolving the /victory subpath export
jest.mock('@patternfly/react-charts/victory', () => jest.requireActual('@patternfly/react-charts/victory'));

// Mock routes
jest.mock('./src/api/routes', () => ({
  getPods: jest.fn(async () => ['ABCD']),
  getNamespaces: jest.fn(async () => ['EFGH']),
  getConfig: jest.fn(async () => ({ portNaming: { enable: true, portNames: new Map() } })),
  getRole: jest.fn(async () => 'admin'),
  getLokiReady: jest.fn(async () => 'ready')
}));

global.console = {
  // console.log / warn / info / debug are ignored in tests
  log: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),

  // Keep native behaviour for error, and allow logging for debugging
  debug: console.log,
  error: console.error
};
