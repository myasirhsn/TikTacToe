import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getConfig, isFeatureEnabled, loadConfig } from './index.js';
import type { AppConfig } from './index.js';

const CONFIG_ENV_KEYS = [
  'APP_ENV',
  'NODE_ENV',
  'APP_NAME',
  'APP_PORT',
  'APP_HOST',
  'LOG_LEVEL',
  'FEATURE_ENABLE_NEW_UI',
  'FEATURE_MAINTENANCE_MODE',
] as const;

const originalEnv: Record<string, string | undefined> = {};

function setEnv(values: Partial<Record<(typeof CONFIG_ENV_KEYS)[number], string>>): void {
  for (const key of CONFIG_ENV_KEYS) {
    delete process.env[key];
  }
  for (const [key, value] of Object.entries(values)) {
    process.env[key] = value;
  }
}

beforeEach(() => {
  for (const key of CONFIG_ENV_KEYS) {
    originalEnv[key] = process.env[key];
  }
  setEnv({ NODE_ENV: 'development' });
});

afterEach(() => {
  for (const key of CONFIG_ENV_KEYS) {
    if (originalEnv[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = originalEnv[key];
    }
  }
});

describe('defaults per environment', () => {
  it('loads development defaults when nothing is configured', () => {
    const config = loadConfig();
    expect(config).toEqual({
      env: 'development',
      app: {
        name: 'app-config',
        port: 3000,
        host: '0.0.0.0',
        logLevel: 'debug',
      },
      featureFlags: {
        enableNewUI: false,
        maintenanceMode: false,
      },
    });
  });

  it('uses NODE_ENV for env selection and info log level outside development', () => {
    setEnv({ NODE_ENV: 'staging' });
    const config = loadConfig();
    expect(config.env).toBe('staging');
    expect(config.app.logLevel).toBe('info');

    setEnv({ NODE_ENV: 'production' });
    expect(loadConfig().env).toBe('production');
    expect(loadConfig().app.logLevel).toBe('info');
  });

  it('prefers APP_ENV over NODE_ENV', () => {
    setEnv({ APP_ENV: 'production', NODE_ENV: 'development' });
    const config = loadConfig();
    expect(config.env).toBe('production');
  });
});

describe('env overrides', () => {
  it('maps every supported env var into the config', () => {
    setEnv({
      APP_ENV: 'production',
      APP_NAME: 'paperclip-api',
      APP_PORT: '8080',
      APP_HOST: '127.0.0.1',
      LOG_LEVEL: 'warn',
      FEATURE_ENABLE_NEW_UI: 'true',
      FEATURE_MAINTENANCE_MODE: '1',
    });
    const config = loadConfig();
    expect(config).toEqual({
      env: 'production',
      app: {
        name: 'paperclip-api',
        port: 8080,
        host: '127.0.0.1',
        logLevel: 'warn',
      },
      featureFlags: {
        enableNewUI: true,
        maintenanceMode: true,
      },
    });
  });
});

describe('boolean parsing', () => {
  it.each([
    ['true', true],
    ['1', true],
    ['yes', true],
    ['TRUE', true],
    ['false', false],
    ['0', false],
    ['no', false],
    ['NO', false],
  ] as const)('parses "%s" as %s', (raw, expected) => {
    setEnv({ FEATURE_ENABLE_NEW_UI: raw });
    expect(loadConfig().featureFlags.enableNewUI).toBe(expected);
  });

  it('falls back to the default for invalid boolean values', () => {
    setEnv({ FEATURE_ENABLE_NEW_UI: 'maybe', FEATURE_MAINTENANCE_MODE: 'enabled' });
    const config = loadConfig();
    expect(config.featureFlags.enableNewUI).toBe(false);
    expect(config.featureFlags.maintenanceMode).toBe(false);
  });

  it('falls back to the default for an empty boolean value', () => {
    setEnv({ FEATURE_ENABLE_NEW_UI: '' });
    expect(loadConfig().featureFlags.enableNewUI).toBe(false);
  });
});

describe('schema validation failures', () => {
  it('raises a descriptive error for an invalid APP_ENV', () => {
    setEnv({ APP_ENV: 'production-2' });
    expect(() => loadConfig()).toThrow(/APP_ENV|environment|development, staging, production/);
  });

  it('raises a descriptive error for a non-numeric APP_PORT', () => {
    setEnv({ APP_PORT: 'abc' });
    expect(() => loadConfig()).toThrow(/Invalid APP_PORT "abc"/);
  });

  it('raises a descriptive error for an out-of-range APP_PORT', () => {
    setEnv({ APP_PORT: '70000' });
    expect(() => loadConfig()).toThrow(/Invalid APP_PORT "70000"/);
  });

  it('raises a descriptive error for a zero APP_PORT', () => {
    setEnv({ APP_PORT: '0' });
    expect(() => loadConfig()).toThrow(/Invalid APP_PORT "0"/);
  });

  it('validates invalid overrides through zod', () => {
    expect(() => loadConfig({ app: { port: -1 } })).toThrow(/app\.port/);
  });
});

describe('deep freeze', () => {
  it('returns a deeply frozen config', () => {
    const config = loadConfig();
    expect(Object.isFrozen(config)).toBe(true);
    expect(Object.isFrozen(config.app)).toBe(true);
    expect(Object.isFrozen(config.featureFlags)).toBe(true);
  });

  it('rejects runtime mutation of the frozen config', () => {
    const config = loadConfig();
    expect(() => {
      (config as AppConfig).app.port = 9999;
    }).toThrow();
  });
});

describe('overrides', () => {
  it('merges overrides deeply while keeping env-driven defaults', () => {
    setEnv({ APP_ENV: 'staging', LOG_LEVEL: 'debug' });
    const config = loadConfig({ app: { port: 8080 }, featureFlags: { enableNewUI: true } });
    expect(config.env).toBe('staging');
    expect(config.app.port).toBe(8080);
    expect(config.app.name).toBe('app-config');
    expect(config.app.logLevel).toBe('debug');
    expect(config.featureFlags.enableNewUI).toBe(true);
    expect(config.featureFlags.maintenanceMode).toBe(false);
  });
});

describe('public API', () => {
  it('getConfig returns the cached config', () => {
    const first = loadConfig({ app: { port: 9090 } });
    expect(getConfig()).toBe(first);
    expect(getConfig().app.port).toBe(9090);
  });

  it('isFeatureEnabled reflects known flags', () => {
    loadConfig({ featureFlags: { enableNewUI: true } });
    expect(isFeatureEnabled('enableNewUI')).toBe(true);
    expect(isFeatureEnabled('maintenanceMode')).toBe(false);
  });

  it('isFeatureEnabled returns false for unknown flags', () => {
    loadConfig();
    expect(isFeatureEnabled('nope' as keyof AppConfig['featureFlags'])).toBe(false);
  });

  it('loadConfig uses a reasonable default log level for invalid LOG_LEVEL', () => {
    setEnv({ LOG_LEVEL: 'verbose' });
    expect(loadConfig().app.logLevel).toBe('debug');
  });
});
