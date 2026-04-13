import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import axios from 'axios';
import { io } from 'socket.io-client';
import './App.css';

// Fix marker icons
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom markers for different asset types
const assetIcons = {
  food_outlet: L.divIcon({ html: '🍽️', className: 'custom-marker food-marker', iconSize: [40, 40] }),
  building_condition: L.divIcon({ html: '🏛️', className: 'custom-marker building-marker', iconSize: [40, 40] }),
  aged_tree: L.divIcon({ html: '🌳', className: 'custom-marker tree-marker', iconSize: [40, 40] }),
  print_shop: L.divIcon({ html: '🖨️', className: 'custom-marker print-marker', iconSize: [40, 40] })
};

// Basemap configurations
const basemaps = {
  street: {
    name: 'Street Map',
    icon: '🗺️',
    description: 'CartoDB Light',
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB'
  },
  satellite: {
    name: 'Satellite',
    icon: '🛰️',
    description: 'High Resolution',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    attribution: '&copy; <a href="https://www.esri.com">Esri</a>'
  },
  hybrid: {
    name: 'Hybrid',
    icon: '🌍',
    description: 'Satellite + Labels',
    url: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    attribution: '&copy; <a href="https://maps.google.com">Google</a>'
  },
  dark: {
    name: 'Dark Mode',
    icon: '🌙',
    description: 'Night Viewing',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB'
  },
  topographic: {
    name: 'Topographic',
    icon: '⛰️',
    description: 'Terrain + Contours',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://opentopomap.org">OpenTopoMap</a>'
  },
  ocean: {
    name: 'Ocean',
    icon: '🌊',
    description: 'Bathymetry',
    url: 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
  }
};

// North Arrow Component
function NorthArrow() {
  const map = useMap();
  const [rotation, setRotation] = useState(0);
  
  useEffect(() => {
    const updateNorth = () => {
      if (map && map.getBearing) {
        setRotation(map.getBearing());
      }
    };
    map.on('zoomend moveend', updateNorth);
    return () => {
      map.off('zoomend moveend', updateNorth);
    };
  }, [map]);
  
  return (
    <div className="north-arrow" style={{ transform: `rotate(${rotation}deg)` }}>
      <div className="north-arrow-icon">⬆️</div>
      <div className="north-label">N</div>
    </div>
  );
}

// Scale Bar Component
function ScaleBar() {
  const map = useMap();
  const [scale, setScale] = useState(100);
  
  useEffect(() => {
    const updateScale = () => {
      const center = map.getCenter();
      const point = map.latLngToContainerPoint(center);
      const point2 = L.point(point.x + 100, point.y);
      const latLng2 = map.containerPointToLatLng(point2);
      const distance = center.distanceTo(latLng2);
      setScale(Math.round(distance));
    };
    map.on('zoomend moveend', updateScale);
    updateScale();
    return () => {
      map.off('zoomend moveend', updateScale);
    };
  }, [map]);
  
  return (
    <div className="scale-bar">
      <div className="scale-line"></div>
      <div className="scale-text">{scale} m</div>
    </div>
  );
}

