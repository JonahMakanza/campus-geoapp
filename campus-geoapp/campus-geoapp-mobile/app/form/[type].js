import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, ScrollView, Alert, ActivityIndicator,
  Platform, KeyboardAvoidingView,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:3001';

const ASSET_CONFIG = {
  aged_tree: {
    label: 'Aged Tree',
    emoji: '🌳',
    color: '#2E7D32',
    requiresPhoto: false,
    fields: ['collector_name', 'gps', 'description', 'condition', 'reliability'],
  },
  building_condition: {
    label: 'Building Condition',
    emoji: '🏛',
    color: '#1565C0',
    requiresPhoto: true,
    fields: ['collector_name', 'gps', 'description', 'condition', 'photo', 'reliability'],
  },
  print_shop: {
    label: 'Print & Stationery Shop',
    emoji: '🖨',
    color: '#6A1B9A',
    requiresPhoto: false,
    fields: ['collector_name', 'gps', 'shop_name', 'description', 'reliability'],
  },
  food_outlet: {
    label: 'Food Outlet',
    emoji: '🍽',
    color: '#E65100',
    requiresPhoto: false,
    fields: ['collector_name', 'gps', 'outlet_name', 'description', 'reliability'],
  },
};

const CONDITIONS = ['Good', 'Fair', 'Poor', 'Critical'];

