import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Vibration,
  Dimensions
} from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import * as Location from 'expo-location';
import { useRouter, useLocalSearchParams } from 'expo-router';

const { width, height } = Dimensions.get('window');

export default function NavigateScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [destination, setDestination] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [route, setRoute] = useState(null);
  const [loading, setLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [distance, setDistance] = useState(null);
  const [duration, setDuration] = useState(null);
  const [arrived, setArrived] = useState(false);
  const [steps, setSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [rerouting, setRerouting] = useState(false);
  const mapRef = useRef(null);
  const watchId = useRef(null);
  const stepInterval = useRef(null);

  useEffect(() => {
    if (params.lat && params.lng && params.name) {
      setDestination({
        latitude: parseFloat(params.lat),
        longitude: parseFloat(params.lng),
        name: params.name,
        type: params.type
      });
    } else {
      Alert.alert('Error', 'No destination specified', [{ text: 'OK', onPress: () => router.back() }]);
    }
    getUserLocation();
    
    return () => {
      if (watchId.current) watchId.current.remove();
      if (stepInterval.current) clearInterval(stepInterval.current);
    };
  }, []);

  const getUserLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Location access is needed for navigation');
      router.back();
      return;
    }
    
    const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setUserLocation({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude
    });
    setLoading(false);
    
    watchId.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 10 },
      (newLocation) => {
        const newUserLoc = {
          latitude: newLocation.coords.latitude,
          longitude: newLocation.coords.longitude
        };
        setUserLocation(newUserLoc);
        if (navigating && !arrived) {
          checkArrival(newUserLoc);
          if (route) checkOffCourse(newUserLoc);
        }
      }
    );
  };

  const calculateRoute = async () => {
    if (!userLocation || !destination) return;
    
    setLoading(true);
    setRerouting(false);
    
    const url = `https://router.project-osrm.org/route/v1/driving/${userLocation.longitude},${userLocation.latitude};${destination.longitude},${destination.latitude}?overview=full&geometries=geojson&steps=true`;
    
    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const routeData = data.routes[0];
        const coordinates = routeData.geometry.coordinates.map(coord => ({
          latitude: coord[1],
          longitude: coord[0]
        }));
        
        setRoute(coordinates);
        setDistance((routeData.distance / 1000).toFixed(2));
        setDuration(Math.round(routeData.duration / 60));
        
        const turnSteps = routeData.legs[0].steps.map((step, idx) => ({
          id: idx,
          instruction: step.maneuver.instruction,
          distance: (step.distance / 1000).toFixed(2),
          modifier: step.maneuver.modifier
        }));
        setSteps(turnSteps);
        
        if (mapRef.current && coordinates.length > 0) {
          mapRef.current.fitToCoordinates([userLocation, destination], {
            edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
            animated: true
          });
        }
        
        setNavigating(true);
        
        if (turnSteps.length > 0) {
          showInstruction(turnSteps[0], 0);
        }
        
        startStepGuidance(turnSteps);
      } else {
        Alert.alert('Error', 'Could not find route to destination');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to calculate route. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const startStepGuidance = (turnSteps) => {
    if (stepInterval.current) clearInterval(stepInterval.current);
    
    let stepIndex = 0;
    stepInterval.current = setInterval(() => {
      if (stepIndex < turnSteps.length && !arrived && navigating) {
        showInstruction(turnSteps[stepIndex], stepIndex);
        setCurrentStep(stepIndex);
        stepIndex++;
      } else if (stepIndex >= turnSteps.length && !arrived) {
        if (stepInterval.current) clearInterval(stepInterval.current);
      }
    }, 10000);
  };

  const showInstruction = (step, index) => {
    let directionIcon = '⬆️';
    switch (step.modifier) {
      case 'left': directionIcon = '⬅️'; break;
      case 'right': directionIcon = '➡️'; break;
      case 'straight': directionIcon = '⬆️'; break;
      case 'uturn': directionIcon = '🔄'; break;
      case 'slight left': directionIcon = '↖️'; break;
      case 'slight right': directionIcon = '↗️'; break;
      default: directionIcon = '⬆️';
    }
    
    Vibration.vibrate(200);
    Alert.alert(`${directionIcon} Step ${index + 1}`, `${step.instruction}\n\n📏 Distance: ${step.distance} km`, [{ text: 'OK' }]);
  };

  const checkArrival = (currentLocation) => {
    if (!destination || arrived) return;
    
    const distanceToDest = getDistanceFromLatLonInKm(
      currentLocation.latitude, currentLocation.longitude,
      destination.latitude, destination.longitude
    );
    
    if (distanceToDest < 0.05) {
      setArrived(true);
      setNavigating(false);
      Vibration.vibrate([500, 200, 500]);
      if (stepInterval.current) clearInterval(stepInterval.current);
      Alert.alert('📍 You have arrived!', `You have reached ${destination.name}`, [
        { text: 'OK', onPress: () => router.back() }
      ]);
    }
  };

  const checkOffCourse = async (currentLocation) => {
    if (!route || route.length === 0 || rerouting || arrived) return;
    
    let minDistance = Infinity;
    for (const point of route) {
      const dist = getDistanceFromLatLonInKm(
        currentLocation.latitude, currentLocation.longitude,
        point.latitude, point.longitude
      );
      if (dist < minDistance) minDistance = dist;
    }
    
    if (minDistance > 0.2) {
      setRerouting(true);
      Vibration.vibrate([300, 100, 300]);
      Alert.alert('⚠️ Off Route', 'You have deviated from the planned route. Recalculate?', [
        { text: 'Recalculate', onPress: async () => { await calculateRoute(); setRerouting(false); } },
        { text: 'Continue', style: 'cancel', onPress: () => setRerouting(false) }
      ]);
    }
  };

  const getDistanceFromLatLonInKm = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  const centerOnUser = () => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const centerOnDestination = () => {
    if (destination && mapRef.current) {
      mapRef.current.animateToRegion({
        latitude: destination.latitude,
        longitude: destination.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      }, 500);
    }
  };

  const stopNavigation = () => {
    if (stepInterval.current) clearInterval(stepInterval.current);
    setNavigating(false);
    setRoute(null);
    router.back();
  };

  if (loading && !userLocation) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1D9E75" />
        <Text style={styles.loadingText}>Getting your location...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>Navigate to {destination?.name}</Text>
        {navigating && (
          <TouchableOpacity onPress={stopNavigation} style={styles.stopBtn}>
            <Text style={styles.stopBtnText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {navigating && distance && duration && (
        <View style={styles.navInfoPanel}>
          <View style={styles.navInfoRow}>
            <View style={styles.navInfoItem}>
              <Text style={styles.navInfoLabel}>Distance</Text>
              <Text style={styles.navInfoValue}>{distance} km</Text>
            </View>
            <View style={styles.navInfoDivider} />
            <View style={styles.navInfoItem}>
              <Text style={styles.navInfoLabel}>Est. Time</Text>
              <Text style={styles.navInfoValue}>{duration} min</Text>
            </View>
            <View style={styles.navInfoDivider} />
            <View style={styles.navInfoItem}>
              <Text style={styles.navInfoLabel}>Steps</Text>
              <Text style={styles.navInfoValue}>{steps.length}</Text>
            </View>
          </View>
          {currentStep < steps.length && steps[currentStep] && (
            <View style={styles.nextTurnContainer}>
              <Text style={styles.nextTurnLabel}>Next:</Text>
              <Text style={styles.nextTurnText} numberOfLines={2}>{steps[currentStep]?.instruction}</Text>
              <Text style={styles.nextTurnDist}>{steps[currentStep]?.distance} km</Text>
            </View>
          )}
          {arrived && <View style={styles.arrivedBadge}><Text style={styles.arrivedText}>✓ You have arrived!</Text></View>}
          {rerouting && <View style={styles.reroutingBadge}><ActivityIndicator size="small" color="#fff" /><Text style={styles.reroutingText}> Recalculating...</Text></View>}
        </View>
      )}

      {!navigating && userLocation && destination && !arrived && (
        <TouchableOpacity style={styles.startNavBtn} onPress={calculateRoute}>
          <Text style={styles.startNavBtnText}>🚗 Start Navigation</Text>
        </TouchableOpacity>
      )}

      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
        showsUserLocation={true}
        showsMyLocationButton={false}
        showsCompass={true}
        initialRegion={{
          latitude: userLocation?.latitude || -17.7825,
          longitude: userLocation?.longitude || 31.0525,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {destination && (
          <Marker coordinate={destination} title={destination.name} pinColor="#e74c3c">
            <View style={styles.destMarker}><Text style={styles.destMarkerText}>📍</Text><Text style={styles.destMarkerLabel}>Destination</Text></View>
          </Marker>
        )}
        {route && route.length > 0 && <Polyline coordinates={route} strokeColor="#3498db" strokeWidth={5} lineDashPattern={[0]} />}
      </MapView>

      <TouchableOpacity style={styles.centerUserBtn} onPress={centerOnUser}><Text style={styles.centerBtnText}>📍 Me</Text></TouchableOpacity>
      {destination && <TouchableOpacity style={styles.centerDestBtn} onPress={centerOnDestination}><Text style={styles.centerBtnText}>🎯 Dest</Text></TouchableOpacity>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#666' },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 50 : 20,
    left: 10,
    right: 10,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
  },
  backBtn: { paddingRight: 15 },
  backBtnText: { color: '#fff', fontSize: 16 },
  headerTitle: { color: '#fff', fontSize: 14, flex: 1, fontWeight: '500' },
  stopBtn: { backgroundColor: '#e74c3c', width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  stopBtnText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  map: { flex: 1 },
  destMarker: { alignItems: 'center', backgroundColor: '#e74c3c', borderRadius: 25, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 2, borderColor: '#fff' },
  destMarkerText: { fontSize: 16 },
  destMarkerLabel: { fontSize: 10, color: '#fff', fontWeight: 'bold' },
  navInfoPanel: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 110 : 80,
    left: 10,
    right: 10,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 15,
    padding: 12,
  },
  navInfoRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  navInfoItem: { alignItems: 'center', flex: 1 },
  navInfoDivider: { width: 1, backgroundColor: '#444' },
  navInfoLabel: { color: '#aaa', fontSize: 10 },
  navInfoValue: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  nextTurnContainer: { borderTopWidth: 1, borderTopColor: '#333', paddingTop: 10, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
  nextTurnLabel: { color: '#4ecdc4', fontSize: 11, marginRight: 8 },
  nextTurnText: { color: '#fff', fontSize: 12, flex: 1 },
  nextTurnDist: { color: '#aaa', fontSize: 10, marginLeft: 8 },
  arrivedBadge: { marginTop: 8, alignItems: 'center', padding: 8, backgroundColor: '#2ecc71', borderRadius: 8 },
  arrivedText: { color: '#fff', fontSize: 14, fontWeight: 'bold' },
  reroutingBadge: { marginTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 8, backgroundColor: '#e67e22', borderRadius: 8 },
  reroutingText: { color: '#fff', fontSize: 12 },
  startNavBtn: {
    position: 'absolute',
    bottom: 30,
    left: 20,
    right: 20,
    zIndex: 10,
    backgroundColor: '#1D9E75',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  startNavBtnText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  centerUserBtn: { position: 'absolute', bottom: 30, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', padding: 12, borderRadius: 30 },
  centerDestBtn: { position: 'absolute', bottom: 90, right: 20, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.7)', padding: 12, borderRadius: 30 },
  centerBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
});