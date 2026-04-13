const { app, BrowserWindow, Menu, Tray, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let tray = null;
let isOffline = false;
let cachedData = null;

// Check if server is reachable
async function checkServerStatus() {
    const fetch = (await import('node-fetch')).default;
    try {
        const response = await fetch('http://localhost:3000', { timeout: 3000 });
        isOffline = !response.ok;
        return response.ok;
    } catch (error) {
        isOffline = true;
        return false;
    }
}

// Load cached data from local storage
function loadCachedData() {
    const cachePath = path.join(app.getPath('userData'), 'cached_assets.json');
    if (fs.existsSync(cachePath)) {
        try {
            cachedData = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
            return cachedData;
        } catch (e) {
            return null;
        }
    }
    return null;
}

// Save data to cache
function saveToCache(data) {
    const cachePath = path.join(app.getPath('userData'), 'cached_assets.json');
    fs.writeFileSync(cachePath, JSON.stringify(data), 'utf8');
}

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 1000,
        minHeight: 700,
        title: 'Campus GeoApp - UZ Asset Management',
        icon: path.join(__dirname, 'icon.ico'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true
        },
        backgroundColor: '#1a1a2e',
        show: false
    });

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });

    // Load either live server or offline fallback
    const checkAndLoad = async () => {
        const serverOnline = await checkServerStatus();
        
        if (serverOnline) {
            mainWindow.loadURL('http://localhost:3000');
            mainWindow.webContents.on('did-fail-load', () => {
                loadOfflineMode();
            });
        } else {
            loadOfflineMode();
        }
    };

    function loadOfflineMode() {
        const offlineHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Campus GeoApp - Offline Mode</title>
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
                    color: #fff;
                    min-height: 100vh;
                    padding: 20px;
                }
                .container { max-width: 1200px; margin: 0 auto; }
                .header {
                    background: rgba(255,255,255,0.1);
                    padding: 20px;
                    border-radius: 15px;
                    margin-bottom: 30px;
                    backdrop-filter: blur(10px);
                }
                h1 { font-size: 2em; margin-bottom: 10px; }
                .offline-badge {
                    background: #ff6b6b;
                    display: inline-block;
                    padding: 5px 15px;
                    border-radius: 20px;
                    font-size: 0.8em;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 30px;
                }
                .stat-card {
                    background: rgba(255,255,255,0.1);
                    padding: 20px;
                    border-radius: 15px;
                    text-align: center;
                }
                .stat-number { font-size: 2.5em; font-weight: bold; color: #4ecdc4; }
                .assets-list {
                    background: rgba(255,255,255,0.1);
                    border-radius: 15px;
                    padding: 20px;
                }
                .asset-item {
                    background: rgba(255,255,255,0.05);
                    padding: 15px;
                    margin-bottom: 10px;
                    border-radius: 10px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .asset-type {
                    font-weight: bold;
                    padding: 5px 10px;
                    border-radius: 5px;
                    font-size: 0.8em;
                }
                .asset-type.food { background: #ff6b6b; }
                .asset-type.building { background: #4ecdc4; }
                .asset-type.tree { background: #2ecc71; }
                .asset-type.print { background: #9b59b6; }
                .refresh-btn {
                    background: #4ecdc4;
                    color: #1a1a2e;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 5px;
                    cursor: pointer;
                    margin-top: 20px;
                }
                .status { margin-top: 20px; padding: 10px; border-radius: 5px; text-align: center; }
                .status.online { background: #2ecc71; }
                .status.offline { background: #e74c3c; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📍 Campus GeoApp</h1>
                    <p>University of Zimbabwe - Asset & Infrastructure Management</p>
                    <span class="offline-badge">⚠️ OFFLINE MODE</span>
                </div>
                <div class="stats-grid" id="statsGrid">
                    <div class="stat-card"><div class="stat-number" id="totalCount">0</div><div>Total Assets</div></div>
                    <div class="stat-card"><div class="stat-number" id="foodCount">0</div><div>Food Outlets</div></div>
                    <div class="stat-card"><div class="stat-number" id="buildingCount">0</div><div>Buildings</div></div>
                    <div class="stat-card"><div class="stat-number" id="treeCount">0</div><div>Trees</div></div>
                    <div class="stat-card"><div class="stat-number" id="printCount">0</div><div>Print Stations</div></div>
                </div>
                <div class="assets-list">
                    <h3>📋 Cached Assets</h3>
                    <div id="assetsList">Loading cached data...</div>
                    <button class="refresh-btn" onclick="location.reload()">🔄 Refresh</button>
                </div>
                <div class="status offline" id="status">Status: Offline - Showing cached data</div>
            </div>
            <script>
                async function loadCachedData() {
                    try {
                        const response = await fetch('http://localhost:3001/assets');
                        const assets = await response.json();
                        updateUI(assets);
                        document.getElementById('status').className = 'status online';
                        document.getElementById('status').innerHTML = '✅ Status: Online - Live data';
                    } catch (e) {
                        // Load from localStorage
                        const cached = localStorage.getItem('campus_assets');
                        if (cached) {
                            const assets = JSON.parse(cached);
                            updateUI(assets);
                        }
                    }
                }
                function updateUI(assets) {
                    document.getElementById('totalCount').innerText = assets.length;
                    document.getElementById('foodCount').innerText = assets.filter(a => a.type === 'food_outlet').length;
                    document.getElementById('buildingCount').innerText = assets.filter(a => a.type === 'building_condition').length;
                    document.getElementById('treeCount').innerText = assets.filter(a => a.type === 'aged_tree').length;
                    document.getElementById('printCount').innerText = assets.filter(a => a.type === 'print_shop').length;
                    
                    const listHtml = assets.slice(0, 20).map(a => \`
                        <div class="asset-item">
                            <div>\${new Date(a.collected_at).toLocaleDateString()}</div>
                            <div><span class="asset-type \${a.type === 'food_outlet' ? 'food' : a.type === 'building_condition' ? 'building' : a.type === 'aged_tree' ? 'tree' : 'print'}">\${a.type}</span></div>
                            <div>\${a.latitude.toFixed(4)}, \${a.longitude.toFixed(4)}</div>
                            <div>Condition: \${a.condition || 'N/A'}</div>
                        </div>
                    \`).join('');
                    document.getElementById('assetsList').innerHTML = listHtml || 'No cached assets';
                }
                loadCachedData();
                setInterval(loadCachedData, 30000);
            </script>
        </body>
        </html>
        `;
        
        const offlinePath = path.join(__dirname, 'offline.html');
        fs.writeFileSync(offlinePath, offlineHtml);
        mainWindow.loadFile('offline.html');
    }

    checkAndLoad();

    // Set up periodic server check
    setInterval(async () => {
        const isOnline = await checkServerStatus();
        if (isOnline && isOffline) {
            mainWindow.loadURL('http://localhost:3000');
        }
    }, 10000);

    // Create application menu
    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'Export Data as GeoJSON',
                    click: async () => {
                        const { filePath } = await dialog.showSaveDialog({
                            title: 'Export Assets as GeoJSON',
                            defaultPath: 'uz_assets_export.geojson',
                            filters: [{ name: 'GeoJSON', extensions: ['geojson'] }]
                        });
                        if (filePath) {
                            try {
                                const fetch = (await import('node-fetch')).default;
                                const response = await fetch('http://localhost:3001/export/geojson');
                                const data = await response.json();
                                fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
                                dialog.showMessageBox({ message: 'Export successful!', type: 'info' });
                            } catch (e) {
                                dialog.showMessageBox({ message: 'Server not running. Cannot export.', type: 'error' });
                            }
                        }
                    }
                },
                { type: 'separator' },
                { role: 'quit' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { role: 'reload' },
                { role: 'toggleDevTools' },
                { type: 'separator' },
                { role: 'resetZoom' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { type: 'separator' },
                { role: 'togglefullscreen' }
            ]
        },
        {
            label: 'Help',
            submenu: [
                {
                    label: 'About',
                    click: () => {
                        dialog.showMessageBox({
                            title: 'About Campus GeoApp',
                            message: 'Campus GeoApp v1.0\nUniversity of Zimbabwe Asset Management System\n\nBuilt with Electron, React, Node.js, PostGIS'
                        });
                    }
                }
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);
}

app.whenReady().then(() => {
    createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
});