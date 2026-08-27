import type { MetadataRoute } from 'next';
import { siteConfig } from '../config/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const updated = new Date('2026-08-28');
  return [
    { url: `${siteConfig.url}/status`, lastModified: updated, changeFrequency: 'daily', priority: 0.4 },
    { url: `${siteConfig.url}/privacy`, lastModified: updated, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteConfig.url}/terms`, lastModified: updated, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
