export const NotificationType = {
  RewardXpAwarded: 'reward.xp_awarded',
  LearningExplanationReady: 'learning.explanation_ready',
  LearningWeeklyDigest: 'learning.weekly_digest',
  StreakReminder: 'streak.reminder',
  StreakMilestone: 'streak.milestone',
  GameplayDailyCaseAvailable: 'gameplay.daily_case_available',
  LeaderboardRankChanged: 'leaderboard.rank_changed',
  LeaderboardWeeklySummary: 'leaderboard.weekly_summary',
  ContentProductAnnouncement: 'content.product_announcement',
  SystemPushTest: 'system.push_test',
} as const;

export type NotificationTypeValue =
  (typeof NotificationType)[keyof typeof NotificationType];
