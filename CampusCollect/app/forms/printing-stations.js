/**
 * FORM 4 — Printing Station Survey
 * University of Zimbabwe Campus
 * 13 stations pre-loaded from KML data
 * UPDATED: Uses centralized networkManager for offline queue
 */
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, Alert, ActivityIndicator, Platform, KeyboardAvoidingView,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import networkManager from '../utils/networkManager';

const COLOR = '#6A1B9A';
const BG = '#f3e5f5';

// ── 13 UZ printing stations from KML ─────────────────────────
const STATIONS = [
  { name:'Urban Planning Printing Services', faculty:'Urban Planning',   lat:-17.7828079, lng:31.0532857 },
  { name:'Zoology Printing Station',         faculty:'Zoology',          lat:-17.7831259, lng:31.0519457 },
  { name:'ICT Printing Station',             faculty:'ICT',              lat:-17.783009,  lng:31.0510092 },
  { name:'Physiology Printing Station',      faculty:'Physiology/Med',   lat:-17.7840749, lng:31.0491414 },
  { name:'Pharmacy Admin Printing Station',  faculty:'Pharmacy',         lat:-17.7842267, lng:31.0486196 },
  { name:'Engineering Printing Station',     faculty:'Engineering',      lat:-17.781943,  lng:31.0493227 },
  { name:'Agriculture Printing Station',     faculty:'Agriculture',      lat:-17.7817852, lng:31.0505864 },
  { name:'Education Printing Station',       faculty:'Education',        lat:-17.781126,  lng:31.0506393 },
  { name:'Law Printing Station',             faculty:'Law',              lat:-17.7804699, lng:31.0523991 },
  { name:'Leewilin Printing Station',        faculty:'Leewilin',         lat:-17.7810909, lng:31.0528262 },
  { name:'Reprographic Unit',                faculty:'Central Services', lat:-17.7813281, lng:31.0532151 },
  { name:'Administration Printing Station',  faculty:'Administration',   lat:-17.7815851, lng:31.0547738 },
  { name:'SU Printing Station',              faculty:'Student Union',    lat:-17.7825628, lng:31.0547985 },
];

const FACULTIES   = [...new Set(STATIONS.map(s=>s.faculty))];
const SERVICES    = ['B&W printing','Colour printing','Scanning','Photocopying','Binding','Laminating','Typesetting','Thesis printing'];
const CONDITIONS  = ['Excellent — fully operational','Good — minor issues','Fair — some equipment down','Poor — mostly non-functional','Closed/defunct'];
const ACCESS_OPTS = ['Very accessible','Accessible','Moderately accessible','Restricted (staff/students only)'];
const QUEUE_OPTS  = ['No queues','Short queues','Moderate queues','Long queues always','Overwhelmed'];
const PAYMENT     = ['Cash only','EcoCash / mobile money','Swipe card','Multiple methods','Free (subsidised)'];
const OWNERSHIP   = ['University owned','Private (leased space)','Student Union','Faculty managed','Unknown'];

