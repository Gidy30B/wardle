import { EDITORIAL_PERMISSION_KEY } from '../../auth/editorial-permission.decorator';
import { AdminEducationController } from './admin-education.controller';

function permissionFor(methodName: keyof AdminEducationController) {
  return Reflect.getMetadata(
    EDITORIAL_PERMISSION_KEY,
    AdminEducationController.prototype[methodName],
  );
}

describe('AdminEducationController editorial permissions', () => {
  it.each([
    'getDiagnosisEducation',
    'generateDiagnosisEducationDraft',
    'regenerateDiagnosisEducationSection',
    'updateDiagnosisEducation',
    'listDiagnosisEducationRevisions',
  ] as Array<keyof AdminEducationController>)(
    'marks %s as editor-level',
    (methodName) => {
      expect(permissionFor(methodName)).toBe('editor');
    },
  );

  it('marks education review/publish actions as senior-editor-level', () => {
    expect(permissionFor('reviewDiagnosisEducation')).toBe('senior');
  });
});
