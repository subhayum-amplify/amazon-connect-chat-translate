import { defineFunction } from '@aws-amplify/backend';

export const translateFunction = defineFunction({
  name: 'translate',
  entry: './handler.ts',
  runtime: 20,
  timeout: 30,
  environment: {
    // Add any environment variables if needed
  }
});