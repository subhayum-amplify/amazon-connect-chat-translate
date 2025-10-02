import { defineBackend } from '@aws-amplify/backend';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { translateFunction } from './functions/translate/resource';
import { translateApi } from './api/translate/resource';

export const backend = defineBackend({
  auth,
  data,
  translateFunction,
  translateApi,
});

// Add permissions for the translate function to use AWS services
backend.translateFunction.resources.lambda.addToRolePolicy({
  effect: 'Allow',
  actions: [
    'translate:TranslateText',
    'comprehend:DetectDominantLanguage',
    'comprehend:DetectEntities',
    'comprehend:DetectKeyPhrases',
    'comprehend:DetectSentiment',
    'comprehend:DetectSyntax'
  ],
  resources: ['*']
});