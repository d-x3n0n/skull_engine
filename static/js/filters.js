/**
 * Professional SOC Dashboard - Filters Manager
 * Handles advanced filtering and data manipulation
 */

class FiltersManager {
    constructor() {
        this.filters = {
            search: '',
            severity: '',
            agent: '',
            timeRange: '24',
            dateRange: {
                start: null,
                end: null
            }
        };
        
        this.availableAgents = new Set();
        this.init();
    }

    init() {
        this.initializeFilterEvents();
    }

    /**
     * Initialize filter event listeners
     */
    initializeFilterEvents() {
        // Time range filter change
        document.getElementById('timeRangeFilter').addEventListener('change', (e) => {
            this.filters.timeRange = e.target.value;
            this.handleTimeRangeChange();
            this.applyFilters();
        });

        // Custom date range inputs
        document.getElementById('startDate').addEventListener('change', (e) => {
            this.filters.dateRange.start = e.target.value;
            this.applyFilters();
        });

        document.getElementById('endDate').addEventListener('change', (e) => {
            this.filters.dateRange.end = e.target.value;
            this.applyFilters();
        });

        // Search input with debounce
        document.getElementById('searchInput').addEventListener('input', debounce((e) => {
            this.filters.search = e.target.value.toLowerCase().trim();
            this.applyFilters();
        }, 300));

        // Severity filter
        document.getElementById('severityFilter').addEventListener('change', (e) => {
            this.filters.severity = e.target.value;
            this.applyFilters();
        });

        // Agent filter
        document.getElementById('agentFilter').addEventListener('change', (e) => {
            this.filters.agent = e.target.value;
            this.applyFilters();
        });
    }

    /**
     * Handle time range filter changes
     */
    handleTimeRangeChange() {
        const customRange = document.getElementById('customDateRange');
        
        if (this.filters.timeRange === 'custom') {
            customRange.style.display = 'flex';
            // Set default dates for custom range
            const now = new Date();
            const yesterday = new Date(now.getTime() - (24 * 60 * 60 * 1000));
            
            document.getElementById('startDate').value = this.formatDateForInput(yesterday);
            document.getElementById('endDate').value = this.formatDateForInput(now);
            
            this.filters.dateRange.start = this.formatDateForInput(yesterday);
            this.filters.dateRange.end = this.formatDateForInput(now);
        } else {
            customRange.style.display = 'none';
            this.filters.dateRange.start = null;
            this.filters.dateRange.end = null;
        }
    }

    /**
     * Apply all active filters to data
     */
    applyFilters() {
        if (!window.dashboard || !window.dashboard.state) {
            console.warn('Dashboard not initialized');
            return;
        }

        const { alerts } = window.dashboard.state;
        let filtered = [...alerts];

        // Apply search filter
        if (this.filters.search) {
            filtered = filtered.filter(alert => 
                alert.rule_description.toLowerCase().includes(this.filters.search) ||
                alert.agent_name.toLowerCase().includes(this.filters.search) ||
                alert.rule_id.toLowerCase().includes(this.filters.search) ||
                alert.groups.some(group => group.toLowerCase().includes(this.filters.search)) ||
                (alert.mitre_tactics && alert.mitre_tactics.some(tactic => 
                    tactic.toLowerCase().includes(this.filters.search)
                ))
            );
        }

        // Apply severity filter
        if (this.filters.severity) {
            const minSeverity = parseInt(this.filters.severity);
            filtered = filtered.filter(alert => alert.severity >= minSeverity);
        }

        // Apply agent filter
        if (this.filters.agent) {
            filtered = filtered.filter(alert => alert.agent_name === this.filters.agent);
        }

        // Apply time range filter (for real-time updates)
        if (this.filters.timeRange !== 'custom') {
            const hours = parseInt(this.filters.timeRange);
            const cutoffTime = new Date(Date.now() - (hours * 60 * 60 * 1000));
            
            filtered = filtered.filter(alert => {
                const alertTime = new Date(alert.timestamp);
                return alertTime >= cutoffTime;
            });
        }

        // Update dashboard state
        window.dashboard.state.filteredAlerts = filtered;
        window.dashboard.state.currentPage = 1;
        
        // Update UI
        window.dashboard.updateAlertsTable();
        window.dashboard.updatePagination();
        
        // Update filter counts
        this.updateFilterStats();
    }

    /**
     * Update agent filter options
     */
    updateAgentFilter(agents) {
        if (!agents || !Array.isArray(agents)) return;

        // Update available agents set
        agents.forEach(alert => {
            if (alert.agent_name && alert.agent_name !== 'Unknown') {
                this.availableAgents.add(alert.agent_name);
            }
        });

        // Update agent filter dropdown
        const agentFilter = document.getElementById('agentFilter');
        const currentValue = agentFilter.value;
        
        // Clear existing options (keep "All Agents")
        while (agentFilter.options.length > 1) {
            agentFilter.remove(1);
        }

        // Add sorted agent options
        const sortedAgents = Array.from(this.availableAgents).sort();
        sortedAgents.forEach(agent => {
            const option = document.createElement('option');
            option.value = agent;
            option.textContent = agent;
            agentFilter.appendChild(option);
        });

        // Restore previous selection if still valid
        if (currentValue && this.availableAgents.has(currentValue)) {
            agentFilter.value = currentValue;
        }
    }

