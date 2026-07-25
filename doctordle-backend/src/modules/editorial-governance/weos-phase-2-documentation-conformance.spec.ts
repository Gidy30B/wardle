import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  WEOS_ACTION_CATEGORIES,
  WEOS_CANONICAL_ACTIONS,
} from './canonical-actions';
import { WEOS_CANONICAL_LIFECYCLES } from './canonical-lifecycles';
import { WEOS_CANONICAL_TRANSITIONS } from './canonical-transitions';
import { WEOS_LEGACY_STATUS_CROSSWALK } from './legacy-status-crosswalk';

const phase2Docs = [
  {
    id: 'WEOS-IMP-002',
    file: 'WEOS-IMP-002-lifecycle-transition-specification.md',
  },
  {
    id: 'WEOS-IMP-003',
    file: 'WEOS-IMP-003-editorial-action-decision-catalogue.md',
  },
  {
    id: 'WEOS-IMP-004',
    file: 'WEOS-IMP-004-legacy-status-crosswalk.md',
  },
  {
    id: 'WEOS-IMP-005',
    file: 'WEOS-IMP-005-phase-2-open-decisions.md',
  },
] as const;

const docsRoot = join(process.cwd(), '..', 'docs', 'weos');

function readDoc(file: string) {
  return readFileSync(join(docsRoot, file), 'utf8');
}

describe('WEOS Phase 2 documentation conformance', () => {
  it('creates all four Phase 2 documents with required control metadata', () => {
    for (const doc of phase2Docs) {
      const path = join(docsRoot, doc.file);

      expect(existsSync(path)).toBe(true);

      const content = readDoc(doc.file);
      expect(content).toContain(`Document ID: \`${doc.id}\``);
      expect(content).toContain('Version: `0.1`');
      expect(content).toContain('Status: `Draft`');
      expect(content).toContain('Disposition: `REVIEW_REQUIRED`');
    }
  });

  it('contains required Phase 2 sections', () => {
    expect(
      readDoc('WEOS-IMP-002-lifecycle-transition-specification.md'),
    ).toContain('Phase 3 Preparation');
    expect(readDoc('WEOS-IMP-004-legacy-status-crosswalk.md')).toContain(
      'Unsafe Migration Summary',
    );
    expect(readDoc('WEOS-IMP-005-phase-2-open-decisions.md')).toContain(
      'Open Decisions',
    );
  });

  it('does not describe ambiguous legacy states as canonical approval or exposure', () => {
    const docs = phase2Docs.map((doc) => readDoc(doc.file)).join('\n');

    expect(docs).toContain('`VALIDATED` is not approval');
    expect(docs).toContain('`READY_TO_PUBLISH` is not approval');
    expect(docs).toContain('`PUBLISHED` is not immutable exposure');
  });

  it('documents required canonical distinctions', () => {
    const docs = phase2Docs.map((doc) => readDoc(doc.file)).join('\n');

    expect(docs).toContain(
      'Review Packet Snapshot is source context, not Governance Record',
    );
    expect(docs).toContain('Technical actor is not authority');
    expect(docs).toContain(
      'Historical validity is preserved even when standing is not inherited',
    );
  });

  it('keeps generated lifecycle and transition documentation synchronized', () => {
    const lifecycleDoc = readDoc(
      'WEOS-IMP-002-lifecycle-transition-specification.md',
    );

    for (const lifecycle of WEOS_CANONICAL_LIFECYCLES) {
      expect(lifecycleDoc).toContain(lifecycle.lifecycleFamily);
      for (const state of lifecycle.states) {
        expect(lifecycleDoc).toContain(state.key);
      }
    }

    for (const transition of WEOS_CANONICAL_TRANSITIONS) {
      expect(lifecycleDoc).toContain(transition.key);
    }
  });

  it('keeps generated action and decision documentation synchronized', () => {
    const actionDoc = readDoc(
      'WEOS-IMP-003-editorial-action-decision-catalogue.md',
    );
    const decisionActions = WEOS_CANONICAL_ACTIONS.filter(
      (action) => action.category === WEOS_ACTION_CATEGORIES.DECISION,
    );

    for (const action of WEOS_CANONICAL_ACTIONS) {
      expect(actionDoc).toContain(action.key);
    }
    for (const action of decisionActions) {
      expect(actionDoc).toContain(action.key);
      expect(actionDoc).toContain(`${action.decisionOutcome}`);
    }
  });

  it('keeps generated legacy crosswalk documentation synchronized', () => {
    const crosswalkDoc = readDoc('WEOS-IMP-004-legacy-status-crosswalk.md');

    for (const entry of WEOS_LEGACY_STATUS_CROSSWALK) {
      expect(crosswalkDoc).toContain(entry.sourcePath);
      expect(crosswalkDoc).toContain(entry.sourceEnumOrField);
      expect(crosswalkDoc).toContain(entry.sourceValue);
    }
  });
});
