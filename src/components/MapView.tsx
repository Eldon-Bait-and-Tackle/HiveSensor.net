import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import '@mantine/core/styles.css';
import 'leaflet/dist/leaflet.css';

function MapView() {
  const position: [number, number] = [43.8236, -111.7891]; // Rexburg coordinates

  // Data would be fetched here
  const hiveData = [{ id: 1, lat: 43.82, lon: -111.79, name: 'Hive 1', temp: '35°C' }];

  return (
    <MapContainer center={position} zoom={13} style={{ height: '500px', width: '100%' }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="http://osm.org/copyright">OpenStreetMap</a> contributors'
      />
      {hiveData.map(hive => (
        <Marker key={hive.id} position={[hive.lat, hive.lon]}>
          <Popup>
            **{hive.name}**<br />
            Temp: {hive.temp}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}

export default MapView;