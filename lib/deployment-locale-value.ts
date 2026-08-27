export type DashloomLocale = 'en' | 'zh';

export function parseDeploymentLocale(value?: string | null): DashloomLocale {
  const normalized = value?.trim().toLowerCase();
  if (!normalized || normalized === 'en' || normalized === 'en-us') return 'en';
  if (normalized === 'zh' || normalized === 'zh-cn') return 'zh';
  throw new Error('DASHLOOM_DEFAULT_LOCALE must be en or zh-CN.');
}

export function localeLanguageTag(locale: DashloomLocale) {
  return locale === 'zh' ? 'zh-CN' : 'en';
}
