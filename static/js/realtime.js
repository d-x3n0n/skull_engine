/**
 * Professional SOC Dashboard - Real-time Manager
 * Handles real-time data updates and WebSocket connections
 */

class RealTimeManager {
    constructor() {
        this.config = {
            refreshInterval: 30000, // 30 seconds
            enableWebSockets: false,
            webSocketUrl: null,
            maxRetries: 3,
            retryDelay: 5000
        };
        
        this.state = {
            isConnected: false,
            isUpdating: false,
            lastUpdate: null,
            retryCount: 0,
            webSocket: null,
            updateInterval: null
        };
        
        this.init();
    }

    init() {
        this.initializeRealTimeUpdates();
        this.setupConnectionMonitoring();
    }

    /**
     * Initialize real-time updates
     */
    initializeRealTimeUpdates() {
        if (this.config.enableWebSockets && this.config.webSocketUrl) {
            this.initializeWebSocket();
        } else {
            this.startPolling();
        }
    }

    /**
     * Initialize WebSocket connection
     */
    initializeWebSocket() {
        try {
            this.state.webSocket = new WebSocket(this.config.webSocketUrl);
            
            this.state.webSocket.onopen = () => {
                console.log('WebSocket connected');
                this.state.isConnected = true;
                this.state.retryCount = 0;
                this.updateConnectionStatus('connected');
            };
            
            this.state.webSocket.onmessage = (event) => {
                this.handleRealTimeData(JSON.parse(event.data));
            };
            
            this.state.webSocket.onclose = () => {
                console.log('WebSocket disconnected');
                this.state.isConnected = false;
                this.updateConnectionStatus('disconnected');
                this.handleReconnection();
            };
            
            this.state.webSocket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.state.isConnected = false;
                this.updateConnectionStatus('error');
            };
            
        } catch (error) {
            console.error('Failed to initialize WebSocket:', error);
            this.fallbackToPolling();
        }
    }

    /**
     * Start polling for updates
     */
    startPolling() {
        this.state.updateInterval = setInterval(() => {
            this.fetchUpdates();
        }, this.config.refreshInterval);
        
        // Initial fetch
        this.fetchUpdates();
    }

    /**
     * Fetch updates from server
     */
    async fetchUpdates() {
        if (this.state.isUpdating) {
            console.log('Update already in progress, skipping...');
            return;
        }

        this.state.isUpdating = true;
        
        try {
            const response = await fetch('/api/dashboard-data', {
                headers: {
                    'Cache-Control': 'no-cache',
                    'Pragma': 'no-cache'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.handleRealTimeData(data);
            this.state.lastUpdate = new Date();
            this.state.retryCount = 0;
            
        } catch (error) {
            console.error('Failed to fetch updates:', error);
            this.state.retryCount++;
            this.handleUpdateError(error);
        } finally {
            this.state.isUpdating = false;
        }
    }

    /**
     * Handle real-time data updates
     */
    handleRealTimeData(data) {
        if (!window.dashboard) {
            console.warn('Dashboard not initialized, skipping update');
            return;
        }

        // Update dashboard state
        window.dashboard.state.alerts = data.alerts || [];
        window.dashboard.state.lastUpdate = new Date();
        
        // Update UI components
        window.dashboard.updateSummaryCards(data.summary);
        
        if (window.chartManager) {
            window.chartManager.updateAllCharts(data.charts);
        }
        
        if (window.filtersManager) {
            window.filtersManager.updateAgentFilter(data.alerts);
            window.filtersManager.applyFilters();
        }
        
        window.dashboard.updateThreatIndicators(data.threat_indicators);
        window.dashboard.updateLastRefreshTime();
        
        // Show update notification for significant changes
        this.showUpdateNotification(data);
    }

    /**
     * Show update notification
     */
    showUpdateNotification(data) {
        const previousAlertCount = window.dashboard.state.alerts.length;
        const newAlertCount = data.alerts ? data.alerts.length : 0;
        
        if (newAlertCount > previousAlertCount) {
            const newAlerts = newAlertCount - previousAlertCount;
            this.createNotification(`${newAlerts} new alert(s) detected`, 'info');
        }
        
        // Check for critical alerts
        const criticalAlerts = data.alerts ? data.alerts.filter(alert => alert.severity >= 12) : [];
        if (criticalAlerts.length > 0) {
            this.createNotification(`${criticalAlerts.length} critical alert(s) require attention`, 'critical');
        }
    }

    /**
     * Create notification
     */
    createNotification(message, type = 'info') {
        // Check if notification already exists
        const existingNotification = document.querySelector('.real-time-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.className = `real-time-notification notification-${type}`;
        
        const icons = {
            info: 'fas fa-info-circle',
            warning: 'fas fa-exclamation-triangle',
            critical: 'fas fa-skull-crossbones',
            success: 'fas fa-check-circle'
        };
        
        notification.innerHTML = `
            <div class="notification-content">
                <i class="${icons[type] || icons.info}"></i>
                <span>${message}</span>
                <button class="notification-close">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${this.getNotificationColor(type)};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3);
            z-index: 10000;
            max-width: 400px;
            animation: slideInRight 0.3s ease-out;
        `;
        
        notification.querySelector('.notification-content').style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.75rem;
        `;
        
        notification.querySelector('.notification-close').style.cssText = `
            background: none;
            border: none;
            color: white;
            cursor: pointer;
            padding: 0.25rem;
            border-radius: 4px;
            margin-left: auto;
        `;
        
        notification.querySelector('.notification-close').addEventListener('click', () => {
            notification.remove();
        });
        
        document.body.appendChild(notification);
        
        // Auto-remove after 5 seconds for non-critical notifications
        if (type !== 'critical') {
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.remove();
                }
            }, 5000);
        }
    }

    /**
     * Get notification color by type
     */
    getNotificationColor(type) {
        const colors = {
            info: '#3b82f6',
            warning: '#f59e0b',
            critical: '#dc2626',
            success: '#10b981'
        };
        return colors[type] || colors.info;
    }

    /**
     * Handle update errors
     */
    handleUpdateError(error) {
        console.error('Update error:', error);
        
        if (this.state.retryCount >= this.config.maxRetries) {
            this.createNotification('Failed to update data. Please check your connection.', 'warning');
            this.pauseUpdates();
        } else {
            const delay = this.config.retryDelay * this.state.retryCount;
            console.log(`Retrying in ${delay}ms... (attempt ${this.state.retryCount + 1})`);
            
            setTimeout(() => {
                this.fetchUpdates();
            }, delay);
        }
    }

    /**
     * Handle reconnection
     */
    handleReconnection() {
        if (this.state.retryCount < this.config.maxRetries) {
            const delay = this.config.retryDelay * (this.state.retryCount + 1);
            console.log(`Attempting to reconnect in ${delay}ms...`);
            
            setTimeout(() => {
                this.initializeWebSocket();
                this.state.retryCount++;
            }, delay);
        } else {
            this.fallbackToPolling();
        }
    }

    /**
     * Fallback to polling
     */
    fallbackToPolling() {
        console.log('Falling back to polling updates');
        this.createNotification('Using polling for updates', 'info');
        this.startPolling();
    }

    /**
     * Pause updates
     */
    pauseUpdates() {
        if (this.state.updateInterval) {
            clearInterval(this.state.updateInterval);
            this.state.updateInterval = null;
        }
        
        if (this.state.webSocket) {
            this.state.webSocket.close();
            this.state.webSocket = null;
        }
        
        this.createNotification('Updates paused due to connection issues', 'warning');
    }

    /**
     * Resume updates
     */
    resumeUpdates() {
        this.state.retryCount = 0;
        this.initializeRealTimeUpdates();
        this.createNotification('Updates resumed', 'success');
    }

    /**
     * Update connection status display
     */
    updateConnectionStatus(status) {
        const statusElement = document.querySelector('.system-status');
        if (!statusElement) return;
        
        const indicator = statusElement.querySelector('.status-indicator');
        const text = statusElement.querySelector('.status-text');
        
        indicator.className = 'status-indicator';
        indicator.classList.add(status);
        
        const statusText = {
            connected: 'System Online',
            disconnected: 'System Offline',
            error: 'Connection Error',
            updating: 'Updating...'
        };
        
        text.textContent = statusText[status] || 'Unknown';
    }

    /**
     * Setup connection monitoring
     */
    setupConnectionMonitoring() {
        // Monitor online/offline status
        window.addEventListener('online', () => {
            this.createNotification('Connection restored', 'success');
            this.resumeUpdates();
        });
        
        window.addEventListener('offline', () => {
            this.createNotification('Connection lost', 'warning');
            this.updateConnectionStatus('disconnected');
        });
        
        // Monitor page visibility
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Page is hidden, reduce update frequency
                this.adjustUpdateFrequency('hidden');
            } else {
                // Page is visible, restore normal update frequency
                this.adjustUpdateFrequency('visible');
            }
        });
    }

    /**
     * Adjust update frequency based on page visibility
     */
    adjustUpdateFrequency(state) {
        if (state === 'hidden') {
            // Slow down updates when page is not visible
            if (this.state.updateInterval) {
                clearInterval(this.state.updateInterval);
                this.state.updateInterval = setInterval(() => {
                    this.fetchUpdates();
                }, this.config.refreshInterval * 3); // Update every 90 seconds
            }
        } else {
            // Restore normal update frequency
            if (this.state.updateInterval) {
                clearInterval(this.state.updateInterval);
                this.state.updateInterval = setInterval(() => {
                    this.fetchUpdates();
                }, this.config.refreshInterval);
            }
        }
    }

    /**
     * Get connection statistics
     */
    getConnectionStats() {
        return {
            isConnected: this.state.isConnected,
            lastUpdate: this.state.lastUpdate,
            retryCount: this.state.retryCount,
            updateMethod: this.config.enableWebSockets ? 'WebSocket' : 'Polling',
            refreshInterval: this.config.refreshInterval
        };
    }

    /**
     * Manual refresh trigger
     */
    manualRefresh() {
        this.createNotification('Manual refresh triggered', 'info');
        this.fetchUpdates();
    }

    /**
     * Change update interval
     */
    setUpdateInterval(interval) {
        this.config.refreshInterval = interval;
        
        if (this.state.updateInterval) {
            clearInterval(this.state.updateInterval);
            this.startPolling();
        }
        
        this.createNotification(`Update interval set to ${interval / 1000} seconds`, 'info');
    }

    /**
     * Cleanup resources
     */
    destroy() {
        if (this.state.updateInterval) {
            clearInterval(this.state.updateInterval);
        }
        
        if (this.state.webSocket) {
            this.state.webSocket.close();
        }
    }
}

// Add CSS animation for notifications
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .status-indicator.connected {
        background: #10b981;
        animation: pulse 2s infinite;
    }
    
    .status-indicator.disconnected {
        background: #ef4444;
    }
    
    .status-indicator.error {
        background: #f59e0b;
    }
    
    .status-indicator.updating {
        background: #3b82f6;
        animation: pulse 1s infinite;
    }
    
    @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }
`;
document.head.appendChild(style);

// Initialize real-time manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.realTimeManager = new RealTimeManager();
});
