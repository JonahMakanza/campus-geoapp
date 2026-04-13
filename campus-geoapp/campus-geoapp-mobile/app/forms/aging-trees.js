/**
 * FORM 3 — Aged Tree Assessment
 * University of Zimbabwe Campus
 * 21 tree points pre-loaded from KML data (including evidence points)
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

const COLOR = '#2E7D32';
const BG = '#e8f5e9';

// ── 21 tree points from KML (primary + evidence) ─────────────
const TREES = [
  { name:'GPS Point 1',          lat:-17.78240423072039,  lng:31.052922759693875, evidence:false },
  { name:'GPS Point 2',          lat:-17.78239984555078,  lng:31.052983270991966, evidence:false },
  { name:'Tree 2 (Point A)',     lat:-17.78220405862439,  lng:31.051869464235764, evidence:false },
  { name:'Tree 2 (Point B)',     lat:-17.782225535177577, lng:31.051857182256054, evidence:false },
  { name:'Tree 3',               lat:-17.782011232353483, lng:31.051685912563514, evidence:false },
  { name:'Tree 4',               lat:-17.781503917665948, lng:31.052446821733426, evidence:false },
  { name:'Tree 4 — evidence',    lat:-17.7815199399069,   lng:31.052428245516477, evidence:true  },
  { name:'Tree 5',               lat:-17.781790235266836, lng:31.053059118514870, evidence:false },
  { name:'Tree 6',               lat:-17.782024836312964, lng:31.053264443362405, evidence:false },
  { name:'Tree 6 — evidence',    lat:-17.7820095144531,   lng:31.053275559169236, evidence:true  },
  { name:'Tree 7',               lat:-17.78243632057475,  lng:31.053485926269600, evidence:false },
  { name:'Tree 7 — evidence',    lat:-17.782444319388258, lng:31.053445766180722, evidence:true  },
  { name:'Tree 8',               lat:-17.78265478394609,  lng:31.053534748781220, evidence:false },
  { name:'Tree 8 — evidence',    lat:-17.782664203632272, lng:31.053563701307002, evidence:true  },
  { name:'Tree 9',               lat:-17.783260555023126, lng:31.053208820550750, evidence:false },
  { name:'Tree 10',              lat:-17.78346234934198,  lng:31.052708672388505, evidence:false },
  { name:'Tree 10 — evidence',   lat:-17.783488377146686, lng:31.052789974845530, evidence:true  },
  { name:'Tree 11',              lat:-17.783544881670675, lng:31.052619746012525, evidence:false },
  { name:'Tree 11 — evidence',   lat:-17.783602333434043, lng:31.052582209235474, evidence:true  },
  { name:'Tree 12',              lat:-17.78411584442275,  lng:31.052319668262314, evidence:false },
  { name:'Tree 12 — evidence',   lat:-17.78415071313802,  lng:31.052265018253640, evidence:true  },
];

const SPECIES     = ['Jacaranda','Msasa','Baobab','Ficus','Acacia','Flamboyant','Mopane','Teak','Unknown','Other'];
const AGE_EST     = ['Young (< 20 yrs)','Mature (20–50 yrs)','Old (50–100 yrs)','Ancient (> 100 yrs)','Unknown'];
const HEALTH      = ['Healthy — vigorous','Moderate — some stress','Declining — disease/damage','Dying — severe decline','Dead / fallen'];
const TRUNK_COND  = ['Sound','Minor cavities','Major cavities','Hollow','Split/fractured'];
const CANOPY_COND = ['Full canopy','Moderate canopy','Sparse canopy','Dead branches present','Very sparse/dying'];
const RISK        = ['No risk','Low risk','Moderate — monitor','High — action needed','Immediate hazard'];

export default function AgingTreeForm() {
  const router = useRouter();
  const [online, setOnline]         = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [syncing, setSyncing]       = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [photos, setPhotos]         = useState([]);

  const [selected, setSelected]     = useState(null);
  const [liveCoords, setLiveCoords] = useState(null);
  const [showEvidence, setShowEvidence] = useState(false);

  const [collector, setCollector]         = useState('');
  const [treeId, setTreeId]               = useState('');
  const [species, setSpecies]             = useState('Unknown');
  const [customSpecies, setCustomSpecies] = useState('');
  const [ageEst, setAgeEst]               = useState('Unknown');
  const [trunkDiam, setTrunkDiam]         = useState('');
  const [height, setHeight]               = useState('');
  const [health, setHealth]               = useState('Healthy — vigorous');
  const [trunkCond, setTrunkCond]         = useState('Sound');
  const [canopyCond, setCanopyCond]       = useState('Full canopy');
  const [risk, setRisk]                   = useState('No risk');
  const [nearInfra, setNearInfra]         = useState('No');
  const [rootDmg, setRootDmg]             = useState('No');
  const [pest, setPest]                   = useState('No');
  const [fungus, setFungus]               = useState('No');
  const [reliability, setReliability]     = useState(3);
  const [notes, setNotes]                 = useState('');
  const [recommend, setRecommend]         = useState('');

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

  const pickTree = (t) => { setSelected(t); setTreeId(t.name); setLiveCoords(null); };

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
    if (Platform.OS==='web') { Alert.alert('Use Expo Go','Camera only works in Expo Go.'); return; }
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status!=='granted') { Alert.alert('Permission needed','Camera access required.'); return; }
    const r = await ImagePicker.launchCameraAsync({ quality:0.75 });
    if (!r.canceled) setPhotos(p=>[...p,r.assets[0]]);
  };

  const pickPhoto = async () => {
    const r = await ImagePicker.launchImageLibraryAsync({ quality:0.75, allowsMultipleSelection:true });
    if (!r.canceled) setPhotos(p=>[...p,...r.assets]);
  };

  const coords = liveCoords ? { lat:liveCoords.lat, lng:liveCoords.lng }
               : selected   ? { lat:selected.lat,   lng:selected.lng  }
               : null;

  const validate = () => {
    if (!collector.trim()) { Alert.alert('Required','Enter your name.'); return false; }
    if (!coords)            { Alert.alert('Required','Select a tree point or capture GPS.'); return false; }
    return true;
  };

  const buildPayload = () => ({
    type:'aged_tree',
    latitude:  coords.lat.toString(),
    longitude: coords.lng.toString(),
    collector_name:     collector.trim(),
    tree_id:            treeId,
    species:            species==='Other' ? customSpecies : species,
    age_estimate:       ageEst,
    trunk_diameter_cm:  trunkDiam,
    estimated_height_m: height,
    health_status:      health,
    condition:          health,
    trunk_condition:    trunkCond,
    canopy_condition:   canopyCond,
    risk_level:         risk,
    near_infrastructure: nearInfra,
    root_damage:        rootDmg,
    pest_present:       pest,
    fungus_present:     fungus,
    reliability_score:  reliability.toString(),
    description:        notes,
    recommendation:     recommend,
    submitted_at:       new Date().toISOString(),
  });

  const reset = () => {
    setSelected(null); setLiveCoords(null); setCollector(''); setTreeId('');
    setSpecies('Unknown'); setCustomSpecies(''); setAgeEst('Unknown');
    setTrunkDiam(''); setHeight(''); setHealth('Healthy — vigorous');
    setTrunkCond('Sound'); setCanopyCond('Full canopy'); setRisk('No risk');
    setNearInfra('No'); setRootDmg('No'); setPest('No'); setFungus('No');
    setReliability(3); setNotes(''); setRecommend(''); setPhotos([]);
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
        Alert.alert('Submitted!', `Tree data saved to PostGIS geodatabase.`, [
          { text: 'Another tree', onPress: reset },
          { text: 'View map', onPress: () => router.push('/map') },
          { text: 'Home', onPress: () => router.push('/') },
        ]);
      } else {
        Alert.alert('Saved Offline', `Data saved locally. ${result.queueLength} item(s) in queue.`, [
          { text: 'Another tree', onPress: reset },
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

  const displayTrees = showEvidence ? TREES : TREES.filter(t=>!t.evidence);

  return (
    <KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView style={styles.wrap} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        <View style={[styles.header,{backgroundColor:BG,borderColor:COLOR+'40'}]}>
          <Text style={styles.hEmoji}>🌳</Text>
          <View style={{flex:1}}>
            <Text style={[styles.hTitle,{color:COLOR}]}>Aged Tree Assessment</Text>
            <Text style={styles.hSub}>University of Zimbabwe Campus · 21 tree points</Text>
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
            <TextInput style={styles.input} placeholder="e.g. Tatenda Mutasa"
              value={collector} onChangeText={setCollector} autoCapitalize="words"/>
          </Field>
        </Section>

        <Section title="2. Select tree point from KML">
          <View style={styles.evidenceRow}>
            <Text style={styles.note}>Tap a tree point (solid = primary, dashed = evidence photo point):</Text>
            <TouchableOpacity
              style={[styles.evidenceToggle,showEvidence&&{backgroundColor:COLOR,borderColor:COLOR}]}
              onPress={()=>setShowEvidence(!showEvidence)}>
              <Text style={[styles.evidenceTxt,showEvidence&&{color:'#fff'}]}>
                {showEvidence?'Hide evidence pts':'Show evidence pts'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.grid}>
            {displayTrees.map((t,i)=>(
              <TouchableOpacity key={i}
                style={[styles.treePill,
                  selected?.name===t.name&&{backgroundColor:COLOR,borderColor:COLOR},
                  t.evidence&&{borderStyle:'dashed'},
                ]}
                onPress={()=>pickTree(t)}>
                <Text style={[styles.pillTxt,selected?.name===t.name&&{color:'#fff'}]}>{t.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={[styles.gpsBtn,{backgroundColor:liveCoords?'#e8f5e9':COLOR,marginTop:10}]}
            onPress={getGPS}>
            {gpsLoading?<ActivityIndicator color={liveCoords?COLOR:'#fff'}/>
              :<Text style={[styles.gpsTxt,{color:liveCoords?COLOR:'#fff'}]}>
                {liveCoords?`Live GPS: ${liveCoords.lat.toFixed(6)}, ${liveCoords.lng.toFixed(6)}`:'Or: Capture live GPS (new tree)'}
              </Text>}
          </TouchableOpacity>

          {coords&&(
            <View style={styles.coordBox}>
              <Text style={styles.coordLabel}>{liveCoords?'Live GPS captured':`KML point: ${selected?.name}`}</Text>
              <Text style={styles.coordVal}>Lat {coords.lat.toFixed(6)}  Lng {coords.lng.toFixed(6)}</Text>
              <Text style={styles.coordSub}>→ PostGIS Point (EPSG:4326)</Text>
            </View>
          )}

          <Field label="Tree ID / label">
            <TextInput style={styles.input} placeholder="Auto-filled or enter custom label..."
              value={treeId} onChangeText={setTreeId}/>
          </Field>
        </Section>

        <Section title="3. Tree identification">
          <Field label="Species (if known)">
            <Chips options={SPECIES} value={species} setValue={setSpecies} color={COLOR}/>
            {species==='Other'&&(
              <TextInput style={[styles.input,{marginTop:8}]} placeholder="Enter species name..."
                value={customSpecies} onChangeText={setCustomSpecies}/>
            )}
          </Field>
          <Field label="Estimated age">
            <Chips options={AGE_EST} value={ageEst} setValue={setAgeEst} color="#5D4037"/>
          </Field>
          <View style={styles.twoCol}>
            <View style={{flex:1}}>
              <Field label="Trunk diameter (cm)">
                <TextInput style={styles.input} placeholder="e.g. 120" keyboardType="numeric"
                  value={trunkDiam} onChangeText={setTrunkDiam}/>
              </Field>
            </View>
            <View style={{width:10}}/>
            <View style={{flex:1}}>
              <Field label="Est. height (m)">
                <TextInput style={styles.input} placeholder="e.g. 15" keyboardType="numeric"
                  value={height} onChangeText={setHeight}/>
              </Field>
            </View>
          </View>
        </Section>

        <Section title="4. Health & structural assessment">
          <Field label="Overall health status">
            <RadioList options={HEALTH} value={health} setValue={setHealth} color={COLOR}/>
          </Field>
          <Field label="Trunk condition">
            <Chips options={TRUNK_COND} value={trunkCond} setValue={setTrunkCond} color="#5D4037"/>
          </Field>
          <Field label="Canopy condition">
            <Chips options={CANOPY_COND} value={canopyCond} setValue={setCanopyCond} color={COLOR}/>
          </Field>

          {[
            {label:'Root damage or upheaval visible',val:rootDmg,set:setRootDmg},
            {label:'Pest infestation signs present',val:pest,set:setPest},
            {label:'Fungal growth / rot visible',val:fungus,set:setFungus},
            {label:'Near buildings or infrastructure',val:nearInfra,set:setNearInfra},
          ].map(item=>(
            <Field key={item.label} label={item.label}>
              <Toggle value={item.val} setValue={item.set} color={COLOR}/>
            </Field>
          ))}

          <Field label="Risk to people or property">
            <RadioList options={RISK} value={risk} setValue={setRisk} color="#B71C1C"/>
          </Field>

          <Field label={`Data reliability: ${reliability}/5`}>
            <Stars value={reliability} setValue={setReliability} color={COLOR}/>
          </Field>
        </Section>

        <Section title="5. Photos">
          <View style={styles.twoCol}>
            <TouchableOpacity style={[styles.photoBtn,{borderColor:COLOR}]} onPress={takePhoto}>
              <Text style={[styles.photoBtnTxt,{color:COLOR}]}>📷 Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoBtn,{borderColor:COLOR}]} onPress={pickPhoto}>
              <Text style={[styles.photoBtnTxt,{color:COLOR}]}>🖼 Gallery</Text>
            </TouchableOpacity>
          </View>
          {photos.length>0&&(
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginTop:8}}>
              {photos.map((p,i)=>(
                <View key={i} style={{marginRight:8}}>
                  <Image source={{uri:p.uri}} style={styles.thumb} resizeMode="cover"/>
                  <TouchableOpacity onPress={()=>setPhotos(ps=>ps.filter((_,j)=>j!==i))}>
                    <Text style={styles.removePhoto}>Remove</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
        </Section>

        <Section title="6. Field notes & management recommendation">
          <Field label="Observations">
            <TextInput style={[styles.input,{height:80}]} multiline textAlignVertical="top"
              placeholder="Damage, lean, root exposure, surrounding land use, nearby infrastructure..."
              value={notes} onChangeText={setNotes}/>
          </Field>
          <Field label="Management recommendation">
            <TextInput style={[styles.input,{height:70}]} multiline textAlignVertical="top"
              placeholder="e.g. Remove dead branches, treat for pests, monitor, no action needed..."
              value={recommend} onChangeText={setRecommend}/>
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

// Helper Components (same as previous forms)
function Section({title,children}){return <View style={styles.sec}><Text style={styles.secTitle}>{title}</Text>{children}</View>;}
function Field({label,children}){return <View style={styles.fld}><Text style={styles.fldLabel}>{label}</Text>{children}</View>;}
function Chips({options,value,setValue,color}) {
  return (
    <View style={styles.chips}>
      {options.map(opt=>(
        <TouchableOpacity key={opt}
          style={[styles.chip,value===opt&&{backgroundColor:color,borderColor:color}]}
          onPress={()=>setValue(opt)}>
          <Text style={[styles.chipTxt,value===opt&&{color:'#fff'}]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
function RadioList({options,value,setValue,color}) {
  return (
    <View style={styles.condList}>
      {options.map(opt=>(
        <TouchableOpacity key={opt}
          style={[styles.condItem,value===opt&&{backgroundColor:color+'18',borderColor:color}]}
          onPress={()=>setValue(opt)}>
          <View style={[styles.radio,value===opt&&{backgroundColor:color,borderColor:color}]}>
            {value===opt&&<View style={styles.radioDot}/>}
          </View>
          <Text style={[styles.condTxt,value===opt&&{color:color,fontWeight:'700'}]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
function Toggle({value,setValue,color}) {
  return (
    <View style={styles.row}>
      {['Yes','No'].map(v=>(
        <TouchableOpacity key={v}
          style={[styles.toggleBtn,value===v&&{backgroundColor:color,borderColor:color}]}
          onPress={()=>setValue(v)}>
          <Text style={[styles.toggleTxt,value===v&&{color:'#fff'}]}>{v}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
function Stars({value,setValue,color}) {
  return (
    <View style={styles.row}>
      {[1,2,3,4,5].map(r=>(
        <TouchableOpacity key={r}
          style={[styles.starBtn,value===r&&{backgroundColor:color,borderColor:color}]}
          onPress={()=>setValue(r)}>
          <Text style={[styles.chipTxt,value===r&&{color:'#fff'}]}>{'★'.repeat(r)}</Text>
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
  syncBtn:{backgroundColor:'#e8f5e9',borderRadius:8,paddingHorizontal:10,paddingVertical:5},
  syncTxt:{fontSize:11,fontWeight:'700'},
  sec:{backgroundColor:'#fff',borderRadius:12,padding:16,marginBottom:14,borderWidth:0.5,borderColor:'#e0e0e0'},
  secTitle:{fontSize:14,fontWeight:'700',color:'#333',marginBottom:12,paddingBottom:8,borderBottomWidth:0.5,borderBottomColor:'#eee'},
  note:{fontSize:12,color:'#888',marginBottom:6,flex:1},
  evidenceRow:{flexDirection:'row',alignItems:'center',gap:8,marginBottom:8},
  evidenceToggle:{paddingHorizontal:10,paddingVertical:6,borderRadius:8,borderWidth:1,borderColor:'#ddd',backgroundColor:'#f5f5f5'},
  evidenceTxt:{fontSize:11,color:'#555',fontWeight:'500'},
  fld:{marginBottom:14},fldLabel:{fontSize:12,fontWeight:'600',color:'#555',marginBottom:7},
  input:{backgroundColor:'#f8f8f8',borderRadius:8,padding:12,fontSize:14,borderWidth:1,borderColor:'#e0e0e0'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{paddingHorizontal:11,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:'#ddd',backgroundColor:'#f5f5f5'},
  chipTxt:{fontSize:12,color:'#333',fontWeight:'500'},
  treePill:{paddingHorizontal:10,paddingVertical:7,borderRadius:8,borderWidth:1,borderColor:'#ddd',backgroundColor:'#f5f5f5'},
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
  thumb:{width:100,height:80,borderRadius:8},
  removePhoto:{fontSize:11,color:'#e53935',textDecorationLine:'underline',textAlign:'center',marginTop:4},
  submitBtn:{borderRadius:14,padding:18,alignItems:'center',marginTop:8,minHeight:64,justifyContent:'center'},
  submitTxt:{color:'#fff',fontSize:17,fontWeight:'700'},
  submitSub:{color:'rgba(255,255,255,0.8)',fontSize:11,marginTop:3},
  cancelBtn:{alignItems:'center',padding:16},cancelTxt:{color:'#888',fontSize:14},
});