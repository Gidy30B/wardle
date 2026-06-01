import { EDITORIAL_PERMISSION_KEY } from '../../auth/editorial-permission.decorator';
import { AdminDiagnosisGraphController } from './admin-diagnosis-graph.controller';

function permissionFor(methodName: keyof AdminDiagnosisGraphController) {
  return Reflect.getMetadata(
    EDITORIAL_PERMISSION_KEY,
    AdminDiagnosisGraphController.prototype[methodName],
  );
}

describe('AdminDiagnosisGraphController editorial permissions', () => {
  it.each([
    'listCandidates',
    'getCandidate',
  ] as Array<keyof AdminDiagnosisGraphController>)(
    'marks %s as editor-level',
    (methodName) => {
      expect(permissionFor(methodName)).toBe('editor');
    },
  );

  it.each([
    'approveCandidate',
    'rejectCandidate',
    'mergeCandidate',
  ] as Array<keyof AdminDiagnosisGraphController>)(
    'marks %s as senior-editor-level',
    (methodName) => {
      expect(permissionFor(methodName)).toBe('senior');
    },
  );

  it('keeps smoke extraction admin-only', () => {
    expect(permissionFor('runSmokeExtraction')).toBeUndefined();
  });
});