export default function FormScreen() {
  const { type } = useLocalSearchParams();
  const router = useRouter();
  const config = ASSET_CONFIG[type] || ASSET_CONFIG['aged_tree'];

  const [collector, setCollector] = useState('');
  const [coords, setCoords] = useState(null);
  const [description, setDescription] = useState('');
  const [shopName, setShopName] = useState('');
  const [condition, setCondition] = useState('Good');
  const [reliability, setReliability] = useState(3);
  const [photo, setPhoto] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const getGPS = useCallback(async () => {
    setGpsLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission required', 'Please allow location access in your device settings to record GPS coordinates.');
        setGpsLoading(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      setErrors(prev => ({ ...prev, gps: null }));
    } catch {
      Alert.alert('GPS Error', 'Could not get location. Please try again.');
    }
    setGpsLoading(false);
  }, []);

  const takePhoto = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Camera not available', 'Camera is not available in the browser. Please use the native app for photos, or pick from gallery.');
      return;
    }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Camera permission required', 'Please allow camera access in your device settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled) {
      setPhoto(result.assets[0]);
      setErrors(prev => ({ ...prev, photo: null }));
    }
  }, []);

  const pickPhoto = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled) {
      setPhoto(result.assets[0]);
      setErrors(prev => ({ ...prev, photo: null }));
    }
  }, []);

  const validate = useCallback(() => {
    const newErrors = {};
    if (!collector.trim()) newErrors.collector = 'Your name is required';
    if (!coords) newErrors.gps = 'GPS coordinates are required — tap "Get Location" above';
    if (config.requiresPhoto && !photo) newErrors.photo = 'A photo is required for building conditions';
    if ((type === 'print_shop' || type === 'food_outlet') && !shopName.trim()) {
      newErrors.shopName = `${type === 'print_shop' ? 'Shop' : 'Outlet'} name is required`;
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [collector, coords, config.requiresPhoto, photo, type, shopName]);

  const handleSubmit = useCallback(async () => {
    if (!validate()) {
      Alert.alert('Missing information', 'Please fill in all required fields before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('type', type);
      formData.append('latitude', coords.lat.toString());
      formData.append('longitude', coords.lng.toString());
      formData.append('description', description);
      formData.append('condition', condition);
      formData.append('collector_name', collector.trim());
      formData.append('reliability_score', reliability.toString());
      if (shopName) formData.append('shop_name', shopName.trim());

      if (photo) {
        if (Platform.OS === 'web') {
          const response = await fetch(photo.uri);
          const blob = await response.blob();
          formData.append('photo', blob, 'photo.jpg');
        } else {
          formData.append('photo', {
            uri: photo.uri,
            type: 'image/jpeg',
            name: 'photo.jpg',
          });
        }
      }

      await axios.post(`${API_URL}/assets`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 15000,
      });

      Alert.alert(
        'Submitted successfully!',
        `Your ${config.label} data has been recorded and synced to the dashboard.`,
        [
          { text: 'Collect another', onPress: () => {
            setCollector('');
            setCoords(null);
            setDescription('');
            setShopName('');
            setPhoto(null);
            setCondition('Good');
            setReliability(3);
            setErrors({});
          }},
          { text: 'Go home', onPress: () => router.push('/') },
          { text: 'View map', onPress: () => router.push('/map') },
        ]
      );
    } catch (err) {
      console.error('Submit error:', err);
      Alert.alert(
        'Submission failed',
        'Could not reach the server. Check that your device is on the same network as the server, or that the server URL is correct.',
        [{ text: 'Retry', onPress: handleSubmit }, { text: 'Cancel' }]
      );
    }
    setSubmitting(false);
  }, [validate, type, coords, description, condition, collector, reliability, shopName, photo, config.label, router]);

  const accentColor = config.color;
  const allRequiredFilled = collector.trim() && coords && (!config.requiresPhoto || photo);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={[styles.typeHeader, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
          <Text style={styles.typeEmoji}>{config.emoji}</Text>
          <Text style={[styles.typeLabel, { color: accentColor }]}>{config.label}</Text>
        </View>

        <FieldSection label="Your name *" error={errors.collector}>
          <TextInput
            style={[styles.input, errors.collector && styles.inputError]}
            placeholder="Enter your full name"
            value={collector}
            onChangeText={v => { setCollector(v); setErrors(p => ({ ...p, collector: null })); }}
            autoCapitalize="words"
            returnKeyType="next"
          />
        </FieldSection>

        {(type === 'print_shop' || type === 'food_outlet') && (
          <FieldSection
            label={`${type === 'print_shop' ? 'Shop' : 'Outlet'} name *`}
            error={errors.shopName}
          >
            <TextInput
              style={[styles.input, errors.shopName && styles.inputError]}
              placeholder={`Enter the ${type === 'print_shop' ? 'shop' : 'outlet'} name`}
              value={shopName}
              onChangeText={v => { setShopName(v); setErrors(p => ({ ...p, shopName: null })); }}
              autoCapitalize="words"
            />
          </FieldSection>
        )}

        <FieldSection label="GPS location *" error={errors.gps}>
          <TouchableOpacity
            style={[styles.gpsBtn, { backgroundColor: coords ? '#e8f5e9' : accentColor }]}
            onPress={getGPS}
            activeOpacity={0.8}
          >
            {gpsLoading
              ? <ActivityIndicator color={coords ? '#2E7D32' : '#fff'} />
              : <Text style={[styles.gpsBtnText, { color: coords ? '#2E7D32' : '#fff' }]}>
                  {coords
                    ? `Lat ${coords.lat.toFixed(6)}, Lng ${coords.lng.toFixed(6)}`
                    : 'Get current location'}
                </Text>
            }
          </TouchableOpacity>
          {coords && (
            <TouchableOpacity style={styles.reGps} onPress={getGPS}>
              <Text style={styles.reGpsText}>Re-capture location</Text>
            </TouchableOpacity>
          )}
        </FieldSection>

        <FieldSection label="Description">
          <TextInput
            style={[styles.input, styles.textarea]}
            placeholder="Describe what you observe at this location..."
            multiline
            numberOfLines={3}
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
          />
        </FieldSection>

        <FieldSection label="Condition">
          <View style={styles.chipRow}>
            {CONDITIONS.map(c => (
              <TouchableOpacity
                key={c}
                style={[styles.chip, condition === c && { backgroundColor: accentColor, borderColor: accentColor }]}
                onPress={() => setCondition(c)}
              >
                <Text style={[styles.chipText, condition === c && { color: '#fff' }]}>{c}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FieldSection>

        {config.requiresPhoto && (
          <FieldSection label="Building photo *" error={errors.photo}>
            <View style={styles.photoRow}>
              <TouchableOpacity style={[styles.photoBtn, { borderColor: accentColor }]} onPress={takePhoto}>
                <Text style={[styles.photoBtnText, { color: accentColor }]}>Take photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoBtn, { borderColor: accentColor }]} onPress={pickPhoto}>
                <Text style={[styles.photoBtnText, { color: accentColor }]}>Pick from gallery</Text>
              </TouchableOpacity>
            </View>
            {photo && (
              <View style={styles.previewWrap}>
                <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />
                <TouchableOpacity style={styles.removePhoto} onPress={() => setPhoto(null)}>
                  <Text style={styles.removePhotoText}>Remove</Text>
                </TouchableOpacity>
              </View>
            )}
          </FieldSection>
        )}

        <FieldSection label={`Reliability score: ${reliability}/5`}>
          <View style={styles.chipRow}>
            {[1, 2, 3, 4, 5].map(r => (
              <TouchableOpacity
                key={r}
                style={[styles.chip, reliability === r && { backgroundColor: '#E65100', borderColor: '#E65100' }]}
                onPress={() => setReliability(r)}
              >
                <Text style={[styles.chipText, reliability === r && { color: '#fff' }]}>{'★'.repeat(r)}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </FieldSection>

        {Object.values(errors).some(Boolean) && (
          <View style={styles.errorSummary}>
            <Text style={styles.errorSummaryTitle}>Please fix the following:</Text>
            {Object.values(errors).filter(Boolean).map((e, i) => (
              <Text key={i} style={styles.errorSummaryItem}>• {e}</Text>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.submitBtn,
            { backgroundColor: allRequiredFilled ? accentColor : '#bbb' },
          ]}
          onPress={handleSubmit}
          disabled={submitting}
          activeOpacity={0.85}
          accessibilityLabel="Submit and sync data"
          accessibilityRole="button"
        >
          {submitting
            ? <ActivityIndicator color="#fff" size="small" />
            : (
              <View style={styles.submitInner}>
                <Text style={styles.submitText}>Submit & sync to dashboard</Text>
                <Text style={styles.submitSubtext}>Data saves and appears live on the map</Text>
              </View>
            )
          }
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel — go back</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function FieldSection({ label, error, children }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error && <Text style={styles.fieldError}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 60 },
  typeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 20,
  },
  typeEmoji: { fontSize: 28, marginRight: 10 },
  typeLabel: { fontSize: 18, fontWeight: '700' },
  field: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#ddd',
    color: '#222',
  },
  inputError: { borderColor: '#e53935' },
  textarea: { height: 90, paddingTop: 12 },
  gpsBtn: {
    borderRadius: 10,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  gpsBtnText: { fontSize: 14, fontWeight: '600' },
  reGps: { alignSelf: 'flex-end', marginTop: 6 },
  reGpsText: { fontSize: 12, color: '#888', textDecorationLine: 'underline' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  chipText: { fontSize: 13, color: '#333', fontWeight: '500' },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoBtn: {
    flex: 1,
    borderRadius: 10,
    padding: 13,
    alignItems: 'center',
    borderWidth: 1.5,
    backgroundColor: '#fff',
  },
  photoBtnText: { fontSize: 13, fontWeight: '600' },
  previewWrap: { marginTop: 10 },
  preview: { width: '100%', height: 200, borderRadius: 10 },
  removePhoto: { alignSelf: 'flex-end', marginTop: 6 },
  removePhotoText: { fontSize: 12, color: '#e53935', textDecorationLine: 'underline' },
  errorSummary: {
    backgroundColor: '#fdecea',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#f5c6cb',
  },
  errorSummaryTitle: { fontWeight: '700', color: '#c62828', marginBottom: 6 },
  errorSummaryItem: { fontSize: 13, color: '#c62828', lineHeight: 20 },
  fieldError: { marginTop: 5, fontSize: 12, color: '#e53935' },
  submitBtn: {
    borderRadius: 12,
    padding: 18,
    alignItems: 'center',
    marginTop: 8,
    minHeight: 64,
    justifyContent: 'center',
  },
  submitInner: { alignItems: 'center' },
  submitText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  submitSubtext: { color: 'rgba(255,255,255,0.8)', fontSize: 12, marginTop: 3 },
  cancelBtn: { alignItems: 'center', padding: 16, marginTop: 4 },
  cancelText: { color: '#888', fontSize: 14 },
});
