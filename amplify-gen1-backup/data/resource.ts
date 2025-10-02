import { type ClientSchema, a, defineData } from '@aws-amplify/backend';

const schema = a.schema({
  // This is a minimal schema - you can expand it based on your needs
  // For now, we're keeping it simple since your app primarily uses the REST API
  Todo: a
    .model({
      content: a.string(),
    })
    .authorization((allow) => [allow.owner()]),
});

export type Schema = ClientSchema<typeof schema>;

export const data = defineData({
  schema,
  authorizationModes: {
    defaultAuthorizationMode: 'userPool',
  },
});