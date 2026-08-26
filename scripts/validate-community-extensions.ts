import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateCommunityReview, validateCommunitySubmission } from '../lib/community-extension.ts';

const root = path.resolve('extensions/community');
const entries = await readdir(root, { withFileTypes: true });
let checked = 0;
for (const entry of entries.filter((item) => item.isDirectory()).sort((left, right) => left.name.localeCompare(right.name))) {
  const directory = path.join(root, entry.name); const submissionPath = path.join(directory, 'submission.json');
  try {
    const submission = validateCommunitySubmission(JSON.parse(await readFile(submissionPath, 'utf8')));
    if (submission.manifest.slug !== entry.name) throw new Error('Directory name must equal manifest.slug.');
    try { validateCommunityReview(submission, JSON.parse(await readFile(path.join(directory, 'review.json'), 'utf8'))); } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; }
    checked += 1;
  } catch (error) { console.error(`${entry.name}: ${error instanceof Error ? error.message : String(error)}`); process.exitCode = 1; }
}
if (!process.exitCode) console.log(`Validated ${checked} community extension submission${checked === 1 ? '' : 's'}.`);
