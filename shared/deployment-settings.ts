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
});

export type DeploymentSettings = z.infer<typeof deploymentSettingsSchema>;

export const deploymentSettingsPatchSchema = deploymentSettingsSchema.partial();

export type DeploymentSettingsPatch = z.infer<typeof deploymentSettingsPatchSchema>;

export type DeploymentSettingsPublic = DeploymentSettings & {
  openWebUiApiKey?: string;
  parentPin?: string;
  jwtSecret?: string;
};
