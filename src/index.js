import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import "amazon-connect-streams"; // This will make the `connect` available in the current context.
import "amazon-connect-chatjs";

// Import semantic
import 'semantic-ui-less/semantic.less';

// Amplify imports for base install
// Note: Amplify.configure() is called in App.js

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <App />
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
