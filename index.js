const config = {
    authUrl: "https://auth.eldonbaitandtackle.net/realms/hsn_kc/protocol/openid-connect/auth",
    tokenUrl: "https://auth.eldonbaitandtackle.net/realms/hsn_kc/protocol/openid-connect/token",
    clientId: "public_client",
    realm: "hsn_kc",
    redirectUri: "https://hsw.eldonbaitandtackle.net",
    apiUrl: "https://hsn.eldonbaitandtackle.net/api"
};

let currentMode = 'public';
let map;
let markers = [];
let barChartInstance = null;
let doughnutChartInstance = null;

async function initAuth() {
    console.log("=== initAuth started ===");
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const storedToken = sessionStorage.getItem("auth_token");

    console.log("Code from URL:", code);
    console.log("Stored token exists:", !!storedToken);
    console.log("Desired mode:", sessionStorage.getItem("desired_mode"));

    if (code) {
        console.log("Found auth code, exchanging...");
        updateStatus("Exchanging code...");
        await exchangeCode(code);

        // Clear the code from URL
        window.history.replaceState({}, document.title, window.location.pathname);

        const newToken = sessionStorage.getItem("auth_token");
        console.log("Token after exchange:", !!newToken);

        if (newToken) {
            updateStatus("Authenticated");
            document.getElementById("logout-btn").style.display = "block";
        } else {
            updateStatus("");
            sessionStorage.removeItem("desired_mode");
            console.error("Token exchange failed. Reverting to public mode.");
        }
    } else if (storedToken) {
        console.log("Using existing token");
        updateStatus("Authenticated");
        document.getElementById("logout-btn").style.display = "block";
    }

    console.log("=== calling initApp ===");
    initApp();
}

function login() {
    sessionStorage.setItem("desired_mode", "private");
    const redirectUri = config.redirectUri;

    const url = `${config.authUrl}?client_id=${config.clientId}&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid`;
    window.location.href = url;
}

