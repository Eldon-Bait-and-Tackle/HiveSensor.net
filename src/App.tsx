import { HashRouter, Routes, Route } from 'react-router-dom';
import { MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { Amplify } from 'aws-amplify';
import LandingPage from './pages/LandingPage';
import Dashboard from './pages/Dashboard';
import Auth from './components/Auth';
import SetupPage from './pages/SetupPage';

Amplify.configure({
  Auth: {
    userPoolId: 'YOUR_COGNITO_USER_POOL_ID',
    userPoolWebClientId: 'YOUR_COGNITO_APP_CLIENT_ID',
    region: 'YOUR_AWS_REGION',
  }
});

function App() {
  return (
    <MantineProvider withGlobalStyles withNormalizeCSS>
      <Notifications />
      <HashRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Auth />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/about" element={<AboutPage />} />
        </Routes>
      </HashRouter>
    </MantineProvider>
  );
}

export default App;