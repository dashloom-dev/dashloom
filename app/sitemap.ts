import type { MetadataRoute } from 'next';
import { siteConfig } from '../config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date('2026-08-25');
  return [
    { url: siteConfig.url, lastModified: updated, changeFrequency: 'weekly', priority: 1, alternates: { languages: { en: siteConfig.url, zh: `${siteConfig.url}/zh`, 'x-default': siteConfig.url } } },
    { url: `${siteConfig.url}/zh`, lastModified: updated, changeFrequency: 'weekly', priority: 0.8, alternates: { languages: { en: siteConfig.url, zh: `${siteConfig.url}/zh`, 'x-default': siteConfig.url } } },
    { url: `${siteConfig.url}/docs`, lastModified: updated, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteConfig.url}/pricing`, lastModified: updated, changeFrequency: 'monthly', priority: 0.7 },
  ];
}
