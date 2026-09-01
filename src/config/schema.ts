import { z } from 'zod';

export const APP_ENVS = ['development', 'staging', 'production'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export type LogLevel = (typeof LOG_LEVELS)[number];

const appEnvSchema = z.enum(APP_ENVS, {
  errorMap: (issue) => {
    if (issue.code === 'invalid_enum_value') {
      return {
        message: `Invalid app environment "${String(issue.received)}". Expected one of: ${APP_ENVS.join(', ')}`,
      };
    }
    return { message: issue.message ?? 'Invalid input' };
  },
});

const logLevelSchema = z.enum(LOG_LEVELS);

export const appConfigSchema = z.object({
  env: appEnvSchema,
  app: z.object({
    name: z.string().min(1, 'app.name must be a non-empty string'),
    port: z
      .number()
      .int('app.port must be an integer')
      .positive('app.port must be a positive integer')
      .max(65535, 'app.port must be a valid TCP port (1-65535)'),
    host: z.string().min(1, 'app.host must be a non-empty string'),
    logLevel: logLevelSchema,
  }),
  featureFlags: z.object({
    enableNewUI: z.boolean(),
    maintenanceMode: z.boolean(),
  }),
});

export type AppConfig = z.infer<typeof appConfigSchema>;