// Basemap Selector Panel
function BasemapSelector({ currentBasemap, onBasemapChange, isOpen, setIsOpen }) {
  return (
    <div className={`basemap-panel ${isOpen ? 'open' : ''}`}>
      <div className="basemap-header" onClick={() => setIsOpen(!isOpen)}>
        <span className="basemap-header-icon">🗺️</span>
        <span className="basemap-header-title">Map Layers</span>
        <span className="basemap-header-arrow">{isOpen ? '▼' : '▲'}</span>
      </div>
      {isOpen && (
        <div className="basemap-content">
          {Object.entries(basemaps).map(([key, bm]) => (
            <button
              key={key}
              className={`basemap-item ${currentBasemap === key ? 'active' : ''}`}
              onClick={() => onBasemapChange(key)}
            >
              <span className="basemap-item-icon">{bm.icon}</span>
              <div className="basemap-item-info">
                <span className="basemap-item-name">{bm.name}</span>
                <span className="basemap-item-desc">{bm.description}</span>
              </div>
              {currentBasemap === key && <span className="basemap-item-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Stats Card Component
function StatCard({ title, value, icon, color, subtitle }) {
  return (
    <div className="stat-card" style={{ borderLeftColor: color }}>
      <div className="stat-card-icon">{icon}</div>
      <div className="stat-card-content">
        <div className="stat-card-value">{value}</div>
        <div className="stat-card-title">{title}</div>
        {subtitle && <div className="stat-card-subtitle">{subtitle}</div>}
      </div>
    </div>
  );
}

// Asset Type Filter Component
function AssetFilter({ selectedType, onTypeChange, counts }) {
  const types = [
    { id: 'all', label: 'All Assets', icon: '📍', color: '#666' },
    { id: 'food_outlet', label: 'Food Outlets', icon: '🍽️', color: '#FF6B35' },
    { id: 'building_condition', label: 'Buildings', icon: '🏛️', color: '#4A90D9' },
    { id: 'aged_tree', label: 'Aged Trees', icon: '🌳', color: '#2ECC71' },
    { id: 'print_shop', label: 'Printing Stations', icon: '🖨️', color: '#9B59B6' }
  ];

  return (
    <div className="asset-filters">
      {types.map(type => (
        <button
          key={type.id}
          className={`filter-chip ${selectedType === type.id ? 'active' : ''}`}
          onClick={() => onTypeChange(type.id)}
          style={selectedType === type.id ? { background: type.color, borderColor: type.color } : {}}
        >
          <span className="filter-chip-icon">{type.icon}</span>
          <span className="filter-chip-label">{type.label}</span>
          {counts[type.id] !== undefined && (
            <span className="filter-chip-count">{counts[type.id]}</span>
          )}
        </button>
      ))}
    </div>
  );
}

// Recent Activity Item
function ActivityItem({ asset }) {
  const getIcon = () => {
    switch(asset.type) {
      case 'food_outlet': return '🍽️';
      case 'building_condition': return '🏛️';
      case 'aged_tree': return '🌳';
      case 'print_shop': return '🖨️';
      default: return '📍';
    }
  };

  return (
    <div className="activity-item">
      <div className="activity-icon">{getIcon()}</div>
      <div className="activity-details">
        <div className="activity-title">{asset.type?.replace('_', ' ')}</div>
        <div className="activity-location">
          📍 {asset.latitude?.toFixed(4)}, {asset.longitude?.toFixed(4)}
        </div>
        <div className="activity-meta">
          <span>👤 {asset.collector_name || 'Anonymous'}</span>
          <span>📋 {asset.condition || 'N/A'}</span>
        </div>
      </div>
      <div className="activity-time">
        {asset.collected_at ? new Date(asset.collected_at).toLocaleTimeString() : 'Just now'}
      </div>
    </div>
  );
}

function App() {
  const [assets, setAssets] = useState([]);
  const [stats, setStats] = useState([]);
  const [selectedType, setSelectedType] = useState('all');
  const [showRadius, setShowRadius] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [center, setCenter] = useState([-17.7825, 31.0525]);
  const [socket, setSocket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAbout, setShowAbout] = useState(false);
  const [totalCollected, setTotalCollected] = useState(0);
  const [lastSubmission, setLastSubmission] = useState(null);
  const [currentBasemap, setCurrentBasemap] = useState('street');
  const [isBasemapOpen, setIsBasemapOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mapZoom, setMapZoom] = useState(15);

  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

  // Fetch assets
  const fetchAssets = async () => {
    try {
      const url = selectedType === 'all' ? `${API_URL}/assets` : `${API_URL}/assets?type=${selectedType}`;
      const response = await axios.get(url);
      const assetsData = Array.isArray(response.data) ? response.data : [];
      setAssets(assetsData);
      setTotalCollected(assetsData.length);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching assets:', error);
      setAssets([]);
      setLoading(false);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/assets/stats`);
      const statsData = Array.isArray(response.data) ? response.data : [];
      setStats(statsData);
    } catch (error) {
      console.error('Error fetching stats:', error);
      setStats([]);
    }
  };

  // Get counts for filter chips
  const getCounts = () => {
    const counts = { all: assets.length };
    stats.forEach(stat => {
      counts[stat.type] = stat.count;
    });
    return counts;
  };

  // Setup WebSocket
  useEffect(() => {
    const newSocket = io(API_URL);
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to server');
      addNotification('Connected to server', 'success');
    });

    newSocket.on('new_asset', (asset) => {
      setAssets(prev => [asset, ...prev]);
      fetchStats();
      setLastSubmission(new Date());
      setTotalCollected(prev => prev + 1);
      addNotification(`New ${asset.type?.replace('_', ' ')} added!`, 'info', asset);
    });

    newSocket.on('delete_asset', ({ id }) => {
      setAssets(prev => prev.filter(a => a.id !== id));
      fetchStats();
      addNotification('Asset deleted', 'warning');
    });

    newSocket.on('initial_data', (data) => {
      const assetsData = Array.isArray(data) ? data : [];
      setAssets(assetsData);
      setTotalCollected(assetsData.length);
      setLoading(false);
    });

    return () => newSocket.close();
  }, [API_URL]);

  // Add notification
  const addNotification = (message, type = 'info', asset = null) => {
    const id = Date.now();
    setNotifications(prev => [{ id, message, type, asset, timestamp: new Date() }, ...prev].slice(0, 5));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  // Initial load
  useEffect(() => {
    fetchAssets();
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [selectedType]);

  // Filter assets
  const filteredAssets = assets.filter(asset => {
    if (selectedType !== 'all' && asset.type !== selectedType) return false;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (asset.collector_name?.toLowerCase().includes(searchLower) ||
              asset.description?.toLowerCase().includes(searchLower) ||
              asset.type?.toLowerCase().includes(searchLower));
    }
    return true;
  });

  // Get asset color
  const getAssetColor = (type) => {
    const colors = {
      food_outlet: '#FF6B35',
      building_condition: '#4A90D9',
      aged_tree: '#2ECC71',
      print_shop: '#9B59B6'
    };
    return colors[type] || '#95a5a6';
  };

  // Format reliability safely
  const formatReliability = (value) => {
    if (value === null || value === undefined) return 'N/A';
    const num = parseFloat(value);
    if (isNaN(num)) return 'N/A';
    return num.toFixed(1);
  };

  // Accessibility circles
  const accessibilityCircles = showRadius ? filteredAssets.map(asset => ({
    center: [asset.latitude, asset.longitude],
    radius: 500,
    color: getAssetColor(asset.type)
  })) : [];

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loader"></div>
        <h2>Loading Campus Assets...</h2>
        <p>University of Zimbabwe GIS Dashboard</p>
      </div>
    );
  }

  const counts = getCounts();

  return (
    <div className="app">
      {/* Sidebar */}
      <div className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div className="sidebar-toggle" onClick={() => setSidebarCollapsed(!sidebarCollapsed)}>
          {sidebarCollapsed ? '→' : '←'}
        </div>
        
        {!sidebarCollapsed && (
          <>
            <div className="logo">
              <h1>📍 UZ Campus</h1>
              <p>Asset & Infrastructure GIS</p>
              <div className="badge">HGISEO407</div>
            </div>

            {/* Stats Overview */}
            <div className="stats-overview">
              <div className="stats-header">
                <h3>📊 Overview</h3>
                <span className="stats-date">{new Date().toLocaleDateString()}</span>
              </div>
              <div className="stats-grid">
                <StatCard 
                  title="Total Assets" 
                  value={totalCollected} 
                  icon="📍" 
                  color="#667eea"
                />
                {stats.map(stat => (
                  <StatCard 
                    key={stat.type}
                    title={stat.type?.replace('_', ' ')} 
                    value={stat.count || 0} 
                    icon={stat.type === 'food_outlet' ? '🍽️' : stat.type === 'building_condition' ? '🏛️' : stat.type === 'aged_tree' ? '🌳' : '🖨️'}
                    color={getAssetColor(stat.type)}
                    subtitle={`⭐ ${formatReliability(stat.avg_reliability)}`}
                  />
                ))}
              </div>
            </div>

            {/* Asset Filters */}
            <div className="filters-section">
              <h3>🔍 Filter Assets</h3>
              <AssetFilter 
                selectedType={selectedType} 
                onTypeChange={setSelectedType} 
                counts={counts}
              />
              <div className="search-box">
                <input
                  type="text"
                  placeholder="Search by collector or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                <span className="search-icon">🔍</span>
              </div>
              <label className="checkbox-label">
                <input type="checkbox" checked={showRadius} onChange={() => setShowRadius(!showRadius)} />
                <span>Show 500m Service Radius</span>
              </label>
            </div>

            {/* Recent Activity */}
            <div className="activity-section">
              <h3>🔄 Recent Activity</h3>
              <div className="activity-list">
                {assets.slice(0, 5).map(asset => (
                  <ActivityItem key={asset.id} asset={asset} />
                ))}
                {assets.length === 0 && (
                  <div className="activity-empty">
                    <span>📭</span>
                    <p>No submissions yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="action-buttons">
              <button className="export-btn" onClick={async () => {
                try {
                  const response = await axios.get(`${API_URL}/export/geojson`);
                  const blob = new Blob([JSON.stringify(response.data, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `uz_assets_${new Date().toISOString().slice(0, 19)}.geojson`;
                  a.click();
                  URL.revokeObjectURL(url);
                  addNotification('Export started!', 'success');
                } catch (error) {
                  addNotification('Export failed', 'warning');
                }
              }}>
                📥 Export GeoJSON
              </button>
              <button className="about-btn" onClick={() => setShowAbout(true)}>
                ℹ️ About
              </button>
            </div>
          </>
        )}
      </div>

      {/* About Modal */}
      {showAbout && (
        <div className="modal-overlay" onClick={() => setShowAbout(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-icon">🏛️</span>
              <h2>University of Zimbabwe</h2>
            </div>
            <h3>HGISEO407: GIS for Asset & Infrastructure Management</h3>
            <div className="modal-divider"></div>
            <div className="modal-info-row">
              <span className="modal-label">📋 Course:</span>
              <span className="modal-value">GIS for Asset & Infrastructure Management</span>
            </div>
            <div className="modal-info-row">
              <span className="modal-label">👥 Developer:</span>
              <span className="modal-value">GROUP 3</span>
            </div>
            <div className="modal-info-row">
              <span className="modal-label">📅 Semester:</span>
              <span className="modal-value">2026</span>
            </div>
            <div className="modal-divider"></div>
            <div className="modal-info-row">
              <span className="modal-label">🗺️ Assets:</span>
              <span className="modal-value">Food Outlets, Buildings, Trees, Printing Stations</span>
            </div>
            <div className="modal-info-row">
              <span className="modal-label">💾 Database:</span>
              <span className="modal-value">PostgreSQL / PostGIS</span>
            </div>
            <div className="modal-info-row">
              <span className="modal-label">🔄 Sync:</span>
              <span className="modal-value">Real-time via Socket.IO</span>
            </div>
            <div className="modal-divider"></div>
            <div className="modal-footer">
              <p className="modal-credits">Campus Asset Data Collection System</p>
              <p className="modal-credits-small">© 2026 - All data feeds into PostGIS Geodatabase</p>
            </div>
            <button className="close-btn" onClick={() => setShowAbout(false)}>Close</button>
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="map-container">
        <MapContainer
          center={center}
          zoom={mapZoom}
          style={{ height: '100%', width: '100%' }}
          zoomControl={false}
          whenCreated={(map) => {
            map.on('zoomend', () => setMapZoom(map.getZoom()));
          }}
        >
          <ZoomControl position="bottomright" />
          
          <TileLayer
            key={currentBasemap}
            attribution={basemaps[currentBasemap].attribution}
            url={basemaps[currentBasemap].url}
          />
          
          <NorthArrow />
          <ScaleBar />
          <BasemapSelector 
            currentBasemap={currentBasemap}
            onBasemapChange={setCurrentBasemap}
            isOpen={isBasemapOpen}
            setIsOpen={setIsBasemapOpen}
          />

          {/* Accessibility Circles */}
          {accessibilityCircles.map((circle, idx) => (
            <Circle
              key={idx}
              center={circle.center}
              radius={circle.radius}
              pathOptions={{ color: circle.color, fillColor: circle.color, fillOpacity: 0.1, weight: 2 }}
            />
          ))}

          {/* Asset Markers */}
          {filteredAssets.map(asset => (
            <Marker
              key={asset.id}
              position={[asset.latitude, asset.longitude]}
              icon={assetIcons[asset.type] || assetIcons.food_outlet}
            >
              <Popup>
                <div className="popup-content">
                  <h3>{asset.type?.replace('_', ' ').toUpperCase() || 'ASSET'}</h3>
                  <p><strong>📍 Location:</strong> {asset.latitude?.toFixed(6)}, {asset.longitude?.toFixed(6)}</p>
                  <p><strong>👤 Collector:</strong> {asset.collector_name || 'Anonymous'}</p>
                  <p><strong>📋 Condition:</strong> {asset.condition || 'Not specified'}</p>
                  <p><strong>⭐ Reliability:</strong> {'★'.repeat(asset.reliability_score || 3)}{'☆'.repeat(5 - (asset.reliability_score || 3))}</p>
                  <p><strong>📅 Collected:</strong> {asset.collected_at ? new Date(asset.collected_at).toLocaleString() : 'Unknown'}</p>
                  {asset.description && <p><strong>📝 Notes:</strong> {asset.description}</p>}
                  {asset.photo_url && <img src={`${API_URL}${asset.photo_url}`} alt="Asset" style={{ maxWidth: '100%', marginTop: '10px', borderRadius: '5px' }} />}
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {/* Notifications */}
        <div className="notifications">
          {notifications.map(notif => (
            <div key={notif.id} className={`notification ${notif.type}`}>
              <span className="notification-message">{notif.message}</span>
              {notif.asset && (
                <div className="notification-preview">
                  📍 {notif.asset.latitude?.toFixed(4)}, {notif.asset.longitude?.toFixed(4)}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Map Controls Info */}
        <div className="map-info">
          <div className="info-card">
            <span>📍 {filteredAssets.length} assets shown</span>
            <span>🔍 Zoom: {mapZoom}</span>
            <span>🗺️ {basemaps[currentBasemap].name}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;