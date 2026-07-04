/** Mirror of the harness run-store convention: '/' cannot appear in dirnames. */
export function modelDir(slug: string): string {
  return slug.replaceAll('/', '__')
}

/** Mirror of the vote-worker sample-id convention. */
export function sampleId(slug: string, promptId: string, sample: number): string {
  return `${slug}|${promptId}|${sample}`
}