async function exchangeCode(code) {
    try {
        console.log("=== Token Exchange Request ===");
        console.log("Code:", code);
        console.log("Using backend proxy for token exchange...");

        // Use our backend as a proxy to avoid CORS issues with Keycloak
        const response = await fetch(`${config.apiUrl}?request=exchange_token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code: code,
                redirect_uri: config.redirectUri
            })
        });

        console.log("Response status:", response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error("=== Token Exchange FAILED ===");
            console.error("Status:", response.status);
            console.error("Error:", errorText);
            return false;
        }

        const data = await response.json();
        console.log("=== Token Exchange SUCCESS ===");
        console.log("Has access_token:", !!data.access_token);

        if (data.access_token) {
            sessionStorage.setItem("auth_token", data.access_token);
            if (data.refresh_token) {
                sessionStorage.setItem("refresh_token", data.refresh_token);
            }
            console.log("Token stored in sessionStorage");
            return true;
        } else {
            console.error("No access token in response:", data);
            return false;
        }
    } catch (e) {
        console.error("=== Token Exchange ERROR ===");
        console.error("Exception:", e);
        console.error("Stack:", e.stack);
        return false;
    }
}

function logout() {
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("refresh_token");
    sessionStorage.removeItem("desired_mode");
    document.getElementById("logout-btn").style.display = "none";
    updateStatus("");

    // Switch back to public mode
    currentMode = 'public';
    const sel = document.getElementById("view-mode");
    if(sel) sel.value = "public";

    fetchAndDisplayData();
}

function updateStatus(msg) {
    const el = document.getElementById("auth-status");
    if(el) el.textContent = msg;
}

function initApp() {
    console.log("=== initApp started ===");
    const storedToken = sessionStorage.getItem("auth_token");
    const desired = sessionStorage.getItem("desired_mode");

    console.log("Token exists:", !!storedToken);
    console.log("Desired mode:", desired);

    // If we just authenticated and wanted private mode, switch to it
    if (desired === "private" && storedToken) {
        console.log("Setting mode to private after auth");
        const sel = document.getElementById("view-mode");
        if(sel) sel.value = "private";
        currentMode = "private";
        sessionStorage.removeItem("desired_mode");
    } else {
        // Clean up any stale desired_mode
        if (desired) sessionStorage.removeItem("desired_mode");

        // Default to public
        console.log("Defaulting to public mode");
        currentMode = "public";
        const sel = document.getElementById("view-mode");
        if(sel) sel.value = "public";
    }

    console.log("Current mode set to:", currentMode);
    console.log("Initializing map...");
    initMap();

    const refreshBtn = document.getElementById('refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', fetchAndDisplayData);

    const claimBtn = document.getElementById('claim-btn');
    if (claimBtn) claimBtn.addEventListener('click', openClaimModal);

    const modeSelect = document.getElementById('view-mode');
    if (modeSelect) {
        modeSelect.addEventListener('change', (e) => {
            const newMode = e.target.value;
            console.log("Mode changed to:", newMode);

            // If switching to private without auth, trigger login
            if (newMode === 'private' && !sessionStorage.getItem('auth_token')) {
                console.log("No token, triggering login");
                login();
                return;
            }

            currentMode = newMode;
            fetchAndDisplayData();
        });
    } else {
        console.error("Mode select element not found!");
    }

    console.log("Calling initial fetchAndDisplayData...");
    fetchAndDisplayData();
    setInterval(fetchAndDisplayData, 30000);
}

function openClaimModal() {
    const token = sessionStorage.getItem("auth_token");
    if (!token) {
        alert("Please log in first to claim a module.");
        login();
        return;
    }

    document.getElementById('claim-modal').style.display = 'flex';
    document.getElementById('module-secret').value = '';
    document.getElementById('claim-error').style.display = 'none';
    document.getElementById('claim-success').style.display = 'none';
    document.getElementById('module-secret').focus();
}

function closeClaimModal() {
    document.getElementById('claim-modal').style.display = 'none';
}

async function claimModule() {
    const token = sessionStorage.getItem("auth_token");
    const secret = document.getElementById('module-secret').value.trim();
    const errorEl = document.getElementById('claim-error');
    const successEl = document.getElementById('claim-success');

    // Clear previous messages
    errorEl.style.display = 'none';
    successEl.style.display = 'none';

    if (!secret) {
        errorEl.textContent = 'Please enter a module secret key.';
        errorEl.style.display = 'block';
        return;
    }

    if (!token) {
        errorEl.textContent = 'Authentication required. Please log in.';
        errorEl.style.display = 'block';
        return;
    }

    try {
        console.log("Claiming module with secret:", secret);
        const response = await fetch(`${config.apiUrl}?request=claim_device`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ module_secret: secret })
        });

        const data = await response.json();

        if (response.ok) {
            successEl.textContent = `Success! Module ${data.module_id} has been claimed.`;
            successEl.style.display = 'block';

            // Switch to private mode and refresh after a delay
            setTimeout(() => {
                closeClaimModal();
                currentMode = 'private';
                document.getElementById('view-mode').value = 'private';
                fetchAndDisplayData();
            }, 2000);
        } else {
            errorEl.textContent = data.message || data.error || 'Failed to claim module.';
            errorEl.style.display = 'block';
        }
    } catch (error) {
        console.error("Claim error:", error);
        errorEl.textContent = 'Network error. Please try again.';
        errorEl.style.display = 'block';
    }
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
            const token = sessionStorage.getItem("auth_token");
            if (!token) {
                console.error("No token available for private mode");
                throw new Error("Authentication required");
            }

            console.log("Fetching owned modules...");
            const response = await fetch(`${config.apiUrl}?request=get_owned_modules`, {
                method: "GET",
                headers: {
                    "Authorization": "Bearer " + token,
                    "Content-Type": "application/json"
                }
            });

            console.log("Response status:", response.status);

            if (response.status === 401) {
                console.error("Token expired or invalid");
                logout();
                return;
            }

            if (!response.ok) {
                const errorText = await response.text();
                console.error("API Error:", response.status, errorText);
                throw new Error(`API returned ${response.status}`);
            }

            const json = await response.json();
            console.log("Received data:", json);

            const modules = json.modules || [];
            const heuristics = json.heuristics || [];

            // Clear connection lines for private mode
            if (map.getLayer('connections-layer')) map.removeLayer('connections-layer');
            if (map.getSource('connections')) map.removeSource('connections');

            // Merge modules with heuristics
            mergedData = modules.map(m => {
                const heuristic = heuristics.find(h => h.module_id === m.module_id);

                let lat = 0, long = 0;
                if (m.location) {
                    if (m.location.lat !== undefined) {
                        lat = m.location.lat;
                        long = m.location.long;
                    } else if (Array.isArray(m.location)) {
                        lat = m.location[0];
                        long = m.location[1];
                    }
                }

                return {
                    module_id: m.module_id,
                    lat: clampLat(lat),
                    long: long,
                    self_temp: heuristic ? heuristic.self_temp : 0,
                    deviation: heuristic ? heuristic.deviation : 0,
                    avg_neighbor_temp: heuristic ? (heuristic.avg_neighbor_temp === "no_neighbors" ? 0 : heuristic.avg_neighbor_temp) : 0,
                    within_range: heuristic ? heuristic.within_range : true
                };
            });
        }

        renderVisuals(mergedData);

    } catch (error) {
        console.error("Fetch error:", error);
        if (errorEl) {
            errorEl.classList.remove('hidden');
            errorEl.textContent = `Error: ${error.message}`;
        }
    } finally {
        if (loadingEl) loadingEl.classList.add('hidden');
    }
}

function renderVisuals(data) {
    data.sort((a, b) => String(a.module_id).localeCompare(String(b.module_id), undefined, { numeric: true }));

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

    const tableHead = document.querySelector('thead tr');
    const actionHeaderId = 'action-header';
    let actionHeader = document.getElementById(actionHeaderId);

    if (currentMode === 'private' && !actionHeader) {
        const th = document.createElement('th');
        th.id = actionHeaderId;
        th.textContent = 'Actions';
        tableHead.appendChild(th);
    } else if (currentMode !== 'private' && actionHeader) {
        actionHeader.remove();
    }

    const tableBody = document.getElementById('data-table-body');
    if (tableBody) {
        tableBody.innerHTML = '';
        data.forEach((sensor) => {
            const row = document.createElement('tr');
            let actionCell = '';

            if (currentMode === 'private') {
                actionCell = `
                    <td>
                        <button class="btn-link" style="font-size:0.8em;" onclick="updateLocation('${sensor.module_id}')">Update Loc</button>
                    </td>
                `;
            }

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
                ${actionCell}
            `;
            tableBody.appendChild(row);
        });
    }

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

