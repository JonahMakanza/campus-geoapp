import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
  ScrollView,
  Alert,
  Platform
} from 'react-native';
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from 'react-native-maps';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import networkManager from '../utils/networkManager';

const { width, height } = Dimensions.get('window');

export default function MapScreen() {
  const router = useRouter();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('all');
  const [userLocation, setUserLocation] = useState(null);
  const [locationPermission, setLocationPermission] = useState(false);
  const [region, setRegion] = useState({
    latitude: -17.7825,
    longitude: 31.0525,
    latitudeDelta: 0.02,
    longitudeDelta: 0.02,
  });
  const mapRef = useRef(null);

  const assetTypes = [
    { id: 'all', label: 'All', color: '#666', emoji: '📍' },
    { id: 'food_outlet', label: 'Food Outlets', color: '#FF6B35', emoji: '🍽️' },
    { id: 'building_condition', label: 'Buildings', color: '#4A90D9', emoji: '🏛️' },
    { id: 'aged_tree', label: 'Aged Trees', color: '#2ECC71', emoji: '🌳' },
    { id: 'print_shop', label: 'Printing Stations', color: '#9B59B6', emoji: '🖨️' },
  ];

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationPermission(false);
        Alert.alert('Permission Denied', 'Location access is needed to see your position on the map.');
        return;
      }
      setLocationPermission(true);
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const userLoc = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      };
      setUserLocation(userLoc);
      setRegion({
        ...region,
        latitude: userLoc.latitude,
        longitude: userLoc.longitude,
      });
      if (mapRef.current) {
        mapRef.current.animateToRegion({
          ...userLoc,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        }, 1000);
      }
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const fetchAssets = async () => {
    try {
      const serverUrl = networkManager.getServerUrl();
      const isOnline = networkManager.isConnected();
      let assetData = [];

      if (isOnline && serverUrl) {
        const url = selectedType === 'all'
          ? `${serverUrl}/assets`
          : `${serverUrl}/assets?type=${selectedType}`;
        const response = await fetch(url);
        assetData = await response.json();
        await AsyncStorage.setItem('cached_assets', JSON.stringify(assetData));
      } else {
        const cached = await AsyncStorage.getItem('cached_assets');
        if (cached) {
          assetData = JSON.parse(cached);
          if (selectedType !== 'all') {
            assetData = assetData.filter(a => a.type === selectedType);
          }
        }
      }
      setAssets(assetData);
    } catch (error) {
      console.error('Error fetching assets:', error);
      const cached = await AsyncStorage.getItem('cached_assets');
      if (cached) setAssets(JSON.parse(cached));
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchAssets();
    }, [selectedType])
  );

  useEffect(() => {
    getUserLocation();
  }, []);

  const getMarkerColor = (type) => {
    const found = assetTypes.find(t => t.id === type);
    return found ? found.color : '#666';
  };

  const getMarkerEmoji = (type) => {
    const found = assetTypes.find(t => t.id === type);
    return found ? found.emoji : '📍';
  };

  const getAssetDisplayName = (asset) => {
    return asset.outlet_name || asset.building_name || asset.tree_id || asset.shop_name || 'Location';
  };

  const focusOnAsset = (asset) => {
    const newRegion = {
      latitude: parseFloat(asset.latitude),
      longitude: parseFloat(asset.longitude),
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    };
    setRegion(newRegion);
    if (mapRef.current) {
      mapRef.current.animateToRegion(newRegion, 500);
    }
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...userLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    } else {
      getUserLocation();
    }
  };

  const handleNavigate = (asset) => {
    const displayName = getAssetDisplayName(asset);
    router.push({
      pathname: '/navigate',
      params: {
        lat: asset.latitude.toString(),
        lng: asset.longitude.toString(),
        name: displayName,
        type: asset.type
      }
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D9E75" />
        <Text style={styles.loadingText}>Loading map data...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {assetTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.filterButton,
              selectedType === type.id && styles.filterButtonActive,
            ]}
            onPress={() => setSelectedType(type.id)}
          >
            <Text style={styles.filterEmoji}>{type.emoji}</Text>
            <Text
              style={[
                styles.filterText,
                selectedType === type.id && styles.filterTextActive,
              ]}
            >
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        region={region}
        showsUserLocation={locationPermission}
        showsMyLocationButton={false}
        showsCompass={true}
        zoomEnabled={true}
        zoomControlEnabled={true}
      >
        {assets.map((asset) => (
          <Marker
            key={asset.id}
            coordinate={{
              latitude: parseFloat(asset.latitude),
              longitude: parseFloat(asset.longitude),
            }}
            pinColor={getMarkerColor(asset.type)}
            title={asset.type?.replace(/_/g, ' ').toUpperCase()}
            description={`Condition: ${asset.condition || 'N/A'} | By: ${asset.collector_name || 'Unknown'}`}
            onPress={() => focusOnAsset(asset)}
          >
            <Callout>
              <View style={styles.callout}>
                <Text style={styles.calloutEmoji}>{getMarkerEmoji(asset.type)}</Text>
                <Text style={styles.calloutType}>
                  {asset.type?.replace(/_/g, ' ').toUpperCase()}
                </Text>
                <Text style={styles.calloutLocation}>
                  📍 {parseFloat(asset.latitude).toFixed(4)}, {parseFloat(asset.longitude).toFixed(4)}
                </Text>
                <Text style={styles.calloutCondition}>
                  📋 Condition: {asset.condition || 'Not recorded'}
                </Text>
                <Text style={styles.calloutCollector}>
                  👤 Collector: {asset.collector_name || 'Anonymous'}
                </Text>
                <Text style={styles.calloutReliability}>
                  ⭐ Reliability: {'★'.repeat(asset.reliability_score || 3)}{'☆'.repeat(5 - (asset.reliability_score || 3))}
                </Text>
                <Text style={styles.calloutTime}>
                  🕐 {new Date(asset.collected_at).toLocaleString()}
                </Text>
                {asset.description && (
                  <Text style={styles.calloutDesc} numberOfLines={2}>
                    📝 {asset.description}
                  </Text>
                )}
                <TouchableOpacity
                  style={styles.navigateBtn}
                  onPress={() => handleNavigate(asset)}
                >
                  <Text style={styles.navigateBtnText}>🚗 Navigate here</Text>
                </TouchableOpacity>
              </View>
            </Callout>
          </Marker>
        ))}
      </MapView>

      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          📍 {assets.length} assets on map
        </Text>
        <TouchableOpacity onPress={centerOnUser} style={styles.locationButton}>
          <Text style={styles.locationButtonText}>📍 My Location</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Legend</Text>
        {assetTypes.filter(t => t.id !== 'all').map(type => (
          <View key={type.id} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: type.color }]} />
            <Text style={styles.legendText}>{type.emoji} {type.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
  filterContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 10,
    left: 0,
    right: 0,
    zIndex: 10,
    maxHeight: 50,
  },
  filterContent: {
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.95)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 25,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  filterButtonActive: {
    backgroundColor: '#1D9E75',
  },
  filterEmoji: {
    fontSize: 16,
    marginRight: 6,
  },
  filterText: {
    color: '#333',
    fontWeight: '500',
    fontSize: 13,
  },
  filterTextActive: {
    color: '#fff',
  },
  map: {
    flex: 1,
  },
  callout: {
    width: 240,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  calloutEmoji: {
    fontSize: 28,
    textAlign: 'center',
    marginBottom: 5,
  },
  calloutType: {
    fontWeight: 'bold',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    color: '#1a1a2e',
  },
  calloutLocation: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  calloutCondition: {
    fontSize: 11,
    color: '#555',
    marginBottom: 4,
  },
  calloutCollector: {
    fontSize: 10,
    color: '#888',
    marginBottom: 4,
  },
  calloutReliability: {
    fontSize: 10,
    color: '#f39c12',
    marginBottom: 4,
  },
  calloutTime: {
    fontSize: 9,
    color: '#aaa',
    marginBottom: 4,
  },
  calloutDesc: {
    fontSize: 10,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  navigateBtn: {
    backgroundColor: '#1D9E75',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginTop: 10,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  navigateBtnText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  statsBar: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 30,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statsText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  locationButton: {
    backgroundColor: '#1D9E75',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  locationButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '500',
  },
  legend: {
    position: 'absolute',
    bottom: 80,
    right: 10,
    backgroundColor: 'rgba(255,255,255,0.95)',
    padding: 10,
    borderRadius: 10,
    minWidth: 130,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  legendTitle: {
    fontWeight: 'bold',
    fontSize: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  legendText: {
    fontSize: 10,
    color: '#333',
  },
});