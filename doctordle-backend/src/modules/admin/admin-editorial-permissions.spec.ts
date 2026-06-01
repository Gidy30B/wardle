import { EDITORIAL_PERMISSION_KEY } from '../../auth/editorial-permission.decorator';
import { AdminController } from './admin.controller';

function permissionFor(methodName: keyof AdminController) {
  return Reflect.getMetadata(
    EDITORIAL_PERMISSION_KEY,
    AdminController.prototype[methodName],
  );
}

describe('AdminController editorial permissions', () => {
  it.each([
    'getFullDiagnosisEditorialWorkspace',
    'searchDiagnosisRegistry',
    'generateDiagnosisTeachingRules',
    'generateTargetedCase',
    'linkDiagnosisToCase',
  ] as Array<keyof AdminController>)(
    'marks %s as editor-level',
    (methodName) => {
      expect(permissionFor(methodName)).toBe('editor');
    },
  );

  it.each([
    'reviewTeachingRule',
    'reviewDiagnosisEditorialBrief',
    'submitReview',
    'markReadyToPublish',
  ] as Array<keyof AdminController>)(
    'marks %s as senior-editor-level',
    (methodName) => {
      expect(permissionFor(methodName)).toBe('senior');
    },
  );

  it.each([
    'generateCases',
    'createDiagnosisRegistry',
    'addDiagnosisAlias',
  ] as Array<keyof AdminController>)(
    'keeps %s admin-only',
    (methodName) => {
      expect(permissionFor(methodName)).toBeUndefined();
    },
  );
});
