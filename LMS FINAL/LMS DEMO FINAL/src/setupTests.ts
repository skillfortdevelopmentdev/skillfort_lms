import '@testing-library/jest-dom';
import * as React from 'react';
import { TextEncoder, TextDecoder } from 'util';

if (typeof global.TextEncoder === 'undefined') {
  global.TextEncoder = TextEncoder as typeof global.TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
  global.TextDecoder = TextDecoder as typeof global.TextDecoder;
}

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

// Reset mocks before each test
beforeEach(() => {
  mockFetch.mockReset();
});

// Mock Recharts to bypass width-height element calculation issues in JSdom
jest.mock('recharts', () => {
  return {
    ResponsiveContainer: ({ children }: any) => React.createElement('div', { 'data-testid': 'charts-container' }, children),
    BarChart: ({ children }: any) => React.createElement('div', null, children),
    Bar: () => React.createElement('div'),
    XAxis: () => React.createElement('div'),
    YAxis: () => React.createElement('div'),
    CartesianGrid: () => React.createElement('div'),
    Tooltip: () => React.createElement('div'),
    PieChart: ({ children }: any) => React.createElement('div', null, children),
    Pie: ({ children }: any) => React.createElement('div', null, children),
    Cell: () => React.createElement('div')
  };
});

// Mock Vimeo Player
jest.mock('@vimeo/player', () => {
  const mockVimeoPlayerConstructor = jest.fn().mockImplementation(() => {
    return {
      on: jest.fn(),
      off: jest.fn(),
      getDuration: jest.fn().mockResolvedValue(600),
      getCurrentTime: jest.fn().mockResolvedValue(120),
      unload: jest.fn().mockResolvedValue(undefined),
    };
  });
  return {
    __esModule: true,
    default: mockVimeoPlayerConstructor
  };
});

// Mock motion/react so they render standard HTML tags in tests
jest.mock('motion/react', () => {
  const mockTags = ['div', 'button', 'span', 'section', 'h1', 'h2', 'h3', 'p', 'nav', 'li', 'ul', 'a'];
  const motionMock: any = {};
  
  mockTags.forEach(tag => {
    motionMock[tag] = ({ children, whileHover, whileTap, initial, animate, transition, exit, ...props }: any) => {
      return React.createElement(tag, props, children);
    };
  });

  return {
    motion: motionMock,
    AnimatePresence: ({ children }: any) => children
  };
});
