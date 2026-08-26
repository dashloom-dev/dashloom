import type { MetadataRoute } from 'next';
import { siteConfig } from '../config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date('2026-08-26');
  return [
    { url: siteConfig.url, lastModified: updated, changeFrequency: 'weekly', priority: 1, alternates: { languages: { en: siteConfig.url, zh: `${siteConfig.url}/zh`, 'x-default': siteConfig.url } } },
    { url: `${siteConfig.url}/zh`, lastModified: updated, changeFrequency: 'weekly', priority: 0.8, alternates: { languages: { en: siteConfig.url, zh: `${siteConfig.url}/zh`, 'x-default': siteConfig.url } } },
    { url: `${siteConfig.url}/docs`, lastModified: updated, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteConfig.url}/status`, lastModified: updated, changeFrequency: 'daily', priority: 0.4 },
    { url: `${siteConfig.url}/privacy`, lastModified: updated, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteConfig.url}/terms`, lastModified: updated, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
