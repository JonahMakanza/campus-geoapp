import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEYS = {
    SERVER_URL: '@server_url',
    OFFLINE_QUEUE: '@offline_queue',
    CACHED_ASSETS: '@cached_assets'
};

class NetworkManager {
    constructor() {
        this.currentServerUrl = null;
        this.isOnline = false;
        this.listeners = [];
        this.syncInProgress = false;
    }

    async initialize(defaultUrl = null) {
        const savedUrl = await AsyncStorage.getItem(STORAGE_KEYS.SERVER_URL);
        this.currentServerUrl = savedUrl || defaultUrl || 'https://campus-geoapp-api.onrender.com';
        this.startMonitoring();
        await this.testConnection();
        this.notifyListeners('connection_change', this.isOnline);
        return this.currentServerUrl;
    }

    async testConnection() {
        if (!this.currentServerUrl) return false;
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch(`${this.currentServerUrl}/assets?limit=1`, {
                method: 'GET',
                signal: controller.signal,
                headers: { 'Content-Type': 'application/json' }
            });
            clearTimeout(timeoutId);
            this.isOnline = response.ok;
            return this.isOnline;
        } catch (error) {
            this.isOnline = false;
            return false;
        }
    }

    startMonitoring() {
        NetInfo.addEventListener(async (state) => {
            const wasOnline = this.isOnline;
            this.isOnline = state.isConnected && state.isInternetReachable;
            if (!wasOnline && this.isOnline) {
                await this.testConnection();
                if (this.isOnline) {
                    await this.syncOfflineData();
                    this.notifyListeners('reconnected', this.currentServerUrl);
                }
            }
            this.notifyListeners('connection_change', this.isOnline);
        });
    }

    async syncOfflineData() {
        if (this.syncInProgress) return { success: 0, failed: 0 };
        if (!this.isOnline) return { success: 0, failed: 0 };
        
        this.syncInProgress = true;
        const queue = await this.getOfflineQueue();
        
        if (queue.length === 0) {
            this.syncInProgress = false;
            return { success: 0, failed: 0 };
        }
        
        this.notifyListeners('sync_started', queue.length);
        let success = 0, failed = 0;
        const failedItems = [];
        
        for (const item of queue) {
            try {
                const formData = new FormData();
                Object.keys(item.data).forEach(key => {
                    if (key === 'photo_uri' && item.data[key]) {
                        formData.append('photo', {
                            uri: item.data[key],
                            name: 'photo.jpg',
                            type: 'image/jpeg'
                        });
                    } else if (key !== 'id' && key !== 'savedAt') {
                        formData.append(key, String(item.data[key]));
                    }
                });
                
                const response = await fetch(`${this.currentServerUrl}/assets`, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                if (response.ok) {
                    success++;
                } else {
                    failed++;
                    failedItems.push(item);
                }
            } catch (error) {
                failed++;
                failedItems.push(item);
            }
        }
        
        await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(failedItems));
        this.syncInProgress = false;
        this.notifyListeners('sync_complete', { 
            success: success, 
            failed: failed,
            remaining: failedItems.length 
        });
        
        return { success, failed };
    }

    async refreshCachedAssets() {
        if (!this.isOnline || !this.currentServerUrl) return;
        try {
            const response = await fetch(`${this.currentServerUrl}/assets`);
            if (response.ok) {
                const assets = await response.json();
                await AsyncStorage.setItem(STORAGE_KEYS.CACHED_ASSETS, JSON.stringify(assets));
            }
        } catch (error) {
            console.error('Error refreshing cached assets:', error);
        }
    }

    async getCachedAssets() {
        const cached = await AsyncStorage.getItem(STORAGE_KEYS.CACHED_ASSETS);
        return cached ? JSON.parse(cached) : [];
    }

    async addToOfflineQueue(data) {
        const queue = await this.getOfflineQueue();
        queue.push({
            id: Date.now(),
            data: data,
            savedAt: new Date().toISOString()
        });
        await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_QUEUE, JSON.stringify(queue));
        this.notifyListeners('queued', queue.length);
        return queue.length;
    }

    async getOfflineQueue() {
        const queue = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
        return queue ? JSON.parse(queue) : [];
    }

    async getQueueCount() {
        const queue = await this.getOfflineQueue();
        return queue.length;
    }

    async submitData(endpoint, data) {
        await this.testConnection();
        
        if (this.isOnline && this.currentServerUrl) {
            try {
                const formData = new FormData();
                Object.keys(data).forEach(key => {
                    if (key === 'photo_uri' && data[key]) {
                        formData.append('photo', {
                            uri: data[key],
                            name: 'photo.jpg',
                            type: 'image/jpeg'
                        });
                    } else {
                        formData.append(key, String(data[key]));
                    }
                });
                
                const response = await fetch(`${this.currentServerUrl}${endpoint}`, {
                    method: 'POST',
                    body: formData,
                    headers: { 'Content-Type': 'multipart/form-data' }
                });
                
                if (response.ok) {
                    const result = await response.json();
                    this.notifyListeners('submitted', data);
                    await this.refreshCachedAssets();
                    return { success: true, online: true, data: result };
                } else {
                    throw new Error('Server error');
                }
            } catch (error) {
                const queueLength = await this.addToOfflineQueue(data);
                return { success: true, online: false, queued: true, queueLength };
            }
        } else {
            const queueLength = await this.addToOfflineQueue(data);
            return { success: true, online: false, queued: true, queueLength };
        }
    }

    getServerUrl() {
        return this.currentServerUrl;
    }

    isConnected() {
        return this.isOnline && this.currentServerUrl !== null;
    }

    async setServerUrl(url) {
        if (await this.testConnection(url)) {
            this.currentServerUrl = url;
            await AsyncStorage.setItem(STORAGE_KEYS.SERVER_URL, url);
            await AsyncStorage.setItem(STORAGE_KEYS.LAST_KNOWN_URL, url);
            this.isOnline = true;
            this.notifyListeners('server_changed', url);
            this.notifyListeners('connection_change', true);
            return true;
        }
        return false;
    }

    addListener(callback) {
        this.listeners.push(callback);
    }

    removeListener(callback) {
        const index = this.listeners.indexOf(callback);
        if (index > -1) this.listeners.splice(index, 1);
    }

    notifyListeners(event, data) {
        this.listeners.forEach(listener => {
            try {
                listener(event, data);
            } catch (error) {
                console.error('Listener error:', error);
            }
        });
    }

    async clearAllData() {
        await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
        await AsyncStorage.removeItem(STORAGE_KEYS.CACHED_ASSETS);
        await AsyncStorage.removeItem(STORAGE_KEYS.LAST_KNOWN_URL);
        await AsyncStorage.removeItem(STORAGE_KEYS.SERVER_URL);
        this.currentServerUrl = null;
        this.isOnline = false;
        this.notifyListeners('data_cleared', null);
    }
}

export default new NetworkManager();