import './style.css';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Chart from 'chart.js/auto';

interface HeuristicResult {
    module_id: number;
    self_temp: number;
    avg_neighbor_temp: number | string;
    within_range: boolean;
    deviation: number;
}

interface MapNode {
    id: number;
    location: [number, number];
    neighbors: number[];
}

interface MergedData extends HeuristicResult {
    lat: number;
    long: number;
}

const API_ENDPOINT = 'http://100.73.81.46:8082/api';

const map = new maplibregl.Map({
    container: 'map',
    style: {
        version: 8,
        sources: {
            'osm': {
                type: 'raster',
                tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
                tileSize: 256,
                attribution: '&copy; OpenStreetMap Contributors',
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

map.addControl(new maplibregl.NavigationControl(), 'top-right');

const markers: maplibregl.Marker[] = [];
let barChartInstance: Chart | null = null;
let doughnutChartInstance: Chart | null = null;

function clampLat(lat: number): number {
    return Math.max(-85, Math.min(85, lat));
}

function updateConnectionLines(mapData: MapNode[]) {
    if (map.getLayer('connections-layer')) {
        map.removeLayer('connections-layer');
    }
    if (map.getSource('connections')) {
        map.removeSource('connections');
    }

    const features: any[] = [];
    const nodeMap = new Map(mapData.map(node => [node.id, node.location]));
    const processedPairs = new Set<string>();

    mapData.forEach(node => {
        const startLat = clampLat(node.location[0]);
        const startLng = node.location[1];

        node.neighbors.forEach(neighborId => {
            const endLoc = nodeMap.get(neighborId);

            const pairId = [node.id, neighborId].sort((a, b) => a - b).join('-');

            if (endLoc && !processedPairs.has(pairId)) {
                processedPairs.add(pairId);

                const endLat = clampLat(endLoc[0]);
                const endLng = endLoc[1];

                features.push({
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [startLng, startLat],
                            [endLng, endLat]
                        ]
                    }
                });
            }
        });
    });

    map.addSource('connections', {
        type: 'geojson',
        data: {
            type: 'FeatureCollection',
            features: features
        }
    });

    map.addLayer({
        id: 'connections-layer',
        type: 'line',
        source: 'connections',
        layout: {
            'line-join': 'round',
            'line-cap': 'round'
        },
        paint: {
            'line-color': '#6366f1',
            'line-width': 2,
            'line-opacity': 0.8
        }
    });
}

function updateCharts(data: MergedData[]) {
    const labels = data.map(d => `ID: ${d.module_id}`);
    const temps = data.map(d => d.self_temp);
    const deviations = data.map(d => d.deviation);

    const devCounts = [0, 0, 0];
    data.forEach(d => {
        if (d.deviation < 0.3) devCounts[0]++;
        else if (d.deviation < 0.7) devCounts[1]++;
        else devCounts[2]++;
    });

    const chartFont = { family: "'Inter', sans-serif", size: 11 };
    const gridStyle = { color: '#f3f4f6', drawBorder: false };

    const barCtx = document.getElementById('barChart') as HTMLCanvasElement;
    if (barChartInstance) barChartInstance.destroy();

    if (barCtx) {
        barChartInstance = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Temp', data: temps, backgroundColor: '#818cf8', borderRadius: 6 },
                    { label: 'Deviation', data: deviations, backgroundColor: '#94a3b8', borderRadius: 6 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { beginAtZero: true, grid: gridStyle, ticks: { font: chartFont }, border: { display: false } },
                    x: { grid: { display: false }, ticks: { font: chartFont }, border: { display: false } }
                }
            }
        });
    }

    const doughCtx = document.getElementById('doughnutChart') as HTMLCanvasElement;
    if (doughnutChartInstance) doughnutChartInstance.destroy();

    if (doughCtx) {
        doughnutChartInstance = new Chart(doughCtx, {
            type: 'doughnut',
            data: {
                labels: ['Good', 'Warning', 'Critical'],
                datasets: [{
                    data: devCounts,
                    backgroundColor: ['#34d399', '#fbbf24', '#f87171'],
                    borderWidth: 4,
                    borderColor: '#ffffff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { usePointStyle: true, font: chartFont } } },
                cutout: '75%'
            }
        });
    }
}

async function apiCall(requestType: string, payload: any = {}) {
    const url = new URL(API_ENDPOINT);
    url.searchParams.append('request', requestType);

    for (const [key, value] of Object.entries(payload)) {
        url.searchParams.append(key, String(value));
    }

    const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
}

async function fetchAndDisplayData() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const tableBody = document.getElementById('data-table-body');

    if (!loadingEl || !errorEl || !tableBody) return;

    try {
        loadingEl.classList.remove('hidden');
        errorEl.classList.add('hidden');

        const [mapResponse, heuristicsResponse] = await Promise.all([
            apiCall('get_map'),
            apiCall('get_heuristics')
        ]);

        const mapData: MapNode[] = mapResponse.results;
        const heuristicsData: HeuristicResult[] = heuristicsResponse.results;

        updateConnectionLines(mapData);

        const mergedData: MergedData[] = heuristicsData.map(h => {
            const node = mapData.find(m => m.id === h.module_id);
            const rawLat = node ? node.location[0] : 0;
            const rawLong = node ? node.location[1] : 0;

            return {
                ...h,
                lat: clampLat(rawLat),
                long: rawLong
            };
        });

        markers.forEach(marker => marker.remove());
        markers.length = 0;
        const bounds = new maplibregl.LngLatBounds();

        mergedData.forEach((sensor) => {
            const popup = new maplibregl.Popup({ offset: 25 })
                .setHTML(`
                    <div class="font-sans">
                        <h3 class="font-bold text-indigo-600">Module ${sensor.module_id}</h3>
                        <div class="text-sm text-slate-600 mt-1">
                            Temp: <b>${sensor.self_temp}°F</b><br>
                            Avg Neighbor: <b>${sensor.avg_neighbor_temp}</b><br>
                            Deviation: <b>${sensor.deviation.toFixed(4)}</b>
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

        if (markers.length > 0) map.fitBounds(bounds, { padding: 50, maxZoom: 15 });

        tableBody.innerHTML = '';
        mergedData.forEach((sensor) => {
            const row = document.createElement('tr');
            row.className = 'hover:bg-slate-50 transition-colors';
            row.innerHTML = `
                <td class="px-6 py-4 font-mono text-xs text-slate-500">${sensor.lat.toFixed(4)}, ${sensor.long.toFixed(4)}</td>
                <td class="px-6 py-4 font-medium text-indigo-600">${sensor.self_temp}</td>
                <td class="px-6 py-4 text-sky-600">${sensor.avg_neighbor_temp}</td>
                <td class="px-6 py-4">
                    <span class="px-2 py-1 rounded-full text-xs ${sensor.within_range ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}">
                        ${sensor.within_range ? 'Stable' : 'Outlier'}
                    </span>
                </td>
                <td class="px-6 py-4 text-slate-400 text-xs">${sensor.deviation.toFixed(5)}</td>
            `;
            tableBody.appendChild(row);
        });

        updateCharts(mergedData);

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

map.once('load', fetchAndDisplayData);
setInterval(fetchAndDisplayData, 30000);