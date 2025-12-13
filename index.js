// --- CONFIGURATION ---
const config = {
    authUrl: "https://auth.eldonbaitandtackle.net/realms/hsn_kc/protocol/openid-connect/auth",
    tokenUrl: "https://auth.eldonbaitandtackle.net/realms/hsn_kc/protocol/openid-connect/token",
    clientId: "public_client",
    realm: "hsn_kc",
    redirectUri: "https://hsw.eldonbaitandtackle.net/dashboard",
    apiUrl: "https://hsn.eldonbaitandtackle.net/api"
};

// --- GLOBAL STATE ---
let currentMode = 'public';
let map;
let markers = [];
let barChartInstance = null;
let doughnutChartInstance = null;

// --- AUTH LOGIC ---
async function initAuth() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const storedToken = sessionStorage.getItem("auth_token");

    if (code) {
        updateStatus("Exchanging code...");
        await exchangeCode(code);

        // CHECK: If token is missing after exchange, clear persistent state to prevent loop
        if (!sessionStorage.getItem("auth_token")) {
            sessionStorage.removeItem("desired_mode");
            console.error("Token exchange failed. Reverting to public mode.");
        }

        window.history.replaceState({}, document.title, window.location.pathname);
    } else if (storedToken) {
        updateStatus("Authenticated");
        document.getElementById("logout-btn").style.display = "block";
    }

    initApp();
}

function login() {
    sessionStorage.setItem("desired_mode", "private");
    const url = `${config.authUrl}?client_id=${config.clientId}&response_type=code&redirect_uri=${encodeURIComponent(window.location.href)}&scope=openid`;
    window.location.href = url;
}

async function exchangeCode(code) {
    const body = new URLSearchParams({
        grant_type: "authorization_code",
        client_id: config.clientId,
        code: code,
        redirect_uri: window.location.href.split('?')[0]
    });

    try {
        const response = await fetch(config.tokenUrl, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: body
        });
        const data = await response.json();
        if (data.access_token) {
            sessionStorage.setItem("auth_token", data.access_token);
            document.getElementById("logout-btn").style.display = "block";
            updateStatus("Authenticated");
        }
    } catch (e) { console.error("Auth Error", e); }
}

function logout() {
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("desired_mode");
    window.location.reload();
}

function updateStatus(msg) {
    const el = document.getElementById("auth-status");
    if(el) el.textContent = msg;
}

function checkAuthOrLogin() {
    const token = sessionStorage.getItem("auth_token");
    if (!token) {
        login();
        return false;
    }
    return token;
}

// --- APP & VISUALIZATION LOGIC ---

function initApp() {
    if (sessionStorage.getItem("desired_mode") === "private") {
        const sel = document.getElementById("view-mode");
        if(sel) sel.value = "private";
        currentMode = "private";
        sessionStorage.removeItem("desired_mode");
    }

    initMap();

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', fetchAndDisplayData);

    const modeSelect = document.getElementById('view-mode');
    if (modeSelect) {
        modeSelect.addEventListener('change', (e) => {
            currentMode = e.target.value;
            fetchAndDisplayData();
        });
    }

    fetchAndDisplayData();
    setInterval(fetchAndDisplayData, 30000);
}

function initMap() {
    map = new maplibregl.Map({
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
            layers: [{ id: 'osm', type: 'raster', source: 'osm' }]
        },
        center: [0, 20],
        zoom: 2
    });
    map.addControl(new maplibregl.NavigationControl(), 'top-right');
}

function clampLat(lat) {
    return Math.max(-85, Math.min(85, lat));
}

