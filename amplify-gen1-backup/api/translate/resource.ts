import { defineRestApi } from '@aws-amplify/backend';
import { translateFunction } from '../../functions/translate/resource';

export const translateApi = defineRestApi({
  name: 'translateApi',
  definition: {
    '/translate': {
      'POST': {
        handler: translateFunction,
        authorizationType: 'AWS_IAM',
      },
      'OPTIONS': {
        handler: translateFunction,
        authorizationType: 'NONE',
      },
    },
  },
});