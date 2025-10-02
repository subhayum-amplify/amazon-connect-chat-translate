import { Amplify } from 'aws-amplify';
import { withAuthenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css';
import { parseAmplifyConfig } from "aws-amplify/utils";
import { fetchAuthSession } from 'aws-amplify/auth';
import outputs from './amplify_outputs.json';
import './App.css';
import 'semantic-ui-less/semantic.less';
import Ccp from './components/ccp';

// Configure Amplify immediately when module loads
console.log('Configuring Amplify with outputs:', outputs);

// Verify we have the required auth configuration
if (!outputs.auth || !outputs.auth.user_pool_id || !outputs.auth.user_pool_client_id) {
  throw new Error('Missing required auth configuration in amplify_outputs.json');
}

// Configure Amplify v6 with the proper format
const amplifyConfig = parseAmplifyConfig(outputs);
console.log('Parsed Amplify config:', amplifyConfig);

// Build the REST API configuration with Cognito authentication
const restConfig = {};
if (outputs.custom && outputs.custom.translateApiName) {
  restConfig[outputs.custom.translateApiName] = {
    endpoint: outputs.custom.translateApiEndpoint,
    region: outputs.auth.aws_region,
  };
  console.log('REST API config:', restConfig);
}

const finalConfig = {
  ...amplifyConfig,
  API: {
    ...amplifyConfig.API,
    REST: restConfig,
  },
};

console.log('Final Amplify configuration:', finalConfig);

// Configure Amplify with custom headers for ID token
Amplify.configure(finalConfig, {
  API: {
    REST: {
      headers: async () => {
        try {
          const session = await fetchAuthSession();
          const token = session.tokens?.idToken?.toString();
          console.log('Adding ID token to API headers:', token ? 'Token present' : 'No token');
          return token ? { Authorization: `Bearer ${token}` } : {};
        } catch (error) {
          console.error('Error fetching auth session:', error);
          return {};
        }
      }
    }
  }
});
console.log('Amplify configuration completed successfully');

// Component
function App({ signOut, user }) {
  return (
    <div className="App">
      <Ccp user={user} signOut={signOut} />
    </div>
  );
}

export default withAuthenticator(App);