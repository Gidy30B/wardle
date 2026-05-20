export type StatsDimensionType = 'specialty' | 'bodySystem' | 'difficulty';

export type StatsDimensionSummary = {
  key: string;
  label: string;
  casesCompleted: number;
  solved: number;
  missed: number;
  accuracyPct: number | null;
  averageAttempts: number | null;
  averageTimeSecs: number | null;
};

export type UserWeakAreaSummary = {
  type: StatsDimensionType;
  key: string;
  label: string;
  reason: string;
  casesCompleted: number;
  accuracyPct: number | null;
  priority: 'low' | 'medium' | 'high';
};

export type UserStatsReport = {
  totals: {
    casesCompleted: number;
    solved: number;
    missed: number;
    accuracyPct: number | null;
    averageAttempts: number | null;
    averageCluesUsed: number | null;
    averageTimeSecs: number | null;
  };
  progress: {
    xpTotal: number;
    level: number;
    rank: string;
    currentLevelXp: number;
    currentStreak: number;
    bestStreak: number;
  };
  bySpecialty: StatsDimensionSummary[];
  byBodySystem: StatsDimensionSummary[];
  byDifficulty: StatsDimensionSummary[];
  weakAreas: UserWeakAreaSummary[];
  recent: {
    lastPlayedAt: string | null;
    recentCompletedCases: number;
    recentAccuracyPct: number | null;
  };
};
