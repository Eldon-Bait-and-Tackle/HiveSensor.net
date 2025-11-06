import { Container, Title, Text, Button, SimpleGrid, Card, Badge, Group, Header, Box, Anchor } from '@mantine/core';
import { IconMap, IconLogin, IconGauge} from '@tabler/icons-react';
import { Link } from 'react-router-dom';
import MapView from '../components/MapView'; // Reusing the MapView component

// Placeholder Data for Updates/Events
const updates = [
  { id: 1, title: 'Network Expansion', date: 'Oct 25', status: 'Success', description: 'Added 5 new sensor nodes in the West Apiary.' },
  { id: 2, title: 'Firmware Update', date: 'Nov 1', status: 'Pending', description: 'Scheduled update for all nodes to improve battery life.' },
  { id: 3, title: 'Community Event', date: 'Nov 15', status: 'Event', description: 'Meetup: Discussing winterization techniques for hive sensors.' },
];

// Reusable Navigation Header component
function AppHeader() {
  return (
    <Header height={60} p="md" sx={{ borderBottom: '1px solid #eee' }}>
      <Group position="apart" sx={{ height: '100%' }}>
        <Title order={3} component={Link} to="/" sx={{ color: 'black', textDecoration: 'none' }}>
          Beehive Monitor
        </Title>
        <Group spacing="md">
          <Anchor component={Link} to="/dashboard" color="dark">
            <Group spacing={5}>
              <IconGauge size="1rem" /> Dashboard
            </Group>
          </Anchor>
          <Button component={Link} to="/login" leftIcon={<IconLogin size="1rem" />} variant="filled" color="yellow">
            Log In
          </Button>
        </Group>
      </Group>
    </Header>
  );
}

function LandingPage() {
  return (
    <Box>
      <AppHeader />
      <Container size="xl" py="xl">

        {/* Hero Section: Live Hive Map */}
        <Group align="center" position="center" my={50}>
          <Box sx={{ maxWidth: 600 }}>
            <Title order={1} mb="md">
              <IconMap size={40} stroke={1.5} color="gold" style={{ verticalAlign: 'middle', marginRight: '10px' }} />
              Live Hive Sensor Network
            </Title>
            <Text size="lg" color="dimmed" mb="lg">
              Monitor your apiaries in **real-time**. Get instant access to hive weight, temperature, humidity, and location data to ensure the health and productivity of your colonies.
            </Text>
            <Group>
              <Button component={Link} to="/dashboard" size="lg" rightIcon={<IconGauge size="1.2rem" />} color="yellow">
                View Dashboard
              </Button>
              <Button component={Link} to="/login" size="lg" variant="default" leftIcon={<IconLogin size="1.2rem" />}>
                Secure Login
              </Button>
            </Group>
          </Box>

          <Card shadow="sm" padding="md" radius="md" withBorder sx={{ width: '100%', maxWidth: 700, minHeight: 400 }}>
            <MapView />
          </Card>

        </Group>

        <hr />

        {/* Updates and Events Section */}
        <Box my={80}>
          <Title order={2} align="center" mb="xl">
            Latest Updates & Events
          </Title>

          <SimpleGrid cols={3} spacing="xl" breakpoints={[{ maxWidth: 'md', cols: 1 }]}>
            {updates.map((item) => (
              <Card key={item.id} shadow="md" padding="lg" radius="md" withBorder>
                <Group position="apart" mb="xs">
                  <Text weight={500}>{item.title}</Text>
                  <Badge color={item.status === 'Success' ? 'green' : item.status === 'Pending' ? 'orange' : 'blue'} variant="light">
                    {item.status}
                  </Badge>
                </Group>
                <Text size="sm" color="dimmed" mb="sm">
                  {item.date}
                </Text>
                <Text size="sm" color="dimmed">
                  {item.description}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Box>

      </Container>
    </Box>
  );
}

export default LandingPage;