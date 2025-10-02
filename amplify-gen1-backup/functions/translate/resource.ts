import { defineFunction } from '@aws-amplify/backend';

export const translateFunction = defineFunction({
  name: 'translate',
  entry: './handler.ts'
});