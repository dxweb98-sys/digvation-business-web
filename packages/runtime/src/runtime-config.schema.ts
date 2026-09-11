import { z } from 'zod';

const hexColorSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);

export const runtimeConfigSchema = z.object({
  apiBaseUrl: z.string().min(1),
  workspace: z.string().min(1),
  locale: z.string().min(2),
  currency: z.string().regex(/^[A-Z]{3}$/),
  defaultCountry: z.string().regex(/^[A-Z]{2}$/),
  deploymentProfile: z.enum(['SHARED', 'BUSINESS_ISOLATED', 'DEDICATED']),
  applications: z.object({
    cashier: z.boolean(),
    backoffice: z.boolean(),
  }),
  effectiveEntitlements: z.object({
    products: z.array(z.enum(['POS'])),
    capabilities: z.array(z.enum(['FINANCE_OPERATIONS', 'BUSINESS_ANALYTICS'])),
  }),
  branding: z.object({
    mode: z.enum(['DIGVATION_DEFAULT', 'WHITE_LABEL']),
    productName: z.string().min(1),
    companyName: z.string().min(1).optional(),
    businessName: z.string().min(1).optional(),
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
  capabilities: z.object({
    notifications: z.boolean(),
    fulfillment: z.boolean(),
    customers: z.boolean(),
    loyalty: z.boolean(),
  }),
});
