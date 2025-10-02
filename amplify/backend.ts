import { defineBackend } from '@aws-amplify/backend';
import { PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';
import { RestApi, LambdaIntegration, Cors, AuthorizationType, CognitoUserPoolsAuthorizer } from 'aws-cdk-lib/aws-apigateway';
import { auth } from './auth/resource';
import { translateFunction } from './functions/translate/resource';

export const backend = defineBackend({
  auth,
  translateFunction,
});

// Add permissions for the translate function to use AWS services
backend.translateFunction.resources.lambda.addToRolePolicy(
  new PolicyStatement({
    effect: Effect.ALLOW,
    actions: [
      'bedrock:InvokeModel',
      'bedrock:InvokeModelWithResponseStream'
    ],
    resources: [
      'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0',
      'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-sonnet-20240229-v1:0'
    ]
  })
);

// Create a custom stack for the REST API
const apiStack = backend.createStack('TranslateApiStack');

// Create REST API
const api = new RestApi(apiStack, 'TranslateApi', {
  restApiName: 'Translate Service',
  deploy: true,
  deployOptions: {
    stageName: "dev",
  },
  description: 'This service translates text using Amazon Bedrock.',
  defaultCorsPreflightOptions: {
    allowOrigins: Cors.ALL_ORIGINS,
    allowMethods: Cors.ALL_METHODS,
    allowHeaders: Cors.DEFAULT_HEADERS
  },
});

// Create Lambda integration
const translateIntegration = new LambdaIntegration(backend.translateFunction.resources.lambda);

// Create Cognito User Pool Authorizer
const cognitoAuthorizer = new CognitoUserPoolsAuthorizer(apiStack, 'CognitoAuthorizer', {
  cognitoUserPools: [backend.auth.resources.userPool],
  authorizerName: 'translate-cognito-authorizer',
  identitySource: 'method.request.header.Authorization',
});

// Add /translate resource
const translateResource = api.root.addResource('translate');
translateResource.addMethod('POST', translateIntegration, {
  authorizationType: AuthorizationType.COGNITO,
  authorizer: cognitoAuthorizer,
});

// Add the API endpoint to outputs
backend.addOutput({
  custom: {
    translateApiEndpoint: api.url,
    translateApiName: 'translateApi',
  },
});