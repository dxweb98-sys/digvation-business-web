import { z } from 'zod';

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const apiBaseUrlSchema = z
  .string()
  .refine(
    (value) => value === '' || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value),
    'apiBaseUrl must be empty for same-origin or an absolute HTTP(S) origin',
  );

const workspaceResolutionSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('FIXED'),
    workspace: z.string().min(1),
  }),
  z.object({
    mode: z.literal('LOGIN'),
    defaultWorkspace: z.string().min(1).optional(),
  }),
]);

export const runtimeConfigSchema = z.object({
  apiBaseUrl: apiBaseUrlSchema,
  deploymentProfile: z.enum(['SHARED', 'BUSINESS_ISOLATED', 'DEDICATED']),
  workspaceResolution: workspaceResolutionSchema,
  applications: z.object({
    operational: z.boolean(),
    backoffice: z.boolean(),
  }),
  branding: z.object({
    mode: z.enum(['DIGVATION_DEFAULT', 'WHITE_LABEL']),
    productName: z.string().min(1),
    companyName: z.string().min(1).optional(),
    logoUrl: z.string().min(1).optional(),
  }),
  theme: z.object({
    preset: z.enum(['DIGVATION_LIGHT', 'CUSTOM']),
    radius: z.enum(['COMPACT', 'SOFT', 'ROUNDED']),
    colors: z
      .object({
        background: hexColorSchema.optional(),
        surface: hexColorSchema.optional(),
        surfaceMuted: hexColorSchema.optional(),
        text: hexColorSchema.optional(),
        textMuted: hexColorSchema.optional(),
        border: hexColorSchema.optional(),
        brand: hexColorSchema.optional(),
        focus: hexColorSchema.optional(),
        accentYellow: hexColorSchema.optional(),
        accentMint: hexColorSchema.optional(),
        accentSky: hexColorSchema.optional(),
        accentLavender: hexColorSchema.optional(),
        accentCoral: hexColorSchema.optional(),
      })
      .optional(),
  }),
  defaults: z.object({
    locale: z.enum(['id-ID', 'en-US']),
    country: z.string().regex(/^[A-Z]{2}$/),
  }),
});
