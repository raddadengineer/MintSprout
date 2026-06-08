import { z } from "zod";

export const DEPLOYMENT_SETTINGS_KEY = "deployment";

export const deploymentSettingsSchema = z.object({
  aiCoachEnabled: z.boolean().optional(),
  openWebUiBaseUrl: z.string().optional(),
  openWebUiApiKey: z.string().optional(),
  openWebUiModel: z.string().optional(),
  ollamaBaseUrl: z.string().optional(),
  ollamaModel: z.string().optional(),
  kidsVoiceBaseUrl: z.string().optional(),
  kidsVoiceModel: z.string().optional(),
  aiVoiceYoungest: z.string().optional(),
  aiVoiceYounger: z.string().optional(),
  aiVoiceOlder: z.string().optional(),
  kioskMode: z.boolean().optional(),
  parentPin: z.string().optional(),
  kioskFamilyId: z.number().int().positive().optional(),
  jwtSecret: z.string().min(16).optional(),
  backupScheduleEnabled: z.boolean().optional(),
  backupDailyEnabled: z.boolean().optional(),
  backupWeeklyEnabled: z.boolean().optional(),
  backupDailyUtcHour: z.number().int().min(0).max(23).optional(),
  backupWeeklyUtcDay: z.number().int().min(0).max(6).optional(),
  backupWeeklyUtcHour: z.number().int().min(0).max(23).optional(),
  backupDailyRetentionDays: z.number().int().min(1).max(365).optional(),
  backupWeeklyRetentionWeeks: z.number().int().min(1).max(52).optional(),
  backupLastDailyAt: z.string().optional(),
  backupLastWeeklyAt: z.string().optional(),
  backupLastDailyError: z.string().optional(),
  backupLastWeeklyError: z.string().optional(),
});

export type DeploymentSettings = z.infer<typeof deploymentSettingsSchema>;

export const deploymentSettingsPatchSchema = deploymentSettingsSchema
  .partial()
  .omit({
    backupLastDailyAt: true,
    backupLastWeeklyAt: true,
    backupLastDailyError: true,
    backupLastWeeklyError: true,
  });

export type DeploymentSettingsPatch = z.infer<typeof deploymentSettingsPatchSchema>;

export type DeploymentSettingsPublic = DeploymentSettings & {
  openWebUiApiKey?: string;
  parentPin?: string;
  jwtSecret?: string;
};
