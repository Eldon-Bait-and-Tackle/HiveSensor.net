import './style.css';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Chart from 'chart.js/auto';

interface SensorData {
    deviation: number;
    lastRequestTime: string;
    lat: number;
    long: number;
    moisture: number;
    temp: number;
}

const API_ENDPOINT = 'http://localhost:5000';

const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'osm': {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            }
        },
        layers: [{
            id: 'osm',
            type: 'raster',
            source: 'osm',
        }]
    },
    center: [0, 20],
    zoom: 2
});

function drawNeighborConnection(start: [number, number], end: [number, number]) {
    const source = map.getSource('neighbors') as maplibregl.GeoJSONSource;
    if (!source) return;

    source.setData({
        type: 'FeatureCollection',
        features: [{
            type: 'Feature',
            properties: {},
            geometry: {
                type: 'LineString',
                coordinates: [start, end]
            }
        }]
    });
}




// Add navigation controls (zoom buttons)
map.addControl(new maplibregl.NavigationControl(), 'top-right');

const markers: maplibregl.Marker[] = [];
let barChartInstance: Chart | null = null;
let doughnutChartInstance: Chart | null = null;

function updateCharts(data: SensorData[]) {
    const labels = data.map((_, i) => `S${i + 1}`);
    const temps = data.map(d => d.temp);
    const moisture = data.map(d => d.moisture);

    const devCounts = [0, 0, 0];
    data.forEach(d => {
        if (d.deviation < 0.3) devCounts[0]++;
        else if (d.deviation < 0.7) devCounts[1]++;
        else devCounts[2]++;
    });

    const chartFont = { family: "'Inter', sans-serif", size: 11 };
    const gridStyle = { color: '#f3f4f6', drawBorder: false };

    // Bar Chart
    const barCtx = document.getElementById('barChart') as HTMLCanvasElement;
    if (barChartInstance) barChartInstance.destroy();

    barChartInstance = new Chart(barCtx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Temp',
                    data: temps,
                    backgroundColor: '#818cf8',
                    hoverBackgroundColor: '#6366f1',
                    borderRadius: 6,
                    barPercentage: 0.6
                },
                {
                    label: 'Moisture',
                    data: moisture,
                    backgroundColor: '#94a3b8',
                    hoverBackgroundColor: '#64748b',
                    borderRadius: 6,
                    barPercentage: 0.6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1e293b',
                    padding: 12,
                    cornerRadius: 8,
                    titleFont: { family: 'Inter', size: 13 },
                    bodyFont: { family: 'Inter', size: 12 }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: gridStyle,
                    ticks: { font: chartFont, color: '#9ca3af' },
                    border: { display: false }
                },
                x: {
                    grid: { display: false },
                    ticks: { font: chartFont, color: '#9ca3af' },
                    border: { display: false }
                }
            }
        }
    });

    // Doughnut Chart
    const doughCtx = document.getElementById('doughnutChart') as HTMLCanvasElement;
    if (doughnutChartInstance) doughnutChartInstance.destroy();

    doughnutChartInstance = new Chart(doughCtx, {
        type: 'doughnut',
        data: {
            labels: ['Good', 'Warning', 'Critical'],
            datasets: [{
                data: devCounts,
                backgroundColor: ['#34d399', '#fbbf24', '#f87171'],
                borderWidth: 4,
                borderColor: '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: { usePointStyle: true, pointStyle: 'circle', font: chartFont, color: '#64748b' }
                }
            },
            cutout: '75%'
        }
    });
}

async function fetchAndDisplayData() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const tableBody = document.getElementById('data-table-body');

    if (!loadingEl || !errorEl || !tableBody) return;

    try {
        loadingEl.classList.remove('hidden');
        errorEl.classList.add('hidden');

        const response = await fetch(API_ENDPOINT);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

        const data: SensorData[] = await response.json();

        // Map Logic
        markers.forEach(marker => marker.remove());
        markers.length = 0;

        const bounds = new maplibregl.LngLatBounds();

        data.forEach((sensor) => {
            const popup = new maplibregl.Popup({ offset: 25 })
                .setHTML(`
                    <div class="font-sans">
                        <h3 class="font-bold text-indigo-600">Sensor Node</h3>
                        <div class="text-sm text-slate-600 mt-1">
                            Temp: <b>${sensor.temp}°F</b><br>
                            Moisture: <b>${sensor.moisture}%</b>
                        </div>
                    </div>
                `);

            const marker = new maplibregl.Marker()
                .setLngLat([sensor.long, sensor.lat])
                .setPopup(popup)
                .addTo(map);

            markers.push(marker);
            bounds.extend([sensor.long, sensor.lat]);
        });

        if (markers.length > 0) {
            map.fitBounds(bounds, { padding: 50, maxZoom: 15 });
        }

        // Table Logic
        tableBody.innerHTML = '';
        data.forEach((sensor) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 transition-colors';
            row.innerHTML = `
                <td class="px-6 py-4 font-mono text-xs text-slate-500">${sensor.lat.toFixed(2)}, ${sensor.long.toFixed(2)}</td>
                <td class="px-6 py-4 font-medium text-indigo-600">${sensor.temp}</td>
                <td class="px-6 py-4 text-sky-600">${sensor.moisture}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-xs ${sensor.deviation > 0.5 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}">
                        ${sensor.deviation}
                    </span>
                </td>
                <td class="px-6 py-4 text-slate-400 text-xs">${new Date(sensor.lastRequestTime).toLocaleTimeString()}</td>
            `;
            tableBody.appendChild(row);
        });

        updateCharts(data);

    } catch (error) {
        console.error(error);
        errorEl.classList.remove('hidden');
        errorEl.textContent = `System Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    } finally {
        loadingEl.classList.add('hidden');
    }
}

const refreshBtn = document.getElementById('refresh-btn');
if (refreshBtn) refreshBtn.addEventListener('click', fetchAndDisplayData);

fetchAndDisplayData();
setInterval(fetchAndDisplayData, 30000);