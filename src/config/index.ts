import { APP_ENVS, LOG_LEVELS, appConfigSchema } from './schema.js';
import type { AppConfig, AppEnv, LogLevel } from './schema.js';

export { APP_ENVS, LOG_LEVELS, appConfigSchema } from './schema.js';
export type { AppConfig, AppEnv, LogLevel } from './schema.js';

export type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends Record<string, unknown> ? DeepPartial<T[K]> : T[K];
};

const DEFAULT_NAME = 'app-config';
const DEFAULT_HOST = '0.0.0.0';
const DEFAULT_PORT = 3000;

const DEFAULT_LOG_LEVEL: Record<AppEnv, LogLevel> = {
  development: 'debug',
  staging: 'info',
  production: 'info',
};

const DEFAULT_FEATURE_FLAGS = {
  enableNewUI: false,
  maintenanceMode: false,
} as const;

const TRUTHY_VALUES = new Set(['true', '1', 'yes']);
const FALSY_VALUES = new Set(['false', '0', 'no']);

let cachedConfig: Readonly<AppConfig> | undefined;

function envVar(name: string): string | undefined {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? undefined : value.trim();
}

function resolveEnv(): AppEnv {
  const raw = envVar('APP_ENV') ?? envVar('NODE_ENV');
  if (raw === undefined || raw === 'test') {
    return 'development';
  }
  const parsed = appConfigSchema.shape.env.safeParse(raw.toLowerCase());
  if (!parsed.success) {
    throw new Error(
      parsed.error.issues[0]?.message ??
        `Invalid APP_ENV value "${raw}". Expected one of: ${APP_ENVS.join(', ')}`,
    );
  }
  return parsed.data;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  const normalized = value.toLowerCase();
  if (TRUTHY_VALUES.has(normalized)) {
    return true;
  }
  if (FALSY_VALUES.has(normalized)) {
    return false;
  }
  return fallback;
}

function parsePort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_PORT;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error(
      `Invalid APP_PORT "${value}". Expected a positive integer between 1 and 65535.`,
    );
  }
  const port = Number(value);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `Invalid APP_PORT "${value}". Expected a positive integer between 1 and 65535.`,
    );
  }
  return port;
}

function parseLogLevel(value: string | undefined, env: AppEnv): LogLevel {
  if (value === undefined) {
    return DEFAULT_LOG_LEVEL[env];
  }
  const normalized = value.toLowerCase();
  return (LOG_LEVELS as readonly string[]).includes(normalized)
    ? (normalized as LogLevel)
    : DEFAULT_LOG_LEVEL[env];
}

function buildConfigFromEnv(): AppConfig {
  const env = resolveEnv();
  return {
    env,
    app: {
      name: envVar('APP_NAME') ?? DEFAULT_NAME,
      port: parsePort(envVar('APP_PORT')),
      host: envVar('APP_HOST') ?? DEFAULT_HOST,
      logLevel: parseLogLevel(envVar('LOG_LEVEL'), env),
    },
    featureFlags: {
      enableNewUI: parseBoolean(envVar('FEATURE_ENABLE_NEW_UI'), DEFAULT_FEATURE_FLAGS.enableNewUI),
      maintenanceMode: parseBoolean(
        envVar('FEATURE_MAINTENANCE_MODE'),
        DEFAULT_FEATURE_FLAGS.maintenanceMode,
      ),
    },
  };
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, overrides: DeepPartial<T>): T {
  const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, override] of Object.entries(overrides as Record<string, unknown>)) {
    if (override === undefined) {
      continue;
    }
    const baseValue = (base as Record<string, unknown>)[key];
    if (isPlainObject(override) && isPlainObject(baseValue)) {
      result[key] = deepMerge(baseValue, override);
    } else {
      result[key] = override;
    }
  }
  return result as T;
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (isPlainObject(value)) {
    for (const entry of Object.values(value)) {
      deepFreeze(entry);
    }
    return Object.freeze(value);
  }
  return value;
}

export function loadConfig(overrides?: DeepPartial<AppConfig>): Readonly<AppConfig> {
  const base = buildConfigFromEnv();
  const merged = overrides === undefined ? base : deepMerge(base, overrides);
  const parsed = appConfigSchema.parse(merged);
  const config = deepFreeze(parsed);
  cachedConfig = config;
  return config;
}

export function getConfig(): Readonly<AppConfig> {
  cachedConfig ??= loadConfig();
  return cachedConfig;
}

export function isFeatureEnabled(name: keyof AppConfig['featureFlags']): boolean {
  return getConfig().featureFlags[name] === true;
}
