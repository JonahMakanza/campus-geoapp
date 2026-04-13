import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import networkManager from '../utils/networkManager';

const FORMS = [
  { route:'/forms/food-outlets',       emoji:'🍽', label:'Food Outlets',        color:'#E65100', bg:'#fff3e0', count:14, desc:'14 outlets — DLT, Yellow Canteen, NC Tuckshops, Jojo\'s, Senior Common Room...' },
  { route:'/forms/building-conditions',emoji:'🏛', label:'Building Conditions', color:'#1565C0', bg:'#e3f2fd', count:15, desc:'15 buildings — Manfred, Carrsaunders, Beit, Geo, Botany, Zoology, Diamond...' },
  { route:'/forms/aging-trees',         emoji:'🌳', label:'Aged Trees',          color:'#2E7D32', bg:'#e8f5e9', count:21, desc:'21 tree points — Trees 2–12 with evidence points, GPS Points 1–2...' },
  { route:'/forms/printing-stations',  emoji:'🖨', label:'Printing Stations',  color:'#6A1B9A', bg:'#f3e5f5', count:13, desc:'13 stations — Urban Planning, Law, Engineering, SU, Reprographics...' },
];

export default function HomeScreen() {
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // Initialize network manager
    networkManager.initialize().then(() => {
      setOnline(networkManager.isConnected());
      networkManager.getQueueCount().then(setQueueCount);
    });

    // Listen for network events
    const handleEvent = (event, data) => {
      if (event === 'connection_change') setOnline(data);
      if (event === 'queued') setQueueCount(data);
      if (event === 'sync_started') setSyncing(true);
      if (event === 'sync_complete') {
        setSyncing(false);
        setQueueCount(data.remaining);
        if (data.success > 0) {
          Alert.alert('Sync Complete', `${data.success} record(s) synced to server.`);
        }
      }
    };
    
    networkManager.addListener(handleEvent);
    
    return () => networkManager.removeListener(handleEvent);
  }, []);

  const syncNow = async () => {
    if (!online) {
      Alert.alert('Offline', 'No internet connection. Will sync when online.');
      return;
    }
    if (syncing) {
      Alert.alert('Sync in Progress', 'Please wait for current sync to complete.');
      return;
    }
    setSyncing(true);
    await networkManager.syncOfflineData();
    const count = await networkManager.getQueueCount();
    setQueueCount(count);
    setSyncing(false);
  };

  return (
    <ScrollView style={S.wrap} contentContainerStyle={S.content}>

      <View style={S.campus}>
        <Text style={S.campusTxt}>University of Zimbabwe — GIS Asset Survey</Text>
        <Text style={S.campusSub}>HGISEO407 · Data feeds into PostgreSQL/PostGIS geodatabase</Text>
      </View>

      <View style={[S.status, { backgroundColor: online ? '#e8f5e9' : '#fff8e1' }]}>
        <View style={[S.dot, { backgroundColor: online ? '#2E7D32' : '#F57F17' }]} />
        <Text style={[S.statusTxt, { color: online ? '#2E7D32' : '#F57F17', flex: 1 }]}>
          {online ? '✅ Online — data syncs live to PostGIS + dashboard' : '⚠️ Offline — data saves to phone, syncs when reconnected'}
        </Text>
      </View>

      {queueCount > 0 && (
        <TouchableOpacity style={S.syncBanner} onPress={syncNow} disabled={syncing}>
          <Text style={S.syncBannerTxt}>
            {syncing ? '🔄 Syncing to PostGIS database...' : `📤 ${queueCount} offline record${queueCount > 1 ? 's' : ''} — tap to sync now`}
          </Text>
        </TouchableOpacity>
      )}

      <Text style={S.intro}>Select an asset category to open the survey form.</Text>

      {FORMS.map((f, i) => (
        <TouchableOpacity key={i} style={[S.card, { backgroundColor: f.bg, borderLeftColor: f.color }]}
          activeOpacity={0.75} onPress={() => router.push(f.route)}>
          <View style={S.cardRow}>
            <Text style={S.cardEmoji}>{f.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[S.cardTitle, { color: f.color }]}>{f.label}</Text>
              <Text style={S.cardDesc}>{f.desc}</Text>
            </View>
            <View style={[S.badge, { backgroundColor: f.color }]}>
              <Text style={S.badgeNum}>{f.count}</Text>
              <Text style={S.badgeSub}>pts</Text>
            </View>
          </View>
        </TouchableOpacity>
      ))}

      <TouchableOpacity style={S.mapBtn} onPress={() => router.push('/map')}>
        <Text style={S.mapBtnTxt}>🗺️ View Campus Map</Text>
      </TouchableOpacity>

      {Platform.OS === 'web' && (
        <Text style={S.webNote}>
          Running in browser. For GPS and camera, open Expo Go on your phone and scan the QR code from the terminal.
        </Text>
      )}
    </ScrollView>
  );
}

const S = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#f5f5f5' },
  content: { padding: 16, paddingBottom: 40 },
  campus: { backgroundColor: '#1D9E75', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 12 },
  campusTxt: { color: '#fff', fontWeight: '700', fontSize: 14 },
  campusSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 3 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 10, borderRadius: 10, marginBottom: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusTxt: { fontSize: 12, fontWeight: '600' },
  syncBanner: { backgroundColor: '#fff3e0', borderRadius: 10, padding: 12, marginBottom: 12, alignItems: 'center', borderWidth: 1, borderColor: '#ffe0b2' },
  syncBannerTxt: { color: '#E65100', fontWeight: '700', fontSize: 13 },
  intro: { fontSize: 13, color: '#666', marginBottom: 14, textAlign: 'center' },
  card: { borderRadius: 12, padding: 14, marginBottom: 12, borderLeftWidth: 5 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardEmoji: { fontSize: 28 },
  cardTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardDesc: { fontSize: 11, color: '#666', lineHeight: 16 },
  badge: { borderRadius: 10, padding: 8, alignItems: 'center', minWidth: 46 },
  badgeNum: { color: '#fff', fontWeight: '700', fontSize: 18 },
  badgeSub: { color: 'rgba(255,255,255,0.8)', fontSize: 9 },
  mapBtn: { backgroundColor: '#1D9E75', borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 6 },
  mapBtnTxt: { color: '#fff', fontSize: 16, fontWeight: '700' },
  webNote: { marginTop: 16, fontSize: 12, color: '#888', textAlign: 'center', lineHeight: 18, padding: 12, backgroundColor: '#fff8e1', borderRadius: 8 },
});