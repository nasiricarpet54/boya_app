import { registerAs } from '@nestjs/config';

export const stripeConfig = registerAs('stripe', () => ({
  secretKey: process.env.STRIPE_SECRET_KEY ?? '',
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? '',
  connectClientId: process.env.STRIPE_CONNECT_CLIENT_ID ?? '',
}));

export const kavenegarConfig = registerAs('kavenegar', () => ({
  apiKey: process.env.KAVENEGAR_API_KEY ?? '',
  sender: process.env.KAVENEGAR_SENDER ?? '',
}));

export const neshanConfig = registerAs('neshan', () => ({
  apiKey: process.env.NESHAN_API_KEY ?? '',
}));
