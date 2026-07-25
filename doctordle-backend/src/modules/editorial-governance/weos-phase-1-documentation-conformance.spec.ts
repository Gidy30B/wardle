import { readFileSync } from 'node:fs';
import { join } from 'node:path';

describe('WEOS Phase 1 documentation conformance', () => {
  it('keeps repository absence claims scoped to inspected implementation evidence', () => {
    const docs = [
      join(
        process.cwd(),
        '..',
        'docs',
        'weos',
        'WEOS-IMP-001-current-to-canonical-mapping.md',
      ),
      join(
        process.cwd(),
        '..',
        'docs',
        'weos',
        'WEOS-IMP-001-divergence-register.md',
      ),
    ]
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    expect(docs).not.toContain('No first-class model found');
    expect(docs).not.toContain('No first-class models found');
    expect(docs).not.toContain('no first-class source model found');
    expect(docs).toContain(
      'Repository absence does not prove absence from external operational/manual governance processes.',
    );
  });
});
