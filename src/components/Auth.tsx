import { Authenticator } from '@aws-amplify/ui-react';
import '@aws-amplify/ui-react/styles.css'; // Import Amplify's default styles
import { Navigate } from 'react-router-dom';
import { Center, Box, Title } from '@mantine/core';

function Auth() {
  return (
    <Center style={{ minHeight: '100vh', backgroundColor: '#f0f0f0' }}>
      <Box p="xl" style={{ width: 400, backgroundColor: 'white', borderRadius: 8 }}>
        <Title order={2} align="center" mb="lg" color="yellow">
          Hive Login
        </Title>
        <Authenticator initialState="signIn">
          {({ route }) => {
            // Check if the route is signed in and redirect to dashboard
            if (route === 'signedIn') {
              return <Navigate to="/dashboard" replace />;
            }
            // The Authenticator handles rendering the sign-in/sign-up forms
            return null;
          }}
        </Authenticator>
      </Box>
    </Center>
  );
}

export default Auth;