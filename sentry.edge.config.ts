import * as Sentry from '@sentry/nextjs';
import { SENTRY_DSN, sentryEnabled, sentryBaseOptions } from '@/lib/sentryShared';

// Runtime edge. Sin DSN o fuera de producción queda deshabilitado.
Sentry.init({
  dsn: SENTRY_DSN,
  enabled: sentryEnabled,
  ...sentryBaseOptions,
});