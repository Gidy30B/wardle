# WEOS Authority Assignments

Stage 1 defines repository-native contracts only. These files are not Prisma models, database persistence, runtime services, real grants or production enforcement.

Runtime role is technical access evidence only and never canonical authority. A governed action requires a valid, active, independently validated `AuthorityAssignment` under an approved authority-type policy.

The production authority-type registry is intentionally empty. Registry presence alone is not approval; only an approved authority-type definition can validate an operational assignment. The production assignment collection is also intentionally empty. No production `AuthorityAssignment` exists in this repository.

Assignment references in actor command context are unresolved claims until resolution checks them against actual assignment records, status, scope, evidence, delegation and separation-of-duties policy. Test-only assignment records and authority types may appear only in conformance tests.

The contracts preserve compatibility with WEOS-OD-018 by producing authority evidence fields such as `authorityAssignmentId`, `authorityEvidenceReference`, `authorityScopeSnapshot` and `authorityResolvedAt` when pure resolution succeeds.

Bootstrap authority is not converted into a production assignment. Absence of an assignment is neither approval nor rejection; unknown historical authority remains unknown.
