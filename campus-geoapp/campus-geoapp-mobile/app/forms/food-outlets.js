/**
 * FORM 1 — Food Outlet Survey
 * University of Zimbabwe Campus
 * 14 outlets pre-loaded from KML data
 * UPDATED: Uses centralized networkManager for offline queue
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useRouter } from 'expo-router';
import networkManager from '../utils/networkManager';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.1.100:3001';
const COLOR = '#E65100';
const BG = '#fff3e0';

// ── 14 UZ food outlets from KML ──────────────────────────────
const OUTLETS = [
  { name: 'DLT',                         lat: -17.7823365, lng: 31.0525868 },
  { name: 'Yellow Canteen (Main)',         lat: -17.7838036, lng: 31.0503493 },
  { name: 'Yellow Canteen SC',            lat: -17.7838158, lng: 31.0503485 },
  { name: 'NC1 Tuckshop',                 lat: -17.7828772, lng: 31.0580194 },
  { name: 'NC2 Tuckshop',                 lat: -17.7841441, lng: 31.0581862 },
  { name: 'NC3 Tuckshop',                 lat: -17.7839902, lng: 31.0590492 },
  { name: 'NC4 Tuckshop',                 lat: -17.7829605, lng: 31.0590651 },
  { name: 'Manfred Tuckshop',             lat: -17.7806019, lng: 31.0574122 },
  { name: "Student's Terminus Tuckshop",  lat: -17.7802928, lng: 31.0558639 },
  { name: 'NGA Investments',              lat: -17.7799266, lng: 31.0565240 },
  { name: 'Grocery Shops',               lat: -17.7798210, lng: 31.0560057 },
  { name: 'SU Tuckshop and Dining',      lat: -17.7826921, lng: 31.0547920 },
  { name: "Jojo's",                      lat: -17.7827269, lng: 31.0548054 },
  { name: 'Senior Common Room',          lat: -17.7832680, lng: 31.0541704 },
];

const FOOD_TYPES   = ['Tuckshop','Canteen','Dining Hall','Cafeteria','Grocery','Fast Food','Restaurant','Other'];
const CONDITIONS   = ['Excellent','Good','Fair','Poor','Closed/Defunct'];
const ACCESS_OPTS  = ['Very accessible','Accessible','Moderately accessible','Difficult to access'];
const CROWD_OPTS   = ['Always busy','Usually busy','Moderate','Usually quiet','Rarely visited'];
const PRICE_OPTS   = ['Very affordable','Affordable','Moderate','Expensive'];

export default function FoodOutletForm() {
  const router = useRouter();
  const [online, setOnline]               = useState(true);
  const [queueCount, setQueueCount]       = useState(0);
  const [syncing, setSyncing]             = useState(false);
  const [submitting, setSubmitting]       = useState(false);
  const [gpsLoading, setGpsLoading]       = useState(false);

  const [selected, setSelected]           = useState(null);
  const [liveCoords, setLiveCoords]       = useState(null);

  const [collector, setCollector]         = useState('');
  const [outletName, setOutletName]       = useState('');
  const [foodType, setFoodType]           = useState('Tuckshop');
  const [hours, setHours]                 = useState('');
  const [daysOpen, setDaysOpen]           = useState('');
  const [condition, setCondition]         = useState('Good');
  const [access, setAccess]               = useState('Accessible');
  const [crowd, setCrowd]                 = useState('Moderate');
  const [price, setPrice]                 = useState('Affordable');
  const [reliability, setReliability]     = useState(3);
  const [seating, setSeating]             = useState('No');
  const [water, setWater]                 = useState('No');
  const [notes, setNotes]                 = useState('');

  useEffect(() => {
    // Subscribe to network manager events
    networkManager.addListener((event, data) => {
      if (event === 'connection_change') setOnline(data);
      if (event === 'queued') setQueueCount(data);
      if (event === 'sync_started') setSyncing(true);
      if (event === 'sync_complete') {
        setSyncing(false);
        setQueueCount(data.failed);
      }
    });
    
    // Initial state
    setOnline(networkManager.isConnected());
    networkManager.getQueueCount().then(setQueueCount);
    
    return () => {
      // Cleanup would be better but keep for now
    };
  }, []);

  const getGPS = async () => {
    setGpsLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { 
      Alert.alert('Permission needed','Allow location access.'); 
      setGpsLoading(false); 
      return; 
    }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setLiveCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy });
    setSelected(null);
    setGpsLoading(false);
  };

  const pickOutlet = (o) => { 
    setSelected(o); 
    setOutletName(o.name); 
    setLiveCoords(null); 
  };

  const coords = liveCoords ? { lat: liveCoords.lat, lng: liveCoords.lng }
               : selected   ? { lat: selected.lat,   lng: selected.lng  }
               : null;

  const validate = () => {
    if (!collector.trim()) { Alert.alert('Required','Enter your full name.'); return false; }
    if (!outletName.trim()) { Alert.alert('Required','Select or enter outlet name.'); return false; }
    if (!coords) { Alert.alert('Required','Select an outlet or capture GPS.'); return false; }
    return true;
  };

  const buildPayload = () => ({
    type: 'food_outlet',
    latitude:  coords.lat.toString(),
    longitude: coords.lng.toString(),
    collector_name: collector.trim(),
    outlet_name:    outletName.trim(),
    food_type:      foodType,
    operating_hours: hours,
    days_open:      daysOpen,
    condition,
    accessibility:  access,
    crowd_level:    crowd,
    price_range:    price,
    reliability_score: reliability.toString(),
    seating_available: seating,
    water_available:   water,
    description:    notes,
    submitted_at:   new Date().toISOString(),
  });

  const reset = () => {
    setSelected(null); setLiveCoords(null); setCollector(''); setOutletName('');
    setFoodType('Tuckshop'); setHours(''); setDaysOpen(''); setCondition('Good');
    setAccess('Accessible'); setCrowd('Moderate'); setPrice('Affordable');
    setReliability(3); setSeating('No'); setWater('No'); setNotes('');
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const payload = buildPayload();

    const result = await networkManager.submitData('/assets', payload);
    
    if (result.success) {
      if (result.online) {
        Alert.alert('Submitted!', `${outletName} saved to PostGIS geodatabase.`, [
          { text: 'Another outlet', onPress: reset },
          { text: 'View map', onPress: () => router.push('/map') },
          { text: 'Home', onPress: () => router.push('/') },
        ]);
      } else {
        Alert.alert('Saved Offline', `Data saved locally. ${result.queueLength} item(s) in queue. Will sync when online.`, [
          { text: 'Another outlet', onPress: reset },
          { text: 'Go home', onPress: () => router.push('/') },
        ]);
      }
    } else {
      Alert.alert('Error', 'Failed to save data. Please try again.');
    }
    
    setSubmitting(false);
  };

  const syncNow = async () => {
    setSyncing(true);
    await networkManager.syncOfflineData();
    const count = await networkManager.getQueueCount();
    setQueueCount(count);
    setSyncing(false);
    Alert.alert('Sync Complete', `${count} items still pending.`);
  };

  return (
    <KeyboardAvoidingView style={{ flex:1 }} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView style={S.wrap} contentContainerStyle={S.content} keyboardShouldPersistTaps="handled">

        <View style={[S.header,{backgroundColor:BG,borderColor:COLOR+'40'}]}>
          <Text style={S.hEmoji}>🍽</Text>
          <View style={{flex:1}}>
            <Text style={[S.hTitle,{color:COLOR}]}>Food Outlet Survey</Text>
            <Text style={S.hSub}>University of Zimbabwe Campus · 14 outlets</Text>
          </View>
        </View>

        <View style={[S.status,{backgroundColor:online?'#e8f5e9':'#fff8e1'}]}>
          <View style={[S.dot,{backgroundColor:online?'#2E7D32':'#F57F17'}]}/>
          <Text style={[S.statusTxt,{color:online?'#2E7D32':'#F57F17',flex:1}]}>
            {online ? '✅ Online — Live sync' : '⚠️ Offline — Saving locally'}
          </Text>
          {queueCount > 0 && (
            <TouchableOpacity style={S.syncBtn} onPress={syncNow} disabled={syncing || !online}>
              {syncing ? <ActivityIndicator size="small" color={COLOR}/>
                      : <Text style={S.syncTxt}>📤 Sync ({queueCount})</Text>}
            </TouchableOpacity>
          )}
        </View>

        {/* Rest of your existing JSX remains the same */}
        {/* ... keep all your existing form fields ... */}
        
        <Sec title="1. Data collector">
          <Fld label="Full name *">
            <TextInput style={S.input} placeholder="e.g. Tinashe Moyo"
              value={collector} onChangeText={setCollector} autoCapitalize="words"/>
          </Fld>
        </Sec>

        <Sec title="2. Select food outlet">
          <Text style={S.note}>Tap a known UZ outlet (coordinates auto-filled from KML):</Text>
          <View style={S.grid}>
            {OUTLETS.map((o,i) => (
              <TouchableOpacity key={i}
                style={[S.pill, selected?.name===o.name && {backgroundColor:COLOR,borderColor:COLOR}]}
                onPress={() => pickOutlet(o)}>
                <Text style={[S.pillTxt, selected?.name===o.name && {color:'#fff'}]}>{o.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Fld label="Or enter new outlet name">
            <TextInput style={S.input} placeholder="Outlet not in list above..."
              value={outletName}
              onChangeText={v => { setOutletName(v); setSelected(null); }}/>
          </Fld>

          {!selected && (
            <Fld label="GPS for new outlet *">
              <TouchableOpacity style={[S.gpsBtn,{backgroundColor:liveCoords?'#e8f5e9':COLOR}]} onPress={getGPS}>
                {gpsLoading ? <ActivityIndicator color={liveCoords?'#2E7D32':'#fff'}/>
                  : <Text style={[S.gpsTxt,{color:liveCoords?'#2E7D32':'#fff'}]}>
                      {liveCoords
                        ? `${liveCoords.lat.toFixed(6)}, ${liveCoords.lng.toFixed(6)}`
                        : 'Tap to capture GPS location'}
                    </Text>}
              </TouchableOpacity>
            </Fld>
          )}

          {coords && (
            <View style={S.coordBox}>
              <Text style={S.coordLabel}>{selected?`KML coordinates: ${selected.name}`:'Live GPS captured'}</Text>
              <Text style={S.coordVal}>Lat {coords.lat.toFixed(6)}  Lng {coords.lng.toFixed(6)}</Text>
              <Text style={S.coordSub}>→ Stored as PostGIS Point (EPSG:4326)</Text>
            </View>
          )}
        </Sec>

        <Sec title="3. Outlet details">
          <Fld label="Type of outlet">
            <Chips opts={FOOD_TYPES} val={foodType} set={setFoodType} color={COLOR}/>
          </Fld>
          <Fld label="Operating hours">
            <TextInput style={S.input} placeholder="e.g. 07:00 – 17:00" value={hours} onChangeText={setHours}/>
          </Fld>
          <Fld label="Days open">
            <TextInput style={S.input} placeholder="e.g. Mon – Fri" value={daysOpen} onChangeText={setDaysOpen}/>
          </Fld>
          <Fld label="Seating available?">
            <Toggle val={seating} set={setSeating} color={COLOR}/>
          </Fld>
          <Fld label="Running water / handwashing?">
            <Toggle val={water} set={setWater} color={COLOR}/>
          </Fld>
        </Sec>

        <Sec title="4. Condition & accessibility assessment">
          <Fld label="Physical condition">
            <Chips opts={CONDITIONS} val={condition} set={setCondition} color={COLOR}/>
          </Fld>
          <Fld label="Accessibility to students">
            <Chips opts={ACCESS_OPTS} val={access} set={setAccess} color="#1565C0"/>
          </Fld>
          <Fld label="Typical crowd / demand">
            <Chips opts={CROWD_OPTS} val={crowd} set={setCrowd} color="#6A1B9A"/>
          </Fld>
          <Fld label="Price range for students">
            <Chips opts={PRICE_OPTS} val={price} set={setPrice} color="#2E7D32"/>
          </Fld>
          <Fld label={`Reliability score: ${reliability}/5`}>
            <Stars val={reliability} set={setReliability} color={COLOR}/>
          </Fld>
        </Sec>

        <Sec title="5. Field observations">
          <Fld label="Notes (cleanliness, queues, student feedback...)">
            <TextInput style={[S.input,{height:90}]} multiline textAlignVertical="top"
              placeholder="Describe what you observed at this location..."
              value={notes} onChangeText={setNotes}/>
          </Fld>
        </Sec>

        <TouchableOpacity style={[S.submitBtn,{backgroundColor:COLOR}]} onPress={submit} disabled={submitting}>
          {submitting ? <ActivityIndicator color="#fff"/> : (
            <View style={{alignItems:'center'}}>
              <Text style={S.submitTxt}>{online ? 'Submit & Sync' : 'Save Offline'}</Text>
              <Text style={S.submitSub}>{online ? 'Saved to PostGIS' : `Queued (${queueCount} pending)`}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={S.cancelBtn} onPress={() => router.back()}>
          <Text style={S.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Helper components (keep same as before)
function Sec({ title, children }) {
  return (
    <View style={S.sec}>
      <Text style={S.secTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Fld({ label, children }) {
  return <View style={S.fld}><Text style={S.fldLabel}>{label}</Text>{children}</View>;
}
function Chips({ opts, val, set, color }) {
  return (
    <View style={S.chips}>
      {opts.map(o => (
        <TouchableOpacity key={o}
          style={[S.chip, val===o && {backgroundColor:color,borderColor:color}]}
          onPress={() => set(o)}>
          <Text style={[S.chipTxt, val===o && {color:'#fff'}]}>{o}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
function Toggle({ val, set, color }) {
  return (
    <View style={S.row}>
      {['Yes','No'].map(v => (
        <TouchableOpacity key={v}
          style={[S.toggleBtn, val===v && {backgroundColor:color,borderColor:color}]}
          onPress={() => set(v)}>
          <Text style={[S.toggleTxt, val===v && {color:'#fff'}]}>{v}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
function Stars({ val, set, color }) {
  return (
    <View style={S.row}>
      {[1,2,3,4,5].map(r => (
        <TouchableOpacity key={r}
          style={[S.starBtn, val===r && {backgroundColor:color,borderColor:color}]}
          onPress={() => set(r)}>
          <Text style={[S.chipTxt, val===r && {color:'#fff'}]}>{'★'.repeat(r)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  wrap:{flex:1,backgroundColor:'#f5f5f5'},
  content:{padding:16,paddingBottom:60},
  header:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:12,borderWidth:1,marginBottom:12},
  hEmoji:{fontSize:30},
  hTitle:{fontSize:18,fontWeight:'700'},
  hSub:{fontSize:12,color:'#666',marginTop:2},
  status:{flexDirection:'row',alignItems:'center',gap:8,padding:10,borderRadius:10,marginBottom:16},
  dot:{width:8,height:8,borderRadius:4},
  statusTxt:{fontSize:12,fontWeight:'600'},
  syncBtn:{backgroundColor:'#e3f2fd',borderRadius:8,paddingHorizontal:10,paddingVertical:5},
  syncTxt:{fontSize:11,color:'#1565C0',fontWeight:'700'},
  sec:{backgroundColor:'#fff',borderRadius:12,padding:16,marginBottom:14,borderWidth:0.5,borderColor:'#e0e0e0'},
  secTitle:{fontSize:14,fontWeight:'700',color:'#333',marginBottom:12,paddingBottom:8,borderBottomWidth:0.5,borderBottomColor:'#eee'},
  note:{fontSize:12,color:'#888',marginBottom:8},
  fld:{marginBottom:14},
  fldLabel:{fontSize:12,fontWeight:'600',color:'#555',marginBottom:7},
  input:{backgroundColor:'#f8f8f8',borderRadius:8,padding:12,fontSize:14,borderWidth:1,borderColor:'#e0e0e0'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:7,marginBottom:12},
  pill:{paddingHorizontal:11,paddingVertical:7,borderRadius:20,borderWidth:1,borderColor:'#ddd',backgroundColor:'#f5f5f5'},
  pillTxt:{fontSize:11,color:'#333',fontWeight:'500'},
  gpsBtn:{borderRadius:10,padding:13,alignItems:'center',minHeight:46,justifyContent:'center'},
  gpsTxt:{fontSize:12,fontWeight:'600',textAlign:'center'},
  coordBox:{backgroundColor:'#e8f5e9',borderRadius:8,padding:10,marginTop:6},
  coordLabel:{fontSize:11,color:'#2E7D32',fontWeight:'600'},
  coordVal:{fontSize:11,color:'#2E7D32',fontFamily:Platform.OS==='ios'?'Courier':'monospace',marginTop:2},
  coordSub:{fontSize:10,color:'#4CAF50',marginTop:2},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{paddingHorizontal:11,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:'#ddd',backgroundColor:'#f5f5f5'},
  chipTxt:{fontSize:12,color:'#333',fontWeight:'500'},
  row:{flexDirection:'row',gap:8},
  toggleBtn:{flex:1,paddingVertical:10,borderRadius:8,borderWidth:1,borderColor:'#ddd',alignItems:'center',backgroundColor:'#f5f5f5'},
  toggleTxt:{fontSize:13,fontWeight:'600',color:'#333'},
  starBtn:{flex:1,paddingVertical:9,borderRadius:8,borderWidth:1,borderColor:'#ddd',alignItems:'center',backgroundColor:'#f5f5f5'},
  submitBtn:{borderRadius:14,padding:18,alignItems:'center',marginTop:8,minHeight:64,justifyContent:'center'},
  submitTxt:{color:'#fff',fontSize:17,fontWeight:'700'},
  submitSub:{color:'rgba(255,255,255,0.8)',fontSize:11,marginTop:3},
  cancelBtn:{alignItems:'center',padding:16},
  cancelTxt:{color:'#888',fontSize:14},
});