async function fetchAndDisplayData() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');

    if (loadingEl) loadingEl.classList.remove('hidden');
    if (errorEl) errorEl.classList.add('hidden');

    try {
        let mergedData = [];

        if (currentMode === 'public') {
            // PUBLIC: Network View
            const [mapResponse, heuristicsResponse] = await Promise.all([
                fetch(`${config.apiUrl}?request=get_map`).then(r => r.json()),
                fetch(`${config.apiUrl}?request=get_heuristics`).then(r => r.json())
            ]);

            const mapData = mapResponse.results || [];
            const heuristicsData = heuristicsResponse.results || [];

            updateConnectionLines(mapData);

            mergedData = heuristicsData.map(h => {
                const node = mapData.find(m => String(m.id) === String(h.module_id));
                const rawLat = node && node.location ? node.location[0] : 0;
                const rawLong = node && node.location ? node.location[1] : 0;
                return { ...h, lat: clampLat(rawLat), long: rawLong };
            });

        } else {
            // PRIVATE: User Modules
            const token = checkAuthOrLogin();
            if (!token) return;

            // Updated to use 'get_user_modules' as requested
            const response = await fetch(`${config.apiUrl}?request=get_user_modules`, {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json"
                }
            });

            if (response.status === 401) { logout(); return; }

            const json = await response.json();
            const modules = json.modules || [];

            // Clear public lines
            if (map.getLayer('connections-layer')) map.removeLayer('connections-layer');
            if (map.getSource('connections')) map.removeSource('connections');

            mergedData = modules.map(m => {
                let lat = 0, long = 0;
                if (Array.isArray(m.location)) { lat = m.location[0]; long = m.location[1]; }
                else if (m.location && m.location.lat) { lat = m.location.lat; long = m.location.long; }

                return {
                    module_id: m.module_id || m.id || "Unknown",
                    lat: clampLat(lat),
                    long: long,
                    self_temp: m.self_temp || 0,
                    deviation: m.deviation || 0,
                    avg_neighbor_temp: m.avg_neighbor_temp || 0,
                    within_range: m.within_range !== undefined ? m.within_range : true
                };
            });
        }

        renderVisuals(mergedData);

    } catch (error) {
        console.error(error);
        if (errorEl) {
            errorEl.classList.remove('hidden');
            errorEl.textContent = `Error: ${error.message}`;
        }
    } finally {
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

function renderVisuals(data) {
    // 1. Map Markers
    markers.forEach(marker => marker.remove());
    markers.length = 0;
    const bounds = new maplibregl.LngLatBounds();

    data.forEach((sensor) => {
        const popup = new maplibregl.Popup({ offset: 25 }).setHTML(`
            <div class="popup-content">
                <h3 class="popup-title">Module ${sensor.module_id}</h3>
                <div class="popup-detail">
                    Temp: <b>${sensor.self_temp}°F</b><br>
                    Dev: <b>${Number(sensor.deviation).toFixed(4)}</b>
                </div>
            </div>
        `);

        const marker = new maplibregl.Marker({ color: sensor.within_range ? '#34d399' : '#f87171' })
            .setLngLat([sensor.long, sensor.lat])
            .setPopup(popup)
            .addTo(map);

        markers.push(marker);
        bounds.extend([sensor.long, sensor.lat]);
    });

    if (markers.length > 0) map.fitBounds(bounds, { padding: 50, maxZoom: 15 });

    // 2. Table
    const tableBody = document.getElementById('data-table-body');
    if (tableBody) {
        tableBody.innerHTML = '';
        data.forEach((sensor) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${sensor.module_id}</td>
                <td class="mono">${sensor.lat.toFixed(4)}, ${sensor.long.toFixed(4)}</td>
                <td class="val-primary">${sensor.self_temp}</td>
                <td class="val-secondary">${sensor.avg_neighbor_temp}</td>
                <td>
                    <span class="status-pill ${sensor.within_range ? 'stable' : 'outlier'}">
                        ${sensor.within_range ? 'Stable' : 'Outlier'}
                    </span>
                </td>
                <td class="val-dim">${Number(sensor.deviation).toFixed(5)}</td>
            `;
            tableBody.appendChild(row);
        });
    }

    // 3. Charts
    updateCharts(data);
}

function updateConnectionLines(mapData) {
    if (map.getLayer('connections-layer')) map.removeLayer('connections-layer');
    if (map.getSource('connections')) map.removeSource('connections');

    const features = [];
    const nodeMap = new Map(mapData.map(node => [String(node.id), node.location]));
    const processedPairs = new Set();

    mapData.forEach(node => {
        if (!node.neighbors) return;
        const startLoc = node.location;
        node.neighbors.forEach(neighborId => {
            const endLoc = nodeMap.get(String(neighborId));
            const pairId = [node.id, neighborId].sort().join('-');
            if (endLoc && !processedPairs.has(pairId)) {
                processedPairs.add(pairId);
                features.push({
                    type: 'Feature',
                    properties: {},
                    geometry: {
                        type: 'LineString',
                        coordinates: [
                            [startLoc[1], clampLat(startLoc[0])],
                            [endLoc[1], clampLat(endLoc[0])]
                        ]
                    }
                });
            }
        });
    });

    map.addSource('connections', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features }
    });

    map.addLayer({
        id: 'connections-layer',
        type: 'line',
        source: 'connections',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
            'line-color': '#6366f1',
            'line-width': 2,
            'line-opacity': 0.6
        }
    });
}

function updateCharts(data) {
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

    const barCtx = document.getElementById('barChart');
    if (barChartInstance) barChartInstance.destroy();
    if (barCtx) {
        barChartInstance = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Temp', data: temps, backgroundColor: '#818cf8', borderRadius: 4 },
                    { label: 'Deviation', data: deviations, backgroundColor: '#94a3b8', borderRadius: 4 }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { display: false, grid: { display: false } },
                    x: { display: false, grid: { display: false } }
                }
            }
        });
    }

    const doughCtx = document.getElementById('doughnutChart');
    if (doughnutChartInstance) doughnutChartInstance.destroy();
    if (doughCtx) {
        doughnutChartInstance = new Chart(doughCtx, {
            type: 'doughnut',
            data: {
                labels: ['Good', 'Warning', 'Critical'],
                datasets: [{
                    data: devCounts,
                    backgroundColor: ['#34d399', '#fbbf24', '#f87171'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'right', labels: { usePointStyle: true, font: chartFont, boxWidth: 8 } } },
                cutout: '70%'
            }
        });
    }
}

// Start
initAuth();