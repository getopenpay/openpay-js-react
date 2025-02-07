import { z } from 'zod';

export const ApplePayCpm = z.object({
  provider: z.literal('apple_pay'),
  processor_name: z.literal('authorize_net'),
  metadata: z.object({
    processor_account_id: z.string(),
    processor_account_name: z.string(),
  }),
});
export type ApplePayCpm = z.infer<typeof ApplePayCpm>;

export const GooglePayCpm = z.object({
  provider: z.literal('google_pay'),
  processor_name: z.literal('authorize_net'),
  metadata: z.object({
    processor_account_id: z.string(),
    processor_account_name: z.string(),
    google_pay_merchant_id: z.string().nullish(),
  }),
});
export type GooglePayCpm = z.infer<typeof GooglePayCpm>;
