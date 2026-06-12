/// <reference types="node" />

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUnsupportedClaimDeepLink,
  getClaimTarget,
  hasClaimTarget,
  normalizeWorkspaceTab,
} from './workspaceDeepLinks.ts';

describe('workspace deep links', () => {
  it('builds unsupported claim links to the clinical picture tab', () => {
    assert.equal(
      buildUnsupportedClaimDeepLink({
        targetUrl: '/editorial/diagnoses/dx-1',
        claimId: 'claim-1',
        sectionId: 'management',
        targetTab: 'education',
      }),
      '/editorial/diagnoses/dx-1?tab=clinical-picture&claimId=claim-1&sectionId=management',
    );
  });

  it('normalizes the clinical-picture alias to the existing education tab', () => {
    assert.equal(normalizeWorkspaceTab('clinical-picture'), 'education');
    assert.equal(normalizeWorkspaceTab('cases'), 'cases');
    assert.equal(normalizeWorkspaceTab('missing'), 'overview');
  });

  it('reads claim target params safely', () => {
    const target = getClaimTarget(
      new URLSearchParams('claimId=claim-1&sectionId=management'),
    );
    assert.deepEqual(target, {
      claimId: 'claim-1',
      sectionId: 'management',
    });
    assert.equal(hasClaimTarget(target), true);
    assert.equal(hasClaimTarget({ claimId: null, sectionId: null }), false);
  });
});
