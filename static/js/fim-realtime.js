// FIM Real-time Updates
class FIMRealTime {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.updateInterval = 30000; // 30 seconds
        this.isUpdating = false;
        this.startRealTimeUpdates();
    }

    startRealTimeUpdates() {
        // Start periodic updates
        setInterval(() => {
            this.updateFIMData();
        }, this.updateInterval);

        // Also update when page becomes visible
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                this.updateFIMData();
            }
        });
    }

    async updateFIMData() {
        if (this.isUpdating) return;
        
        this.isUpdating = true;
        try {
            await this.dashboard.loadFIMData();
        } catch (error) {
            console.error('Real-time update failed:', error);
        } finally {
            this.isUpdating = false;
        }
    }

    // Method to handle WebSocket messages (if implemented in future)
    handleWebSocketMessage(data) {
        if (data.type === 'fim_update') {
            this.dashboard.loadFIMData();
        }
    }
}
