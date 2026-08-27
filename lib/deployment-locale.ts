import { env } from 'cloudflare:workers';
import { parseDeploymentLocale } from './deployment-locale-value';

export function getDeploymentLocale() {
  const value = (env as unknown as { DASHLOOM_DEFAULT_LOCALE?: string }).DASHLOOM_DEFAULT_LOCALE;
  return parseDeploymentLocale(value);
}
