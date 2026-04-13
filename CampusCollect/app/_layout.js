import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, StatusBar, Alert } from 'react-native';
import networkManager from './utils/networkManager';

export default function Layout() {
    const [isOnline, setIsOnline] = useState(false);
    const [queueCount, setQueueCount] = useState(0);
    const [serverUrl, setServerUrl] = useState(null);
    const [showSyncBanner, setShowSyncBanner] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // RENDER CLOUD URL - PERMANENT, NEVER CHANGES
    const DEFAULT_RENDER_URL = 'https://campus-geoapp-api.onrender.com';

    useEffect(() => {
        networkManager.initialize(DEFAULT_RENDER_URL).then(async (url) => {
            console.log('Initialized with URL:', url);
            setServerUrl(url);
            setIsOnline(networkManager.isConnected());
            const count = await networkManager.getQueueCount();
            setQueueCount(count);
            if (count > 0) setShowSyncBanner(true);
        }).catch(error => {
            console.error('Initialization error:', error);
        });

        const handleNetworkEvent = (event, data) => {
            console.log('Network event:', event, data);
            
            switch (event) {
                case 'connection_change':
                    setIsOnline(data);
                    if (data) {
                        networkManager.getQueueCount().then(count => {
                            if (count > 0) setShowSyncBanner(true);
                        });
                    }
                    break;
                case 'queued':
                    setQueueCount(data);
                    setShowSyncBanner(true);
                    break;
                case 'sync_started':
                    setSyncing(true);
                    break;
                case 'sync_complete':
                    setSyncing(false);
                    setQueueCount(data.remaining || data.failed);
                    if (data.remaining === 0 || data.failed === 0) {
                        setShowSyncBanner(false);
                    }
                    if (data.success > 0) {
                        Alert.alert('Sync Complete', `${data.success} record(s) synced to server.`);
                    }
                    if (data.failed > 0) {
                        Alert.alert('Sync Partial', `${data.failed} record(s) failed to sync. Will retry.`);
                    }
                    break;
                case 'offline_mode':
                    setIsOnline(false);
                    break;
                case 'reconnected':
                    Alert.alert('Connected', `Connected to server: ${data?.replace('https://', '').replace('http://', '').slice(0, 30)}`);
                    break;
                case 'server_changed':
                    setServerUrl(data);
                    break;
            }
        };
        
        networkManager.addListener(handleNetworkEvent);
        
        return () => {
            networkManager.removeListener(handleNetworkEvent);
        };
    }, []);

    const handleSync = async () => {
        if (syncing) {
            Alert.alert('Sync in Progress', 'Please wait for current sync to complete.');
            return;
        }
        setSyncing(true);
        await networkManager.syncOfflineData();
        const count = await networkManager.getQueueCount();
        setQueueCount(count);
        if (count === 0) setShowSyncBanner(false);
        setSyncing(false);
    };

    const handleServerSettings = () => {
        Alert.prompt(
            'Server URL',
            'Enter the server URL\n\nCurrent: ' + (serverUrl || 'Not set'),
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Save',
                    onPress: async (url) => {
                        if (url && url.trim()) {
                            let newUrl = url.trim();
                            if (!newUrl.startsWith('http')) {
                                newUrl = 'https://' + newUrl;
                            }
                            if (newUrl.endsWith('/')) {
                                newUrl = newUrl.slice(0, -1);
                            }
                            
                            Alert.alert('Testing Connection', 'Please wait...');
                            const success = await networkManager.setServerUrl(newUrl);
                            
                            if (success) {
                                setServerUrl(newUrl);
                                setIsOnline(true);
                                Alert.alert('Success', 'Server URL updated and connected successfully!');
                                const count = await networkManager.getQueueCount();
                                if (count > 0) {
                                    setShowSyncBanner(true);
                                }
                            } else {
                                Alert.alert('Error', 'Could not connect to the server.');
                            }
                        }
                    }
                }
            ],
            'plain-text',
            serverUrl || DEFAULT_RENDER_URL
        );
    };

    return (
        <>
            <StatusBar barStyle="light-content" backgroundColor="#1D9E75" />
            
            <View style={[styles.statusBar, isOnline ? styles.online : styles.offline]}>
                <View style={styles.statusLeft}>
                    <View style={[styles.dot, { backgroundColor: isOnline ? '#fff' : '#ffeb3b' }]} />
                    <Text style={styles.statusText}>
                        {isOnline ? 'Online' : 'Offline'}
                    </Text>
                </View>
                
                <TouchableOpacity onPress={handleServerSettings} style={styles.serverBtn}>
                    <Text style={styles.serverText} numberOfLines={1}>
                        {serverUrl ? serverUrl.replace('https://', '').replace('http://', '').slice(0, 25) : 'Set Server'}
                    </Text>
                </TouchableOpacity>
                
                {queueCount > 0 && (
                    <TouchableOpacity onPress={handleSync} disabled={syncing} style={styles.syncBtn}>
                        <Text style={styles.syncText}>
                            {syncing ? '🔄' : `📤 ${queueCount}`}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>

            {showSyncBanner && queueCount > 0 && !syncing && isOnline && (
                <TouchableOpacity style={styles.syncBanner} onPress={handleSync}>
                    <Text style={styles.syncBannerText}>
                        🔄 You have {queueCount} offline record(s). Tap to sync now.
                    </Text>
                </TouchableOpacity>
            )}

            <Stack
                screenOptions={{
                    headerStyle: { backgroundColor: '#1D9E75' },
                    headerTintColor: '#fff',
                    headerTitleStyle: { fontWeight: 'bold' },
                    headerShadowVisible: false,
                }}
            >
                <Stack.Screen name="index" options={{ title: 'CampusCollect', headerShown: true }} />
                <Stack.Screen name="map" options={{ title: 'Campus Map', headerShown: true, headerBackTitle: 'Back' }} />
                <Stack.Screen name="navigate" options={{ title: 'Navigation', headerShown: false, presentation: 'fullScreenModal' }} />
                <Stack.Screen name="forms/food-outlets" options={{ title: 'Food Outlet Survey', headerShown: true, headerBackTitle: 'Back' }} />
                <Stack.Screen name="forms/building-conditions" options={{ title: 'Building Condition Survey', headerShown: true, headerBackTitle: 'Back' }} />
                <Stack.Screen name="forms/aging-trees" options={{ title: 'Aged Tree Assessment', headerShown: true, headerBackTitle: 'Back' }} />
                <Stack.Screen name="forms/printing-stations" options={{ title: 'Printing Station Survey', headerShown: true, headerBackTitle: 'Back' }} />
            </Stack>
        </>
    );
}

const styles = StyleSheet.create({
    statusBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 15,
        paddingVertical: 8,
        paddingTop: Platform.OS === 'ios' ? 50 : 8,
    },
    online: { backgroundColor: '#2ecc71' },
    offline: { backgroundColor: '#e74c3c' },
    statusLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
    serverBtn: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    serverText: { color: '#fff', fontSize: 10, maxWidth: 150 },
    syncBtn: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
    syncText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
    syncBanner: { backgroundColor: '#3498db', paddingVertical: 10, paddingHorizontal: 15, alignItems: 'center' },
    syncBannerText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});