import { Table, Container, Title, Text, Badge } from '@mantine/core';

// Mock API Data for the table
const hiveData = [
  { id: 1, name: 'Hive Alpha', location: 'East Apiary', temp: 34.5, weight: 45.2, humidity: 62, status: 'Normal' },
  { id: 2, name: 'Hive Beta', location: 'West Apiary', temp: 36.8, weight: 38.9, humidity: 75, status: 'Alert' },
  { id: 3, name: 'Hive Gamma', location: 'South Apiary', temp: 33.1, weight: 51.5, humidity: 55, status: 'Normal' },
  { id: 4, name: 'Hive Delta', location: 'North Apiary', temp: 35.9, weight: 42.1, humidity: 68, status: 'Warning' },
];

function TableView() {
  const rows = hiveData.map((element) => (
    <Table.Tr key={element.id}>
      <Table.Td>{element.name}</Table.Td>
      <Table.Td>{element.location}</Table.Td>
      <Table.Td>{element.temp.toFixed(1)}°C</Table.Td>
  <Table.Td>{element.weight.toFixed(1)} kg</Table.Td>
  <Table.Td>{element.humidity}%</Table.Td>
  <Table.Td>
  <Badge color={
    element.status === 'Alert' ? 'red' :
      element.status === 'Warning' ? 'orange' :
        'green'
  } variant="light">
    {element.status}
    </Badge>
    </Table.Td>
    </Table.Tr>
));

  return (
    <Container size="xl" py="md">
  <Title order={3} mb="sm">Sensor Data Table</Title>
  <Text color="dimmed" mb="md">Detailed, raw sensor readings for all active hives.</Text>

  <Table striped highlightOnHover withTableBorder withColumnBorders>
  <Table.Thead>
    <Table.Tr>
      <Table.Th>Hive Name</Table.Th>
  <Table.Th>Location</Table.Th>
  <Table.Th>Internal Temp</Table.Th>
  <Table.Th>Weight</Table.Th>
  <Table.Th>Humidity</Table.Th>
  <Table.Th>Status</Table.Th>
  </Table.Tr>
  </Table.Thead>
  <Table.Tbody>{rows}</Table.Tbody>
  </Table>
  </Container>
);
}

export default TableView;