    /**
     * Update filter statistics
     */
    updateFilterStats() {
        const totalAlerts = window.dashboard.state.alerts.length;
        const filteredAlerts = window.dashboard.state.filteredAlerts.length;
        
        // Show filter status
        this.showFilterStatus(totalAlerts, filteredAlerts);
    }

    /**
     * Show filter status
     */
    showFilterStatus(total, filtered) {
        const statusElement = document.getElementById('paginationInfo');
        if (!statusElement) return;

        if (total === filtered) {
            statusElement.textContent = `Showing ${filtered.toLocaleString()} alerts`;
        } else {
            statusElement.textContent = `Showing ${filtered.toLocaleString()} of ${total.toLocaleString()} alerts (filtered)`;
        }
    }

    /**
     * Clear all filters
     */
    clearAllFilters() {
        this.filters = {
            search: '',
            severity: '',
            agent: '',
            timeRange: '24',
            dateRange: {
                start: null,
                end: null
            }
        };

        // Reset UI elements
        document.getElementById('searchInput').value = '';
        document.getElementById('severityFilter').value = '';
        document.getElementById('agentFilter').value = '';
        document.getElementById('timeRangeFilter').value = '24';
        
        // Hide custom date range
        document.getElementById('customDateRange').style.display = 'none';

        // Reapply filters (which will now be clear)
        this.applyFilters();
    }

    /**
     * Get active filters for API calls
     */
    getApiFilters() {
        const apiFilters = {};
        
        if (this.filters.severity) {
            apiFilters.severity = this.filters.severity;
        }
        
        if (this.filters.agent) {
            apiFilters.agent = this.filters.agent;
        }
        
        if (this.filters.search) {
            apiFilters.search = this.filters.search;
        }

        return apiFilters;
    }

    /**
     * Check if any filters are active
     */
    hasActiveFilters() {
        return (
            this.filters.search !== '' ||
            this.filters.severity !== '' ||
            this.filters.agent !== '' ||
            this.filters.timeRange !== '24'
        );
    }

    /**
     * Get filter summary for display
     */
    getFilterSummary() {
        const summary = [];
        
        if (this.filters.search) {
            summary.push(`Search: "${this.filters.search}"`);
        }
        
        if (this.filters.severity) {
            const severityMap = {
                '12': 'Critical',
                '8': 'High',
                '4': 'Medium',
                '1': 'Low'
            };
            summary.push(`Severity: ${severityMap[this.filters.severity] || `Level ${this.filters.severity}+`}`);
        }
        
        if (this.filters.agent) {
            summary.push(`Agent: ${this.filters.agent}`);
        }
        
        if (this.filters.timeRange !== '24') {
            const timeMap = {
                '1': '1 Hour',
                '6': '6 Hours',
                '168': '7 Days',
                'custom': 'Custom Range'
            };
            summary.push(`Time: ${timeMap[this.filters.timeRange] || `${this.filters.timeRange} Hours`}`);
        }

        return summary.length > 0 ? summary.join(' • ') : 'No filters active';
    }

    /**
     * Format date for datetime-local input
     */
    formatDateForInput(date) {
        return date.toISOString().slice(0, 16);
    }

    /**
     * Parse date from datetime-local input
     */
    parseDateFromInput(dateString) {
        return new Date(dateString);
    }

    /**
     * Validate date range
     */
    validateDateRange(start, end) {
        if (!start || !end) return false;
        
        const startDate = this.parseDateFromInput(start);
        const endDate = this.parseDateFromInput(end);
        
        return startDate < endDate;
    }

    /**
     * Export current filter configuration
     */
    exportFilters() {
        const filterConfig = {
            ...this.filters,
            timestamp: new Date().toISOString(),
            totalAlerts: window.dashboard.state.alerts.length,
            filteredAlerts: window.dashboard.state.filteredAlerts.length
        };
        
        const dataStr = JSON.stringify(filterConfig, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `soc-filters-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        
        URL.revokeObjectURL(link.href);
    }

    /**
     * Import filter configuration
     */
    importFilters(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const config = JSON.parse(e.target.result);
                
                // Apply imported filters
                this.filters = { ...this.filters, ...config };
                
                // Update UI
                document.getElementById('searchInput').value = this.filters.search || '';
                document.getElementById('severityFilter').value = this.filters.severity || '';
                document.getElementById('agentFilter').value = this.filters.agent || '';
                document.getElementById('timeRangeFilter').value = this.filters.timeRange || '24';
                
                if (this.filters.timeRange === 'custom') {
                    this.handleTimeRangeChange();
                }
                
                // Apply filters
                this.applyFilters();
                
                // Show success message
                this.showMessage('Filters imported successfully', 'success');
                
            } catch (error) {
                this.showMessage('Failed to import filters: ' + error.message, 'error');
            }
        };
        
        reader.readAsText(file);
    }

    /**
     * Show message to user
     */
    showMessage(message, type = 'info') {
        // Create message element
        const messageEl = document.createElement('div');
        messageEl.className = `filter-message filter-message-${type}`;
        messageEl.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;
        
        // Add styles
        messageEl.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#3b82f6'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            z-index: 10001;
            display: flex;
            align-items: center;
            gap: 1rem;
            max-width: 400px;
        `;
        
        messageEl.querySelector('button').style.cssText = `
            background: none;
            border: none;
            color: white;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 0;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
        `;
        
        document.body.appendChild(messageEl);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (messageEl.parentElement) {
                messageEl.remove();
            }
        }, 5000);
    }
}

// Initialize filters manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.filtersManager = new FiltersManager();
});
