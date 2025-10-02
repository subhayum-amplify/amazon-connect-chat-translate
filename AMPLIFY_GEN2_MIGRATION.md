# Amplify Gen 1 to Gen 2 Migration Guide

This project has been migrated from Amplify Gen 1 to Gen 2. Here's what changed and how to deploy:

## What's New in Gen 2

### File Structure Changes
- **Old**: `amplify/backend/` with CloudFormation templates
- **New**: `amplify/` with TypeScript resource definitions

### Key Files Created
- `amplify/backend.ts` - Main backend definition
- `amplify/auth/resource.ts` - Authentication configuration
- `amplify/data/resource.ts` - GraphQL API (minimal for now)
- `amplify/functions/translate/` - Lambda function for translation
- `amplify/api/translate/resource.ts` - REST API definition

### Configuration Changes
- **Old**: `src/aws-exports.js` (auto-generated)
- **New**: `src/amplify_outputs.json` (auto-generated after deployment)

## Migration Steps

### 1. Install Dependencies
```bash
npm install
cd amplify && npm install
```

### 2. Deploy to Sandbox (Development)
```bash
npx ampx sandbox
```
This will:
- Deploy your backend to a sandbox environment
- Generate the `amplify_outputs.json` file
- Hot-reload changes as you develop

### 3. Deploy to Production
```bash
# Set up your app in Amplify Console first, then:
npx ampx generate outputs --app-id YOUR_APP_ID --branch-name main
```

## What Was Migrated

### ✅ Successfully Migrated
- **Authentication**: Cognito User Pool with email login
- **Lambda Function**: Translation service using AWS Translate
- **REST API**: `/translate` endpoint with authentication
- **Permissions**: Lambda can access AWS Translate and Comprehend

### ⚠️ Needs Manual Setup
- **Predictions**: AWS Translate and Comprehend direct access
  - In Gen 2, you'll use the Lambda function instead of direct Predictions
- **Custom Resources**: Environment integration and post-install scripts
  - These need to be recreated as CDK constructs if needed

### 🔄 Updated Code
- `src/App.js`: Updated to use new configuration format
- `package.json`: Updated dependencies and scripts

## Key Differences

### Lambda Function
- **Gen 1**: Used AWS SDK v2
- **Gen 2**: Uses AWS SDK v3 with modern TypeScript

### API Calls
Your existing API calls should work the same way, but the endpoint URL will be different after deployment.

### Predictions
Instead of using `@aws-amplify/predictions` directly, you can:
1. Use the existing Lambda function for translation
2. Add new Lambda functions for other AI services
3. Call AWS services directly from your Lambda functions

## Next Steps

1. **Test the migration**: Run `npx ampx sandbox` and test your app
2. **Update any hardcoded endpoints**: Check your components for API calls
3. **Add missing features**: Recreate any custom resources you need
4. **Deploy to production**: Use Amplify Console for CI/CD

## Rollback Plan

If you need to rollback:
1. Keep your old `amplify/` folder as backup
2. The old Gen 1 setup is still in the original folders
3. You can switch back by reverting the `src/App.js` changes

## Support

- [Amplify Gen 2 Documentation](https://docs.amplify.aws/gen2/)
- [Migration Guide](https://docs.amplify.aws/gen2/start/migrate-from-gen1/)