export default function PrintingStationForm() {
  const router = useRouter();
  const [online, setOnline]           = useState(true);
  const [queueCount, setQueueCount]   = useState(0);
  const [syncing, setSyncing]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const [gpsLoading, setGpsLoading]   = useState(false);

  const [facultyFilter, setFacultyFilter] = useState(null);
  const [selected, setSelected]           = useState(null);
  const [liveCoords, setLiveCoords]       = useState(null);

  const [collector, setCollector]           = useState('');
  const [stationName, setStationName]       = useState('');
  const [services, setServices]             = useState([]);
  const [priceBW, setPriceBW]               = useState('');
  const [priceColour, setPriceColour]       = useState('');
  const [hours, setHours]                   = useState('');
  const [equipTotal, setEquipTotal]         = useState('');
  const [equipWorking, setEquipWorking]     = useState('');
  const [condition, setCondition]           = useState('Good — minor issues');
  const [access, setAccess]                 = useState('Accessible');
  const [queueLvl, setQueueLvl]             = useState('Short queues');
  const [payment, setPayment]               = useState('Cash only');
  const [ownership, setOwnership]           = useState('University owned');
  const [internet, setInternet]             = useState('No');
  const [selfSvc, setSelfSvc]               = useState('No');
  const [reliability, setReliability]       = useState(3);
  const [notes, setNotes]                   = useState('');

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

  const filtered = facultyFilter ? STATIONS.filter(s=>s.faculty===facultyFilter) : STATIONS;

  const pickStation = (s) => { setSelected(s); setStationName(s.name); setLiveCoords(null); };

  const toggleService = (s) => setServices(prev => prev.includes(s) ? prev.filter(x=>x!==s) : [...prev,s]);

  const getGPS = async () => {
    setGpsLoading(true);
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed','Allow location access.'); setGpsLoading(false); return; }
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    setLiveCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude, acc: loc.coords.accuracy });
    setSelected(null); setGpsLoading(false);
  };

  const coords = liveCoords ? { lat:liveCoords.lat, lng:liveCoords.lng }
               : selected   ? { lat:selected.lat,   lng:selected.lng  }
               : null;

  const validate = () => {
    if (!collector.trim())   { Alert.alert('Required','Enter your name.'); return false; }
    if (!stationName.trim()) { Alert.alert('Required','Select or enter a station name.'); return false; }
    if (!coords)              { Alert.alert('Required','Select a station or capture GPS.'); return false; }
    return true;
  };

  const buildPayload = () => ({
    type:'print_shop',
    latitude:  coords.lat.toString(),
    longitude: coords.lng.toString(),
    collector_name:       collector.trim(),
    shop_name:            stationName.trim(),
    faculty:              selected?.faculty || facultyFilter || '',
    services_offered:     services.join(', '),
    price_bw_per_page:    priceBW,
    price_colour_per_page: priceColour,
    operating_hours:      hours,
    equipment_count:      equipTotal,
    working_equipment:    equipWorking,
    condition,
    accessibility:        access,
    queue_level:          queueLvl,
    payment_method:       payment,
    ownership,
    internet_available:   internet,
    self_service:         selfSvc,
    reliability_score:    reliability.toString(),
    description:          notes,
    submitted_at:         new Date().toISOString(),
  });

  const reset = () => {
    setSelected(null); setLiveCoords(null); setFacultyFilter(null);
    setCollector(''); setStationName(''); setServices([]); setPriceBW('');
    setPriceColour(''); setHours(''); setEquipTotal(''); setEquipWorking('');
    setCondition('Good — minor issues'); setAccess('Accessible'); setQueueLvl('Short queues');
    setPayment('Cash only'); setOwnership('University owned');
    setInternet('No'); setSelfSvc('No'); setReliability(3); setNotes('');
  };

  const submit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    const payload = buildPayload();

    const result = await networkManager.submitData('/assets', payload);
    
    if (result.success) {
      if (result.online) {
        Alert.alert('Submitted!', `${stationName} saved to PostGIS geodatabase.`, [
          { text: 'Another station', onPress: reset },
          { text: 'View map', onPress: () => router.push('/map') },
          { text: 'Home', onPress: () => router.push('/') },
        ]);
      } else {
        Alert.alert('Saved Offline', `Data saved locally. ${result.queueLength} item(s) in queue.`, [
          { text: 'Another station', onPress: reset },
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
          <Text style={styles.hEmoji}>🖨</Text>
          <View style={{flex:1}}>
            <Text style={[styles.hTitle,{color:COLOR}]}>Printing Station Survey</Text>
            <Text style={styles.hSub}>University of Zimbabwe Campus · 13 stations</Text>
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
            <TextInput style={styles.input} placeholder="e.g. Farai Ncube"
              value={collector} onChangeText={setCollector} autoCapitalize="words"/>
          </Field>
        </Section>

        <Section title="2. Select printing station">
          <Text style={styles.note}>Filter by faculty, then tap a station:</Text>
          <View style={styles.chips}>
            {FACULTIES.map(f=>(
              <TouchableOpacity key={f}
                style={[styles.chip,facultyFilter===f&&{backgroundColor:COLOR,borderColor:COLOR}]}
                onPress={()=>setFacultyFilter(facultyFilter===f?null:f)}>
                <Text style={[styles.chipTxt,facultyFilter===f&&{color:'#fff'}]}>{f}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={[styles.grid,{marginTop:10}]}>
            {filtered.map((s,i)=>(
              <TouchableOpacity key={i}
                style={[styles.stPill,selected?.name===s.name&&{backgroundColor:COLOR,borderColor:COLOR}]}
                onPress={()=>pickStation(s)}>
                <Text style={[styles.pillTxt,selected?.name===s.name&&{color:'#fff'}]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Field label="Or enter new station name">
            <TextInput style={styles.input} placeholder="Station not in list..."
              value={stationName}
              onChangeText={v=>{setStationName(v);setSelected(null);}}/>
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
              <Text style={styles.coordLabel}>{selected?`KML: ${selected.name}`:'Live GPS captured'}</Text>
              <Text style={styles.coordVal}>Lat {coords.lat.toFixed(6)}  Lng {coords.lng.toFixed(6)}</Text>
              <Text style={styles.coordSub}>→ PostGIS Point (EPSG:4326)</Text>
            </View>
          )}
        </Section>

        <Section title="3. Services & pricing">
          <Field label="Services available (tap all that apply)">
            <View style={styles.chips}>
              {SERVICES.map(sv=>(
                <TouchableOpacity key={sv}
                  style={[styles.chip,services.includes(sv)&&{backgroundColor:COLOR,borderColor:COLOR}]}
                  onPress={()=>toggleService(sv)}>
                  <Text style={[styles.chipTxt,services.includes(sv)&&{color:'#fff'}]}>{sv}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>
          <View style={styles.twoCol}>
            <View style={{flex:1}}>
              <Field label="B&W price per page">
                <TextInput style={styles.input} placeholder="e.g. $0.05 / ZWG 0.20"
                  value={priceBW} onChangeText={setPriceBW}/>
              </Field>
            </View>
            <View style={{width:10}}/>
            <View style={{flex:1}}>
              <Field label="Colour price per page">
                <TextInput style={styles.input} placeholder="e.g. $0.20"
                  value={priceColour} onChangeText={setPriceColour}/>
              </Field>
            </View>
          </View>
          <Field label="Operating hours">
            <TextInput style={styles.input} placeholder="e.g. Mon–Fri 08:00–16:30"
              value={hours} onChangeText={setHours}/>
          </Field>
          <View style={styles.twoCol}>
            <View style={{flex:1}}>
              <Field label="Total machines">
                <TextInput style={styles.input} placeholder="e.g. 4" keyboardType="numeric"
                  value={equipTotal} onChangeText={setEquipTotal}/>
              </Field>
            </View>
            <View style={{width:10}}/>
            <View style={{flex:1}}>
              <Field label="Currently working">
                <TextInput style={styles.input} placeholder="e.g. 3" keyboardType="numeric"
                  value={equipWorking} onChangeText={setEquipWorking}/>
              </Field>
            </View>
          </View>
          {[
            {label:'Internet / WiFi for uploads',val:internet,set:setInternet},
            {label:'Self-service (students print themselves)',val:selfSvc,set:setSelfSvc},
          ].map(item=>(
            <Field key={item.label} label={item.label}>
              <Toggle value={item.val} setValue={item.set} color={COLOR}/>
            </Field>
          ))}
          <Field label="Payment method">
            <Chips options={PAYMENT} value={payment} setValue={setPayment} color="#1565C0"/>
          </Field>
          <Field label="Ownership / management">
            <Chips options={OWNERSHIP} value={ownership} setValue={setOwnership} color="#2E7D32"/>
          </Field>
        </Section>

        <Section title="4. Condition & accessibility assessment">
          <Field label="Overall station condition">
            <RadioList options={CONDITIONS} value={condition} setValue={setCondition} color={COLOR}/>
          </Field>
          <Field label="Accessibility for students">
            <Chips options={ACCESS_OPTS} value={access} setValue={setAccess} color="#1565C0"/>
          </Field>
          <Field label="Typical queue / demand level">
            <Chips options={QUEUE_OPTS} value={queueLvl} setValue={setQueueLvl} color="#E65100"/>
          </Field>
          <Field label={`Reliability score: ${reliability}/5`}>
            <Stars value={reliability} setValue={setReliability} color={COLOR}/>
          </Field>
        </Section>

        <Section title="5. Field observations">
          <Field label="Notes (equipment quality, staff responsiveness, student complaints...)">
            <TextInput style={[styles.input,{height:90}]} multiline textAlignVertical="top"
              placeholder="Describe what you observed — queues, equipment state, service quality..."
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
  syncBtn:{backgroundColor:'#f3e5f5',borderRadius:8,paddingHorizontal:10,paddingVertical:5},
  syncTxt:{fontSize:11,fontWeight:'700'},
  sec:{backgroundColor:'#fff',borderRadius:12,padding:16,marginBottom:14,borderWidth:0.5,borderColor:'#e0e0e0'},
  secTitle:{fontSize:14,fontWeight:'700',color:'#333',marginBottom:12,paddingBottom:8,borderBottomWidth:0.5,borderBottomColor:'#eee'},
  note:{fontSize:12,color:'#888',marginBottom:8},
  fld:{marginBottom:14},fldLabel:{fontSize:12,fontWeight:'600',color:'#555',marginBottom:7},
  input:{backgroundColor:'#f8f8f8',borderRadius:8,padding:12,fontSize:14,borderWidth:1,borderColor:'#e0e0e0'},
  grid:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chips:{flexDirection:'row',flexWrap:'wrap',gap:7},
  chip:{paddingHorizontal:11,paddingVertical:8,borderRadius:20,borderWidth:1,borderColor:'#ddd',backgroundColor:'#f5f5f5'},
  chipTxt:{fontSize:12,color:'#333',fontWeight:'500'},
  stPill:{paddingHorizontal:11,paddingVertical:7,borderRadius:8,borderWidth:1,borderColor:'#ddd',backgroundColor:'#f5f5f5'},
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
  submitBtn:{borderRadius:14,padding:18,alignItems:'center',marginTop:8,minHeight:64,justifyContent:'center'},
  submitTxt:{color:'#fff',fontSize:17,fontWeight:'700'},
  submitSub:{color:'rgba(255,255,255,0.8)',fontSize:11,marginTop:3},
  cancelBtn:{alignItems:'center',padding:16},cancelTxt:{color:'#888',fontSize:14},
});