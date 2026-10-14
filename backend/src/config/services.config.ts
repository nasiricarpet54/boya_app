import { registerAs } from '@nestjs/config';

export const stripeConfig = registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY ?? '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  connectClientId: process.env.STRIPE_CONNECT_CLIENT_ID ?? '',
}));

export const melipayamakConfig = registerAs('melipayamak', () => ({
  username: process.env.MELIPAYAMAK_USERNAME ?? '',
  password: process.env.MELIPAYAMAK_PASSWORD ?? '',
  sender: process.env.MELIPAYAMAK_SENDER ?? '',
  url: process.env.MELIPAYAMAK_URL ?? 'https://rest.payamak-panel.com/api/SendSMS/',
}));

export const neshanConfig = registerAs('neshan', () => ({
  apiKey: process.env.NESHAN_API_KEY ?? '',
}));
