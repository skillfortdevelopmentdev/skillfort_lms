import { validateProductionEnvironment } from '../startupValidation';

describe('validateProductionEnvironment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('does not throw in development without secrets', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.JWT_SECRET;
    delete process.env.DATABASE_URL;
    delete process.env.APP_URL;
    expect(() => validateProductionEnvironment()).not.toThrow();
  });

  test('throws in production when JWT_SECRET missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.APP_URL = 'http://localhost:3000';
    delete process.env.JWT_SECRET;

    expect(() => validateProductionEnvironment()).toThrow(/JWT_SECRET/);
  });

  test('passes in production when all required vars set', () => {
    process.env.NODE_ENV = 'production';
    process.env.JWT_SECRET = 'test-secret';
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.APP_URL = 'https://lms.example.com';

    expect(() => validateProductionEnvironment()).not.toThrow();
  });
});