function openClaimModal() {
    console.log("Claim button clicked!");

    const token = sessionStorage.getItem("auth_token");

    if (!token) {
        console.log("No token found, redirecting to login.");
        alert("Please log in first to claim a module.");
        login();
        return;
    }

    const modal = document.getElementById('claim-modal');
    if (modal) {
        console.log("Showing modal...");
        modal.style.display = 'flex';

        const input = document.getElementById('module-secret');
        if(input) {
            input.value = '';
            input.focus();
        }

        const err = document.getElementById('claim-error');
        const succ = document.getElementById('claim-success');
        if(err) err.style.display = 'none';
        if(succ) succ.style.display = 'none';
    } else {
        console.error("Error: Could not find element with id 'claim-modal'");
        alert("Error: Modal HTML is missing.");
    }
}

async function updateLocation(moduleId) {
    const latStr = prompt("Enter new Latitude (Float):");
    if (latStr === null) return;
    const longStr = prompt("Enter new Longitude (Float):");
    if (longStr === null) return;

    const lat = parseFloat(latStr);
    const long = parseFloat(longStr);

    if (isNaN(lat) || isNaN(long)) {
        alert("Invalid coordinates. Please enter valid floats.");
        return;
    }

    const token = sessionStorage.getItem("auth_token");
    if (!token) {
        login();
        return;
    }

    try {
        const response = await fetch(`${config.apiUrl}?request=update_location`, {
            method: "POST",
            headers: {
                "Authorization": "Bearer " + token,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                module_id: moduleId,
                latitude: lat,
                longitude: long
            })
        });

        if (response.ok) {
            alert("Location updated successfully.");
            fetchAndDisplayData();
        } else {
            const err = await response.json();
            alert("Update failed: " + (err.error || "Unknown error"));
        }
    } catch (e) {
        console.error(e);
        alert("Network error occurred.");
    }
}

initAuth();