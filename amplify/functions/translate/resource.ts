import { defineFunction } from '@aws-amplify/backend';

export const translateFunction = defineFunction({
  name: 'translate',
  entry: './handler.ts',
  runtime: 20,
  timeoutSeconds: 30
});