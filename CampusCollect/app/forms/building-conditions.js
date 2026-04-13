/**
 * FORM 2 — Building Condition Survey
 * University of Zimbabwe Campus
 * 15 buildings pre-loaded from KML data
 * UPDATED: Uses centralized networkManager for offline queue
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image,
  StyleSheet, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import networkManager from '../utils/networkManager';

const COLOR = '#1565C0';
const BG = '#e3f2fd';

// ── 15 UZ buildings from KML ──────────────────────────────────
const BUILDINGS = [
  { name:'Manfred 1',       block:'Manfred',      lat:-17.781973135357877, lng:31.057258293775718 },
  { name:'Carrsaunders 1',  block:'Carrsaunders', lat:-17.782739828039563, lng:31.056225404093713 },
  { name:'Carrsaunders 2',  block:'Carrsaunders', lat:-17.782898952957915, lng:31.056369464170430 },
  { name:'Carrsaunders 3',  block:'Carrsaunders', lat:-17.784161087446330, lng:31.056170990745280 },
  { name:'Beit 1',          block:'Beit',         lat:-17.782758192561207, lng:31.054013394517604 },
  { name:'Beit 2',          block:'Beit',         lat:-17.782694625437387, lng:31.054010817432463 },
  { name:'Beit 3',          block:'Beit',         lat:-17.782675147529480, lng:31.054102850002895 },
  { name:'Beit 4',          block:'Beit',         lat:-17.782361857187020, lng:31.053903868497620 },
  { name:'Beit 5',          block:'Beit',         lat:-17.782393386021415, lng:31.053818626526464 },
  { name:'Geo 1',           block:'Geography',    lat:-17.782730334882770, lng:31.053622184281966 },
  { name:'Geo 2',           block:'Geography',    lat:-17.782693229778886, lng:31.053363415542158 },
  { name:'Geo 3',           block:'Geography',    lat:-17.782570479901313, lng:31.052941867957866 },
  { name:'Botany 1',        block:'Botany',       lat:-17.782884145883630, lng:31.052557207207645 },
  { name:'Zoology 1',       block:'Zoology',      lat:-17.782647416743654, lng:31.052550501102104 },
  { name:'Diamond',         block:'Diamond',      lat:-17.782642854282297, lng:31.052825871518840 },
];
const BLOCKS       = [...new Set(BUILDINGS.map(b=>b.block))];
const STRUCT_COND  = ['Excellent — no damage','Good — minor wear','Fair — moderate deterioration','Poor — significant damage','Critical — unsafe'];
const ROOF_COND    = ['Good','Minor leaks','Major leaks','Collapsed sections','N/A'];
const WALL_COND    = ['Good','Minor cracks','Major cracks','Spalling/crumbling','Severe damage'];
const WIN_COND     = ['All intact','Some broken','Mostly broken','None/removed'];
const ACCESS_OPTS  = ['Fully accessible','Accessible','Partially accessible','Not accessible'];
const USAGE_OPTS   = ['Fully in use','Partially in use','Temporarily closed','Abandoned','Under renovation'];

export default function BuildingConditionForm() {
  const router = useRouter();
  const [online, setOnline]         = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [photos, setPhotos]         = useState([]);

  const [blockFilter, setBlockFilter]   = useState(null);
  const [selected, setSelected]         = useState(null);
  const [liveCoords, setLiveCoords]     = useState(null);

  const [collector, setCollector]       = useState('');
  const [bldgName, setBldgName]         = useState('');
  const [bldgUse, setBldgUse]           = useState('');
  const [floors, setFloors]             = useState('');
  const [yearBuilt, setYearBuilt]       = useState('');
  const [usage, setUsage]               = useState('Fully in use');
  const [structCond, setStructCond]     = useState('Good — minor wear');
  const [roofCond, setRoofCond]         = useState('Good');
  const [wallCond, setWallCond]         = useState('Good');
  const [winCond, setWinCond]           = useState('All intact');
  const [access, setAccess]             = useState('Accessible');
  const [electricity, setElectricity]   = useState('Yes');
  const [waterSvc, setWaterSvc]         = useState('Yes');
  const [disabled, setDisabled]         = useState('No');
  const [reliability, setReliability]   = useState(3);
  const [notes, setNotes]               = useState('');

  useEffect(() => {
    const handleNetworkEvent = (event, data) => {
      if (event === 'connection_change') setOnline(data);
      if (event === 'queued') setQueueCount(data);
      if (event === 'sync_started') setSyncing(true);
      if (event === 'sync_complete') {
        setSyncing(false);
        setQueueCount(data.failed);
      }
    };
    
    networkManager.addListener(handleNetworkEvent);
    setOnline(networkManager.isConnected());
    networkManager.getQueueCount().then(setQueueCount);
    
    return () => networkManager.removeListener(handleNetworkEvent);
  }, []);

  const filtered = blockFilter ? BUILDINGS.filter(b=>b.block===blockFilter) : BUILDINGS;

  const pickBuilding = (b) => { setSelected(b); setBldgName(b.name); setLiveCoords(null); };

  const getGPS = async () => {
    setGpsLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed','Allow location access.'); setGpsLoading(false); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setLiveCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy });
    setSelected(null);
    setGpsLoading(false);
  };

  const takePhoto = async () => {
    if (Platform.OS==='web') { Alert.alert('Use Expo Go','Camera only works in Expo Go app.'); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status!=='granted') { Alert.alert('Permission needed','Camera access required.'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality:0.75, allowsEditing:false });
    if (!r.canceled) setPhotos(p => [...p, r.assets[0]]);
  };

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ quality:0.75, allowsMultipleSelection:true });
    if (!r.canceled) setPhotos(p => [...p, ...r.assets]);
  };

  const coords = liveCoords ? { lat:liveCoords.lat, lng:liveCoords.lng }
               : selected   ? { lat:selected.lat,   lng:selected.lng  }
               : null;

  const validate = () => {
    if (!collector.trim()) { Alert.alert('Required','Enter your name.'); return false; }
    if (!bldgName.trim())  { Alert.alert('Required','Select or enter building name.'); return false; }
    if (!coords)            { Alert.alert('Required','Select a building or capture GPS.'); return false; }
    return true;
  };

  const buildPayload = () => ({
    type:'building_condition',
    latitude:  coords.lat.toString(),
    longitude: coords.lng.toString(),
    collector_name:  collector.trim(),
    building_name:   bldgName.trim(),
    building_block:  selected?.block || blockFilter || '',
    building_use:    bldgUse,
    floor_count:     floors,
    year_built:      yearBuilt,
    usage_status:    usage,
    condition:       structCond,
    roof_condition:  roofCond,
    wall_condition:  wallCond,
    window_condition:winCond,
    accessibility:   access,
    electricity_available: electricity,
    water_available: waterSvc,
    disabled_access: disabled,
    reliability_score: reliability.toString(),
    description: notes,
    submitted_at: new Date().toISOString(),
  });

  const reset = () => {
    setSelected(null); setLiveCoords(null); setBlockFilter(null);
    setCollector(''); setBldgName(''); setBldgUse(''); setFloors(''); setYearBuilt('');
    setUsage('Fully in use'); setStructCond('Good — minor wear'); setRoofCond('Good');
    setWallCond('Good'); setWinCond('All intact'); setAccess('Accessible');
    setElectricity('Yes'); setWaterSvc('Yes'); setDisabled('No');
    setReliability(3); setNotes(''); setPhotos([]);
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const payload = buildPayload();
    const photoUri = photos.length > 0 ? photos[0].uri : null;
    
    if (photoUri) payload.photo_uri = photoUri;

    const result = await networkManager.submitData('/assets', payload);
    
    if (result.success) {
      if (result.online) {
        Alert.alert('Submitted!', `${bldgName} saved to PostGIS geodatabase.`, [
          { text: 'Another building', onPress: reset },
          { text: 'View map', onPress: () => router.push('/map') },
          { text: 'Home', onPress: () => router.push('/') },
        ]);
      } else {
        Alert.alert('Saved Offline', `Data saved locally. ${result.queueLength} item(s) in queue.`, [
          { text: 'Another building', onPress: reset },
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
    setQueueCount(await networkManager.getQueueCount());
    setSyncing(false);
  };

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={[styles.header,{backgroundColor:BG,borderColor:COLOR+'40'}]}>
          <Text style={styles.hEmoji}>🏛</Text>
          <View style={{flex:1}}>
            <Text style={[styles.hTitle,{color:COLOR}]}>Building Condition Survey</Text>
            <Text style={styles.hSub}>University of Zimbabwe Campus · 15 buildings</Text>
          </View>
        </View>

        <View style={[styles.status,{backgroundColor:online?'#e8f5e9':'#fff8e1'}]}>
          <View style={[styles.dot,{backgroundColor:online?'#2E7D32':'#F57F17'}]}/>
          <Text style={[styles.statusTxt,{color:online?'#2E7D32':'#F57F17',flex:1}]}>
            {online?'✅ Online — Live sync':'⚠️ Offline — Saving locally'}
          </Text>
          {queueCount>0&&(
            <TouchableOpacity style={styles.syncBtn} onPress={syncNow} disabled={syncing||!online}>
              {syncing?<ActivityIndicator size="small" color={COLOR}/>
                      :<Text style={styles.syncTxt}>📤 Sync ({queueCount})</Text>}
            </TouchableOpacity>
          )}
        </View>

        <Section title="1. Data collector">
          <Field label="Full name *">
            <TextInput style={styles.input} placeholder="e.g. Rumbidzai Chikwanda"
              value={collector} onChangeText={setCollector} autoCapitalize="words"/>
          </Field>
        </Section>

        <Section title="2. Select building">
          <Text style={styles.note}>Filter by block:</Text>
          <View style={styles.chips}>
            {BLOCKS.map(b=>(
              <TouchableOpacity key={b}
                style={[styles.chip,blockFilter===b&&{backgroundColor:COLOR,borderColor:COLOR}]}
                onPress={()=>setBlockFilter(blockFilter===b?null:b)}>
                <Text style={[styles.chipTxt,blockFilter===b&&{color:'#fff'}]}>{b}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <View style={[styles.grid,{marginTop:10}]}>
            {filtered.map((b,i)=>(
              <TouchableOpacity key={i}
                style={[styles.bldgPill,selected?.name===b.name&&{backgroundColor:COLOR,borderColor:COLOR}]}
                onPress={()=>pickBuilding(b)}>
                <Text style={[styles.pillTxt,selected?.name===b.name&&{color:'#fff'}]}>{b.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Or enter new building name">
            <TextInput style={styles.input} placeholder="Building not in list..."
              value={bldgName}
              onChangeText={v=>{setBldgName(v);setSelected(null);}}/>
          </Field>

          {!selected&&(
            <Field label="GPS coordinates *">
              <TouchableOpacity style={[styles.gpsBtn,{backgroundColor:liveCoords?'#e8f5e9':COLOR}]} onPress={getGPS}>
                {gpsLoading?<ActivityIndicator color={liveCoords?'#2E7D32':'#fff'}/>
                  :<Text style={[styles.gpsTxt,{color:liveCoords?'#2E7D32':'#fff'}]}>
                    {liveCoords?`${liveCoords.lat.toFixed(6)}, ${liveCoords.lng.toFixed(6)}`:'Tap to capture GPS location'}
                  </Text>}
              </TouchableOpacity>
            </Field>
          )}

          {coords&&(
            <View style={styles.coordBox}>
              <Text style={styles.coordLabel}>{selected?`KML: ${selected.name}`:'Live GPS'}</Text>
              <Text style={styles.coordVal}>Lat {coords.lat.toFixed(6)}  Lng {coords.lng.toFixed(6)}</Text>
              <Text style={styles.coordSub}>→ PostGIS Point (EPSG:4326)</Text>
            </View>
          )}
        </Section>

        <Section title="3. Building information">
          <Field label="Primary use / department">
            <TextInput style={styles.input} placeholder="e.g. Lecture halls, Faculty offices, Labs..."
              value={bldgUse} onChangeText={setBldgUse}/>
          </Field>
          <View style={styles.twoCol}>
            <View style={{flex:1}}>
              <Field label="No. of floors">
                <TextInput style={styles.input} placeholder="e.g. 3" keyboardType="numeric"
                  value={floors} onChangeText={setFloors}/>
              </Field>
            </View>
            <View style={{width:10}}/>
            <View style={{flex:1}}>
              <Field label="Year built">
                <TextInput style={styles.input} placeholder="e.g. 1975" keyboardType="numeric"
                  value={yearBuilt} onChangeText={setYearBuilt}/>
              </Field>
            </View>
          </View>
          <Field label="Current usage status">
            <Chips options={USAGE_OPTS} value={usage} setValue={setUsage} color="#2E7D32"/>
          </Field>
        </Section>

        <Section title="4. Structural condition assessment">
          <Field label="Overall structural condition">
            <RadioList options={STRUCT_COND} value={structCond} setValue={setStructCond} color={COLOR}/>
          </Field>
          <Field label="Roof condition">
            <Chips options={ROOF_COND} value={roofCond} setValue={setRoofCond} color="#E65100"/>
          </Field>
          <Field label="Wall condition">
            <Chips options={WALL_COND} value={wallCond} setValue={setWallCond} color="#6A1B9A"/>
          </Field>
          <Field label="Window / door condition">
            <Chips options={WIN_COND} value={winCond} setValue={setWinCond} color="#00838F"/>
          </Field>
        </Section>

        <Section title="5. Services & accessibility">
          {[
            {label:'Electricity available',val:electricity,set:setElectricity},
            {label:'Running water available',val:waterSvc,set:setWaterSvc},
            {label:'Disabled / wheelchair access',val:disabled,set:setDisabled},
          ].map(item=>(
            <Field key={item.label} label={item.label}>
              <Toggle value={item.val} setValue={item.set} color={COLOR}/>
            </Field>
          ))}
          <Field label="Accessibility for students">
            <Chips options={ACCESS_OPTS} value={access} setValue={setAccess} color={COLOR}/>
          </Field>
          <Field label={`Reliability / importance score: ${reliability}/5`}>
            <Stars value={reliability} setValue={setReliability} color={COLOR}/>
          </Field>
        </Section>

        <Section title="6. Photos (recommended for buildings)">
          <View style={styles.twoCol}>
            <TouchableOpacity style={[styles.photoBtn,{borderColor:COLOR}]} onPress={takePhoto}>
              <Text style={[styles.photoBtnTxt,{color:COLOR}]}>📷 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoBtn,{borderColor:COLOR}]} onPress={pickPhoto}>
              <Text style={[styles.photoBtnTxt,{color:COLOR}]}>🖼 Gallery</Text>
            </TouchableOpacity>
          </View>
          {photos.length>0&&(
            <View>
              <Text style={styles.photoCount}>{photos.length} photo{photos.length>1?'s':''} attached</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {photos.map((p,i)=>(
                  <View key={i} style={{marginRight:8}}>
                    <Image source={{uri:p.uri}} style={styles.thumb} resizeMode="cover"/>
                    <TouchableOpacity onPress={()=>setPhotos(ps=>ps.filter((_,j)=>j!==i))}>
                      <Text style={styles.removePhoto}>Remove</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </Section>

        <Section title="7. Field notes">
          <Field label="Observations, hazards, renovation needs">
            <TextInput style={[styles.input,{height:100}]} multiline textAlignVertical="top"
              placeholder="Describe visible damage, safety concerns, overcrowding, flooding risk, maintenance needs..."
              value={notes} onChangeText={setNotes}/>
          </Field>
        </Section>

        <TouchableOpacity style={[styles.submitBtn,{backgroundColor:COLOR}]} onPress={submit} disabled={submitting}>
          {submitting?<ActivityIndicator color="#fff"/>:(
            <View style={{alignItems:'center'}}>
              <Text style={styles.submitTxt}>{online?'Submit & Sync':'Save Offline'}</Text>
              <Text style={styles.submitSub}>{online?'Saved to PostGIS':`Queued (${queueCount} pending)`}</Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelBtn} onPress={()=>router.back()}>
          <Text style={styles.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Helper Components
function Section({ title, children }) {
  return <View style={styles.sec}><Text style={styles.secTitle}>{title}</Text>{children}</View>;
}
function Field({ label, children }) {
  return <View style={styles.fld}><Text style={styles.fldLabel}>{label}</Text>{children}</View>;
}
function Chips({ options, value, setValue, color }) {
  return (
    <View style={styles.chips}>
      {options.map(opt => (
        <TouchableOpacity key={opt}
          style={[styles.chip, value===opt && {backgroundColor:color,borderColor:color}]}
          onPress={() => setValue(opt)}>
          <Text style={[styles.chipTxt, value===opt && {color:'#fff'}]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
function RadioList({ options, value, setValue, color }) {
  return (
    <View style={styles.condList}>
      {options.map(opt => (
        <TouchableOpacity key={opt}
          style={[styles.condItem, value===opt && {backgroundColor:color+'18',borderColor:color}]}
          onPress={() => setValue(opt)}>
          <View style={[styles.radio, value===opt && {backgroundColor:color,borderColor:color}]}>
            {value===opt && <View style={styles.radioDot}/>}
          </View>
          <Text style={[styles.condTxt, value===opt && {color:color,fontWeight:'700'}]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
function Toggle({ value, setValue, color }) {
  return (
    <View style={styles.row}>
      {['Yes','No'].map(v => (
        <TouchableOpacity key={v}
          style={[styles.toggleBtn, value===v && {backgroundColor:color,borderColor:color}]}
          onPress={() => setValue(v)}>
          <Text style={[styles.toggleTxt, value===v && {color:'#fff'}]}>{v}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
function Stars({ value, setValue, color }) {
  return (
    <View style={styles.row}>
      {[1,2,3,4,5].map(r => (
        <TouchableOpacity key={r}
          style={[styles.starBtn, value===r && {backgroundColor:color,borderColor:color}]}
          onPress={() => setValue(r)}>
          <Text style={[styles.chipTxt, value===r && {color:'#fff'}]}>{'★'.repeat(r)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:{flex:1,backgroundColor:'#f5f5f5'},content:{padding:16,paddingBottom:60},
  header:{flexDirection:'row',alignItems:'center',gap:12,padding:14,borderRadius:12,borderWidth:1,marginBottom:12},
  hEmoji:{fontSize:30},hTitle:{fontSize:18,fontWeight:'700'},hSub:{fontSize:12,color:'#666',marginTop:2},
  status:{flexDirection:'row',alignItems:'center',gap:8,padding:10,borderRadius:10,marginBottom:16},
  dot:{width:8,height:8,borderRadius:4},statusTxt:{fontSize:12,fontWeight:'600'},
  syncBtn:{backgroundColor:'#e3f2fd',borderRadius:8,paddingHorizontal:10,paddingVertical:5},
  syncTxt:{fontSize:11,color:'#1565C0',fontWeight:'700'},
  sec:{backgroundColor:'#fff',borderRadius:12,padding:16,marginBottom:14,borderWidth:0.5,borderColor:'#e0e0e0'},
  secTitle:{fontSize:14,fontWeight:'700',color:'#333',marginBottom:12,paddingBottom:8,borderBottomWidth:0.5,borderBottomColor:'#eee'},
  note:{fontSize:12,color:'#888',marginBottom:8},
  fld:{marginBottom:14},fldLabel:{fontSize:12,fontWeight:'600',color:'#555',marginBottom:7},
  input:{backgroundColor:'#f8f8f8',borderRadius:8,padding:12,fontSize:14,borderWidth:1,borderColor:'#e0e0e0'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{paddingHorizontal:11,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:'#ddd',backgroundColor:'#f5f5f5'},
  chipTxt:{fontSize:12,color:'#333',fontWeight:'500'},
  bldgPill:{paddingHorizontal:11,paddingVertical:7,borderRadius:8,borderWidth:1,borderColor:'#ddd',backgroundColor:'#f5f5f5'},
  pillTxt:{fontSize:11,color:'#333',fontWeight:'500'},
  gpsBtn:{borderRadius:10,padding:13,alignItems:'center',minHeight:46,justifyContent:'center'},
  gpsTxt:{fontSize:12,fontWeight:'600',textAlign:'center'},
  coordBox:{backgroundColor:'#e8f5e9',borderRadius:8,padding:10,marginTop:6},
  coordLabel:{fontSize:11,color:'#2E7D32',fontWeight:'600'},
  coordVal:{fontSize:11,color:'#2E7D32',fontFamily:Platform.OS==='ios'?'Courier':'monospace',marginTop:2},
  coordSub:{fontSize:10,color:'#4CAF50',marginTop:2},
  twoCol:{flexDirection:'row',gap:8},
  condList:{gap:8},
  condItem:{flexDirection:'row',alignItems:'center',gap:10,padding:10,borderRadius:8,borderWidth:1,borderColor:'#ddd'},
  radio:{width:18,height:18,borderRadius:9,borderWidth:2,borderColor:'#ddd',alignItems:'center',justifyContent:'center'},
  radioDot:{width:8,height:8,borderRadius:4,backgroundColor:'#fff'},
  condTxt:{fontSize:13,color:'#333',flex:1},
  toggleBtn:{flex:1,paddingVertical:10,borderRadius:8,borderWidth:1,borderColor:'#ddd',alignItems:'center',backgroundColor:'#f5f5f5'},
  toggleTxt:{fontSize:13,fontWeight:'600',color:'#333'},
  starBtn:{flex:1,paddingVertical:9,borderRadius:8,borderWidth:1,borderColor:'#ddd',alignItems:'center',backgroundColor:'#f5f5f5'},
  photoBtn:{flex:1,borderRadius:10,padding:13,alignItems:'center',borderWidth:1.5,backgroundColor:'#f5f5f5'},
  photoBtnTxt:{fontSize:13,fontWeight:'600'},
  photoCount:{fontSize:12,color:'#555',marginBottom:8,marginTop:8},
  thumb:{width:100,height:80,borderRadius:8},
  removePhoto:{fontSize:11,color:'#e53935',textDecorationLine:'underline',textAlign:'center',marginTop:4},
  submitBtn:{borderRadius:14,padding:18,alignItems:'center',marginTop:8,minHeight:64,justifyContent:'center'},
  submitTxt:{color:'#fff',fontSize:17,fontWeight:'700'},
  submitSub:{color:'rgba(255,255,255,0.8)',fontSize:11,marginTop:3},
  cancelBtn:{alignItems:'center',padding:16},cancelTxt:{color:'#888',fontSize:14},
});