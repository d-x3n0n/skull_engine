/**
 * Professional SOC Dashboard - Main Application
 * Enterprise-grade Security Operations Center Dashboard
 */

class ProfessionalSOCDashboard {
    constructor() {
        this.config = {
            refreshInterval: 30000, // 30 seconds
            apiBaseUrl: '/api',
            maxAlerts: 5000,
            enableRealtime: true
        };
        
        this.state = {
            alerts: [],
            filteredAlerts: [],
            currentPage: 1,
            itemsPerPage: 25,
            totalPages: 1,
            currentFilters: {
                search: '',
                severity: '',
                agent: '',
                timeRange: '24'
            },
            sortConfig: {
                key: 'timestamp',
                direction: 'desc'
            },
            charts: {},
            lastUpdate: null,
            isLoading: false
        };
        
        this.init();
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        try {
            this.showLoading(true);
            
            // Initialize components
            this.initializeEventListeners();
            this.initializeCharts();
            this.initializeFilters();
            
            // Load initial data
            await this.loadDashboardData();
            
            // Start real-time updates
            if (this.config.enableRealtime) {
                this.startRealTimeUpdates();
            }
            
            this.updateLastRefreshTime();
            
        } catch (error) {
            this.showError('Failed to initialize dashboard: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Initialize event listeners
     */
    initializeEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadDashboardData();
        });

        // Time range filter
        document.getElementById('timeRangeFilter').addEventListener('change', (e) => {
            this.state.currentFilters.timeRange = e.target.value;
            this.toggleCustomDateRange();
            this.loadDashboardData();
        });

        // Search input
        document.getElementById('searchInput').addEventListener('input', debounce((e) => {
            this.state.currentFilters.search = e.target.value.toLowerCase();
            this.applyFilters();
        }, 300));

        // Severity filter
        document.getElementById('severityFilter').addEventListener('change', (e) => {
            this.state.currentFilters.severity = e.target.value;
            this.applyFilters();
        });

        // Agent filter
        document.getElementById('agentFilter').addEventListener('change', (e) => {
            this.state.currentFilters.agent = e.target.value;
            this.applyFilters();
        });

        // Table sorting
        this.initializeTableSorting();

        // Pagination
        this.initializePagination();

        // Modal
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportAlerts();
        });

        // Settings button
        document.getElementById('settingsBtn').addEventListener('click', () => {
            this.showSettings();
        });

        // Close modal on overlay click
        document.getElementById('alertModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });
    }

    /**
     * Initialize table sorting
     */
    initializeTableSorting() {
        const headers = document.querySelectorAll('.alerts-table th[data-sort]');
        headers.forEach(header => {
            header.style.cursor = 'pointer';
            header.addEventListener('click', () => {
                const sortKey = header.getAttribute('data-sort');
                this.sortTable(sortKey, header);
            });
        });
    }

    /**
     * Initialize pagination
     */
    initializePagination() {
        document.getElementById('firstPage').addEventListener('click', () => {
            this.goToPage(1);
        });

        document.getElementById('prevPage').addEventListener('click', () => {
            this.goToPage(this.state.currentPage - 1);
        });

        document.getElementById('nextPage').addEventListener('click', () => {
            this.goToPage(this.state.currentPage + 1);
        });

        document.getElementById('lastPage').addEventListener('click', () => {
            this.goToPage(this.state.totalPages);
        });
    }

    /**
     * Toggle custom date range visibility
     */
    toggleCustomDateRange() {
        const customRange = document.getElementById('customDateRange');
        if (this.state.currentFilters.timeRange === 'custom') {
            customRange.style.display = 'flex';
        } else {
            customRange.style.display = 'none';
        }
    }

    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        try {
            this.showLoading(true);
            
            const timeRange = this.state.currentFilters.timeRange;
            let url = `${this.config.apiBaseUrl}/dashboard-data?time_range=${timeRange}`;
            
            if (timeRange === 'custom') {
                const startDate = document.getElementById('startDate').value;
                const endDate = document.getElementById('endDate').value;
                if (startDate && endDate) {
                    url += `&start_time=${startDate}&end_time=${endDate}`;
                }
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            this.state.alerts = data.alerts || [];
            this.state.lastUpdate = new Date();
            
            // Update all dashboard components
            this.updateSummaryCards(data.summary);
            this.updateCharts(data.charts);
            this.updateThreatIndicators(data.threat_indicators);
            this.applyFilters();
            
            this.updateLastRefreshTime();
            
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
            this.showError('Failed to load data: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Apply filters to alerts
     */
    applyFilters() {
        let filtered = this.state.alerts.filter(alert => {
            // Search filter
            const matchesSearch = !this.state.currentFilters.search || 
                alert.rule_description.toLowerCase().includes(this.state.currentFilters.search) ||
                alert.agent_name.toLowerCase().includes(this.state.currentFilters.search) ||
                alert.rule_id.toLowerCase().includes(this.state.currentFilters.search);
            
            // Severity filter
            const matchesSeverity = !this.state.currentFilters.severity || 
                alert.severity >= parseInt(this.state.currentFilters.severity);
            
            // Agent filter
            const matchesAgent = !this.state.currentFilters.agent || 
                alert.agent_name === this.state.currentFilters.agent;
            
            return matchesSearch && matchesSeverity && matchesAgent;
        });
        
        // Apply sorting
        filtered = this.sortAlerts(filtered, this.state.sortConfig.key, this.state.sortConfig.direction);
        
        this.state.filteredAlerts = filtered;
        this.state.currentPage = 1;
        this.updateAlertsTable();
        this.updatePagination();
    }

    /**
     * Sort alerts array
     */
    sortAlerts(alerts, key, direction) {
        return alerts.sort((a, b) => {
            let aValue = a[key];
            let bValue = b[key];
            
            // Handle different data types
            if (key === 'timestamp') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            } else if (key === 'severity') {
                aValue = parseInt(aValue);
                bValue = parseInt(bValue);
            }
            
            if (aValue < bValue) return direction === 'asc' ? -1 : 1;
            if (aValue > bValue) return direction === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * Sort table
     */
    sortTable(key, header) {
        // Remove existing sort classes
        document.querySelectorAll('.alerts-table th[data-sort]').forEach(h => {
            h.classList.remove('sort-asc', 'sort-desc');
        });
        
        // Toggle direction or set new sort
        if (this.state.sortConfig.key === key) {
            this.state.sortConfig.direction = this.state.sortConfig.direction === 'asc' ? 'desc' : 'asc';
        } else {
            this.state.sortConfig.key = key;
            this.state.sortConfig.direction = 'desc';
        }
        
        // Add sort class to header
        header.classList.add(`sort-${this.state.sortConfig.direction}`);
        
        // Apply sorting
        this.applyFilters();
    }

    /**
     * Update alerts table
     */
    updateAlertsTable() {
        const tbody = document.getElementById('alertsTableBody');
        const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const endIndex = startIndex + this.state.itemsPerPage;
        const pageAlerts = this.state.filteredAlerts.slice(startIndex, endIndex);
        
        tbody.innerHTML = '';

        if (pageAlerts.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center" style="padding: 3rem;">
                        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <div>No alerts found matching your criteria</div>
                    </td>
                </tr>
            `;
            return;
        }

        pageAlerts.forEach(alert => {
            const row = this.createAlertRow(alert);
            tbody.appendChild(row);
        });
    }

    /**
     * Create alert table row
     */
    createAlertRow(alert) {
        const row = document.createElement('tr');
        row.className = `priority-${this.getSeverityLevel(alert.severity)}`;
        
        const severityClass = this.getSeverityClass(alert.severity);
        const timestamp = new Date(alert.timestamp).toLocaleString();
        
        row.innerHTML = `
            <td class="font-mono" style="font-size: 0.75rem;">${timestamp}</td>
            <td>
                <span class="severity-badge ${severityClass}">
                    Level ${alert.severity}
                </span>
            </td>
            <td>
                <div class="font-medium">${alert.agent_name}</div>
                <div class="text-secondary" style="font-size: 0.75rem;">${alert.agent_ip}</div>
            </td>
            <td>
                <div class="font-medium">${alert.rule_description}</div>
                <div class="text-secondary" style="font-size: 0.75rem;">Groups: ${alert.groups.join(', ')}</div>
            </td>
            <td class="font-mono" style="font-size: 0.75rem;">${alert.rule_id}</td>
            <td>
                ${alert.mitre_tactics?.length ? 
                    alert.mitre_tactics.slice(0, 2).map(tactic => 
                        `<span class="mitre-tag">${tactic}</span>`
                    ).join('') : 
                    '<span class="text-secondary">N/A</span>'
                }
                ${alert.mitre_tactics?.length > 2 ? 
                    `<span class="text-secondary" style="font-size: 0.75rem;">+${alert.mitre_tactics.length - 2} more</span>` : 
                    ''
                }
            </td>
            <td>
                <button class="btn btn-outline" onclick="dashboard.showAlertDetails('${alert.id}')" style="padding: 0.5rem; font-size: 0.75rem;">
                    <i class="fas fa-search"></i>
                    Details
                </button>
            </td>
        `;
        
        return row;
    }

    /**
     * Update pagination
     */
    updatePagination() {
        const totalItems = this.state.filteredAlerts.length;
        this.state.totalPages = Math.ceil(totalItems / this.state.itemsPerPage);
        
        // Update pagination info
        document.getElementById('paginationInfo').textContent = 
            `Showing ${Math.min(this.state.itemsPerPage, totalItems)} of ${totalItems} alerts`;
        
        document.getElementById('tablePaginationInfo').textContent = 
            `Page ${this.state.currentPage} of ${this.state.totalPages}`;
        
        // Update button states
        document.getElementById('firstPage').disabled = this.state.currentPage === 1;
        document.getElementById('prevPage').disabled = this.state.currentPage === 1;
        document.getElementById('nextPage').disabled = this.state.currentPage === this.state.totalPages;
        document.getElementById('lastPage').disabled = this.state.currentPage === this.state.totalPages;
        
        // Update page numbers
        this.updatePageNumbers();
    }

    /**
     * Update page number buttons
     */
    updatePageNumbers() {
        const container = document.getElementById('pageNumbers');
        container.innerHTML = '';
        
        const maxPages = 5;
        let startPage = Math.max(1, this.state.currentPage - Math.floor(maxPages / 2));
        let endPage = Math.min(this.state.totalPages, startPage + maxPages - 1);
        
        if (endPage - startPage + 1 < maxPages) {
            startPage = Math.max(1, endPage - maxPages + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            const button = document.createElement('button');
            button.className = `pagination-btn ${i === this.state.currentPage ? 'active' : ''}`;
            button.textContent = i;
            button.addEventListener('click', () => this.goToPage(i));
            container.appendChild(button);
        }
    }

    /**
     * Go to specific page
     */
    goToPage(page) {
        if (page >= 1 && page <= this.state.totalPages) {
            this.state.currentPage = page;
            this.updateAlertsTable();
            this.updatePagination();
        }
    }

    /**
     * Show alert details modal
     */
    async showAlertDetails(alertId) {
        try {
            const alert = this.state.alerts.find(a => a.id === alertId);
            if (!alert) {
                throw new Error('Alert not found');
            }
            
            const modal = document.getElementById('alertModal');
            const content = document.getElementById('modalContent');
            
            content.innerHTML = this.createAlertDetailContent(alert);
            modal.classList.remove('hidden');
            
        } catch (error) {
            this.showError('Failed to load alert details: ' + error.message);
        }
    }

    /**
     * Create alert detail content
     */
    createAlertDetailContent(alert) {
        const severityClass = this.getSeverityClass(alert.severity);
        const timestamp = new Date(alert.timestamp).toLocaleString();
        
        return `
            <div class="alert-detail-grid">
                <div class="detail-card">
                    <h4 class="detail-card-title">Basic Information</h4>
                    <div class="detail-item">
                        <div class="detail-label">Alert ID</div>
                        <div class="detail-value font-mono">${alert.id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Timestamp</div>
                        <div class="detail-value">${timestamp}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Severity</div>
                        <div class="detail-value">
                            <span class="severity-badge ${severityClass}">
                                Level ${alert.severity}
                            </span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Fired Times</div>
                        <div class="detail-value">${alert.fired_times}</div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4 class="detail-card-title">Agent Information</h4>
                    <div class="detail-item">
                        <div class="detail-label">Agent Name</div>
                        <div class="detail-value">${alert.agent_name}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Agent IP</div>
                        <div class="detail-value">${alert.agent_ip}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Agent ID</div>
                        <div class="detail-value">${alert.agent_id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Manager</div>
                        <div class="detail-value">${alert.manager}</div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4 class="detail-card-title">Rule Information</h4>
                    <div class="detail-item">
                        <div class="detail-label">Rule ID</div>
                        <div class="detail-value font-mono">${alert.rule_id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Description</div>
                        <div class="detail-value">${alert.rule_description}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Groups</div>
                        <div class="detail-value">${alert.groups.join(', ') || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Location</div>
                        <div class="detail-value">${alert.location}</div>
                    </div>
                </div>
                
                ${alert.mitre_tactics?.length ? `
                <div class="detail-card">
                    <h4 class="detail-card-title">MITRE ATT&CK</h4>
                    <div class="detail-item">
                        <div class="detail-label">Tactics</div>
                        <div class="detail-value">
                            ${alert.mitre_tactics.map(tactic => 
                                `<span class="mitre-tag">${tactic}</span>`
                            ).join('')}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Techniques</div>
                        <div class="detail-value">
                            ${alert.mitre_techniques?.map(tech => 
                                `<span class="mitre-tag" style="background: #7c3aed;">${tech}</span>`
                            ).join('') || 'N/A'}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Technique IDs</div>
                        <div class="detail-value">
                            ${alert.mitre_ids?.map(id => 
                                `<span class="mitre-tag" style="background: #6d28d9;">${id}</span>`
                            ).join('') || 'N/A'}
                        </div>
                    </div>
                </div>
                ` : ''}
            </div>
            
            ${alert.full_log ? `
            <div class="detail-card" style="grid-column: 1 / -1;">
                <h4 class="detail-card-title">Full Log</h4>
                <pre style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: var(--radius-md); overflow-x: auto; font-size: 0.875rem; line-height: 1.4;">${alert.full_log}</pre>
            </div>
            ` : ''}
            
            <div class="detail-card" style="grid-column: 1 / -1;">
                <h4 class="detail-card-title">Raw Data</h4>
                <pre style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: var(--radius-md); overflow-x: auto; font-size: 0.75rem; line-height: 1.4; max-height: 300px;">${JSON.stringify(alert.raw_data, null, 2)}</pre>
            </div>
        `;
    }

    /**
     * Close modal
     */
    closeModal() {
        document.getElementById('alertModal').classList.add('hidden');
    }

    /**
     * Update summary cards
     */
    updateSummaryCards(summary) {
        document.getElementById('totalAlerts').textContent = 
            summary?.total_alerts?.toLocaleString() || '0';
        document.getElementById('criticalAlerts').textContent = 
            summary?.critical_alerts?.toLocaleString() || '0';
        document.getElementById('highSeverity').textContent = 
            summary?.high_severity_alerts?.toLocaleString() || '0';
        document.getElementById('activeAgents').textContent = 
            summary?.unique_agents?.toLocaleString() || '0';
        document.getElementById('mitreCount').textContent = 
            summary?.mitre_techniques_count?.toLocaleString() || '0';
        document.getElementById('activeThreats').textContent = 
            summary?.active_threats?.toLocaleString() || '0';
    }

    /**
     * Update charts
     */
    updateCharts(chartsData) {
        if (window.chartManager) {
            window.chartManager.updateAllCharts(chartsData);
        }
    }

    /**
     * Update threat indicators
     */
    updateThreatIndicators(indicators) {
        const container = document.getElementById('threatIndicators');
        
        if (!indicators || indicators.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="fas fa-check-circle" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <div>No active threat indicators detected</div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = indicators.map(indicator => `
            <div class="threat-indicator">
                <div class="threat-header">
                    <div class="threat-title">${indicator.description}</div>
                    <span class="severity-badge ${this.getSeverityClass(indicator.severity)}">
                        Level ${indicator.severity}
                    </span>
                </div>
                <div class="threat-body">
                    <div class="threat-info">
                        <span class="threat-agent">Agent: ${indicator.agent}</span>
                        <span class="threat-time">${new Date(indicator.timestamp).toLocaleString()}</span>
                    </div>
                    <div class="threat-mitre">
                        ${indicator.mitre_tactics?.map(tactic => 
                            `<span class="mitre-tag">${tactic}</span>`
                        ).join('')}
                    </div>
                </div>
            </div>
        `).join('');
    }

    /**
     * Start real-time updates
     */
    startRealTimeUpdates() {
        setInterval(() => {
            this.loadDashboardData();
        }, this.config.refreshInterval);
    }

    /**
     * Update last refresh time
     */
    updateLastRefreshTime() {
        const element = document.getElementById('lastUpdate');
        if (element) {
            const now = new Date();
            element.innerHTML = `
                <i class="fas fa-clock"></i>
                <span>Last updated: ${now.toLocaleTimeString()}</span>
            `;
        }
    }

    /**
     * Export alerts
     */
    exportAlerts() {
        const data = this.state.filteredAlerts.length > 0 ? this.state.filteredAlerts : this.state.alerts;
        const csv = this.convertToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `soc-alerts-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    /**
     * Convert data to CSV
     */
    convertToCSV(data) {
        const headers = ['Timestamp', 'Severity', 'Agent', 'Rule ID', 'Description', 'MITRE Tactics'];
        const rows = data.map(alert => [
            alert.timestamp,
            alert.severity,
            alert.agent_name,
            alert.rule_id,
            `"${alert.rule_description.replace(/"/g, '""')}"`,
            alert.mitre_tactics?.join('; ') || ''
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    /**
     * Show settings
     */
    showSettings() {
        // Implement settings modal
        alert('Settings feature coming soon!');
    }

    /**
     * Show loading state
     */
    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (show) {
            overlay.classList.remove('hidden');
        } else {
            overlay.classList.add('hidden');
        }
    }

    /**
     * Show error message
     */
    showError(message) {
        // Create error notification
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <div style="background: var(--danger-color); color: white; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; display: flex; justify-content: between; align-items: center;">
                <div>
                    <i class="fas fa-exclamation-circle"></i>
                    ${message}
                </div>
                <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        const container = document.querySelector('.container');
        container.insertBefore(errorDiv, container.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
    }

    /**
     * Get severity class
     */
    getSeverityClass(severity) {
        if (severity >= 12) return 'severity-critical';
        if (severity >= 8) return 'severity-high';
        if (severity >= 4) return 'severity-medium';
        return 'severity-low';
    }

    /**
     * Get severity level name
     */
    getSeverityLevel(severity) {
        if (severity >= 12) return 'critical';
        if (severity >= 8) return 'high';
        if (severity >= 4) return 'medium';
        return 'low';
    }
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new ProfessionalSOCDashboard();
});
