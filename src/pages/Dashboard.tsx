import { useState } from 'react';
import { Container, Title, Tabs, Box } from '@mantine/core';
import { IconMap, IconTable, IconGauge } from '@tabler/icons-react';
import MapView from '../components/MapView';
import TableView from '../components/TableView';

function Dashboard() {
  const [activeTab, setActiveTab] = useState<string | null>('map');

  return (
    <Container size="xl" my="md">
      <Title order={2} mb="md">Hive Sensor Dashboard</Title>

      <Tabs value={activeTab} onTabChange={setActiveTab}>
        <Tabs.List>
          <Tabs.Tab value="map" icon={<IconMap size="1rem" />}>Map View</Tabs.Tab>
          <Tabs.Tab value="table" icon={<IconTable size="1rem" />}>Table View</Tabs.Tab>
          <Tabs.Tab value="heuristic" icon={<IconGauge size="1rem" />}>Heuristic View</Tabs.Tab>
        </Tabs.List>

        <Box pt="md">
          <Tabs.Panel value="map"><MapView /></Tabs.Panel>
          <Tabs.Panel value="table"><TableView /></Tabs.Panel>
          <Tabs.Panel value="heuristic"><HeuristicView /></Tabs.Panel>
        </Box>
      </Tabs>
    </Container>
  );
}

export default Dashboard;