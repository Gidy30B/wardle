-- Delete all DailyCase records first (they reference Case, and GameSession/LeaderboardEntry cascade from DailyCase)
DELETE FROM "DailyCase";

-- Delete all Case records (cascades to CaseRevision, CaseValidationRun, CaseReview, HintContent, ExplanationContent, Attempt, GameSession)
DELETE FROM "Case";
