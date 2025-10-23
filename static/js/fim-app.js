// FIM Dashboard Application
class FIMDashboard {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.currentData = [];
        this.filteredData = [];
        this.sortField = 'timestamp';
        this.sortDirection = 'desc';
        
        this.init();
    }

    init() {
        console.log("🔍 FIM Dashboard initializing...");
        this.bindEvents();
        this.loadFIMData();
        this.startRealTimeUpdates();
    }

    bindEvents() {
        console.log("🔍 Binding FIM events...");
        
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log("🔍 Refresh button clicked");
                this.loadFIMData();
            });
        } else {
            console.error("❌ Refresh button not found");
        }

        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    console.log("🔍 Search filter applied:", e.target.value);
                    this.applyFilters();
                }, 300);
            });
        }

        // Change type filter
        const changeTypeFilter = document.getElementById('changeTypeFilter');
        if (changeTypeFilter) {
            changeTypeFilter.addEventListener('change', (e) => {
                console.log("🔍 Change type filter:", e.target.value);
                this.applyFilters();
            });
        }

        // Agent filter
        const agentFilter = document.getElementById('agentFilter');
        if (agentFilter) {
            agentFilter.addEventListener('change', (e) => {
                console.log("🔍 Agent filter:", e.target.value);
                this.applyFilters();
            });
        }

        // Time range filter
        const timeRangeFilter = document.getElementById('timeRangeFilter');
        if (timeRangeFilter) {
            timeRangeFilter.addEventListener('change', (e) => {
                console.log("🔍 Time range filter:", e.target.value);
                if (e.target.value === 'custom') {
                    document.getElementById('customDateRange').style.display = 'block';
                } else {
                    document.getElementById('customDateRange').style.display = 'none';
                    this.loadFIMData();
                }
            });
        }

        // Pagination
        document.getElementById('firstPage')?.addEventListener('click', () => this.goToPage(1));
        document.getElementById('prevPage')?.addEventListener('click', () => this.goToPage(this.currentPage - 1));
        document.getElementById('nextPage')?.addEventListener('click', () => this.goToPage(this.currentPage + 1));
        document.getElementById('lastPage')?.addEventListener('click', () => this.goToLastPage());

        // Table sorting
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.getAttribute('data-sort');
                console.log("🔍 Sorting by:", field);
                this.sortTable(field);
            });
        });
        
        // Modal close button
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeModal();
            });
        } else {
            console.warn("⚠️ Modal close button not found");
        }

        console.log("✅ FIM events bound successfully");
    }

    async loadFIMData() {
        console.log("🔍 Loading FIM data...");
        this.showLoading();
        
        try {
            const response = await fetch('/api/fim/events');
            console.log("🔍 FIM API response status:", response.status);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('✅ FIM Data loaded:', data);
            console.log('📊 Events count:', data.events?.length || 0);
            console.log('🔧 Data source:', data.data_source);
            
            this.currentData = data.events || [];
            this.updateSummaryMetrics(data.summary || {});
            this.updateAgentFilter();
            this.applyFilters();
            this.updateLastUpdate();
            
            // Initialize charts if available
            if (window.fimCharts) {
                console.log("🔍 Initializing charts...");
                window.fimCharts.initCharts(this.currentData);
            } else {
                console.warn("⚠️ FIM charts not available");
            }
            
        } catch (error) {
            console.error('❌ Error loading FIM data:', error);
            this.showError('Failed to load FIM data: ' + error.message);
            // Fallback to empty data
            this.currentData = [];
            this.updateSummaryMetrics({});
            this.applyFilters();
        } finally {
            this.hideLoading();
        }
    }

    updateSummaryMetrics(summary) {
        console.log("🔍 Updating summary metrics:", summary);
        
        const metrics = {
            'totalFiles': summary.total_files || '0',
            'totalChanges': summary.total_changes || '0',
            'suspiciousChanges': summary.suspicious_changes || '0',
            'monitoredAgents': summary.monitored_agents || '0',
            'integrityScore': summary.integrity_score || '0%',
            'lastScan': summary.last_scan || '0m ago'
        };

        // Update trends
        const trends = {
            'totalFilesTrend': summary.total_files_trend || '+0%',
            'changesTrend': summary.changes_trend || '+0%',
            'suspiciousTrend': summary.suspicious_trend || '+0%',
            'agentsTrend': summary.agents_trend || '+0%',
            'integrityTrend': summary.integrity_trend || '+0%'
        };

        // Update values
        Object.entries(metrics).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = value;
                console.log(`📊 Updated ${key}: ${value}`);
            } else {
                console.warn(`⚠️ Element not found: ${key}`);
            }
        });

        // Update trends
        Object.entries(trends).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = value;
            }
        });
    }

    updateAgentFilter() {
        const agentFilter = document.getElementById('agentFilter');
        if (!agentFilter) {
            console.warn("⚠️ Agent filter element not found");
            return;
        }

        // Get unique agents
        const agents = [...new Set(this.currentData.map(event => event.agent_name))].sort();
        console.log("🔍 Available agents:", agents);
        
        // Save current selection
        const currentValue = agentFilter.value;
        
        // Update options
        agentFilter.innerHTML = '<option value="">All Agents</option>' +
            agents.map(agent => `<option value="${agent}">${agent}</option>`).join('');
        
        // Restore selection if still valid
        if (agents.includes(currentValue)) {
            agentFilter.value = currentValue;
        }
    }

    applyFilters() {
        console.log("🔍 Applying filters...");
        let filtered = [...this.currentData];
        
        // Apply search filter
        const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
        if (searchTerm) {
            filtered = filtered.filter(event => 
                event.filename.toLowerCase().includes(searchTerm) ||
                event.file_path.toLowerCase().includes(searchTerm) ||
                event.user.toLowerCase().includes(searchTerm) ||
                event.agent_name.toLowerCase().includes(searchTerm)
            );
            console.log(`🔍 Search filter "${searchTerm}": ${filtered.length} events`);
        }
        
        // Apply change type filter
        const changeType = document.getElementById('changeTypeFilter')?.value || '';
        if (changeType) {
            filtered = filtered.filter(event => event.change_type === changeType);
            console.log(`🔍 Change type filter "${changeType}": ${filtered.length} events`);
        }
        
        // Apply agent filter
        const agentFilter = document.getElementById('agentFilter')?.value || '';
        if (agentFilter) {
            filtered = filtered.filter(event => event.agent_name === agentFilter);
            console.log(`🔍 Agent filter "${agentFilter}": ${filtered.length} events`);
        }
        
        this.filteredData = filtered;
        this.currentPage = 1;
        this.renderTable();
        this.updatePagination();
        
        console.log(`✅ Filters applied: ${filtered.length} events after filtering`);
    }

    renderTable() {
        const tbody = document.getElementById('fimTableBody');
        if (!tbody) {
            console.error("❌ FIM table body not found");
            return;
        }

        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredData.slice(startIndex, endIndex);

        console.log(`🔍 Rendering table: page ${this.currentPage}, showing ${pageData.length} events`);

        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="no-data">
                        <i class="fas fa-search"></i>
                        No FIM events found matching your filters
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = pageData.map(event => `
            <tr class="alert-row ${event.severity}-alert" data-event-id="${event.id}">
                <td>${this.formatTimestamp(event.timestamp)}</td>
                <td>${event.agent_name}</td>
                <td class="filename-cell">
                    <i class="fas fa-file${this.getFileIcon(event.change_type)}"></i>
                    ${event.filename}
                </td>
                <td class="filepath-cell">${event.file_path}</td>
                <td>
                    <span class="change-type-badge change-${event.change_type}">
                        ${this.formatChangeType(event.change_type)}
                    </span>
                </td>
                <td>${event.user}</td>
                <td>
                    <span class="severity-badge severity-${event.severity}">
                        ${event.severity}
                    </span>
                </td>
                <td>
                    <button class="btn btn-outline" onclick="fimDashboard.showEventDetails('${event.id}')" style="padding: 0.5rem; font-size: 0.75rem;">
                        <i class="fas fa-search"></i>
                        Details
                    </button>
                </td>
            </tr>
        `).join('');
    }

    getFileIcon(changeType) {
        const icons = {
            'created': '-plus',
            'modified': '-edit',
            'deleted': '-times',
            'permission': '-lock',
            'ownership': '-user'
        };
        return icons[changeType] || '';
    }

    formatChangeType(changeType) {
        const types = {
            'created': 'Created',
            'modified': 'Modified',
            'deleted': 'Deleted',
            'permission': 'Permission Changed',
            'ownership': 'Ownership Changed'
        };
        return types[changeType] || changeType;
    }

    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        const paginationInfo = document.getElementById('tablePaginationInfo');
        const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, this.filteredData.length);

        if (paginationInfo) {
            paginationInfo.textContent = `Page ${this.currentPage} of ${totalPages} (${startItem}-${endItem} of ${this.filteredData.length})`;
        }

        // Update pagination buttons
        document.getElementById('firstPage').disabled = this.currentPage === 1;
        document.getElementById('prevPage').disabled = this.currentPage === 1;
        document.getElementById('nextPage').disabled = this.currentPage === totalPages;
        document.getElementById('lastPage').disabled = this.currentPage === totalPages;

        // Update page numbers
        this.updatePageNumbers(totalPages);
    }

    updatePageNumbers(totalPages) {
        const pageNumbers = document.getElementById('pageNumbers');
        if (!pageNumbers) return;

        let pagesHtml = '';
        
        for (let i = 1; i <= totalPages; i++) {
            if (i === this.currentPage) {
                pagesHtml += `<span class="page-number active">${i}</span>`;
            } else {
                pagesHtml += `<span class="page-number">${i}</span>`;
            }
        }
        
        pageNumbers.innerHTML = pagesHtml;

        // Add click events to page numbers
        pageNumbers.querySelectorAll('.page-number').forEach((page, index) => {
            if (!page.classList.contains('active')) {
                page.addEventListener('click', () => this.goToPage(index + 1));
            }
        });
    }

    goToPage(page) {
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        if (page >= 1 && page <= totalPages) {
            console.log(`🔍 Going to page ${page}`);
            this.currentPage = page;
            this.renderTable();
            this.updatePagination();
        }
    }

    goToLastPage() {
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        this.goToPage(totalPages);
    }

    sortTable(field) {
        if (this.sortField === field) {
            this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
            this.sortField = field;
            this.sortDirection = 'desc';
        }

        console.log(`🔍 Sorting by ${field} (${this.sortDirection})`);

        this.filteredData.sort((a, b) => {
            let aValue = a[field];
            let bValue = b[field];

            if (field === 'timestamp') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            }

            if (this.sortDirection === 'asc') {
                return aValue > bValue ? 1 : -1;
            } else {
                return aValue < bValue ? 1 : -1;
            }
        });

        this.renderTable();
    }

    showEventDetails(eventId) {
        const event = this.currentData.find(e => e.id === eventId);
        if (!event) {
            console.error("❌ Event not found:", eventId);
            return;
        }

        console.log("🔍 Showing event details:", eventId);
        this.showAlertDetails(event);
    }

    /**
     * Show alert details modal
     */
    showAlertDetails(event) {
        try {
            const modal = document.getElementById('alertModal');
            const content = document.getElementById('modalContent');
            
            content.innerHTML = this.createAlertDetailContent(event);
            modal.classList.remove('hidden');
            
        } catch (error) {
            this.showError('Failed to load alert details: ' + error.message);
        }
    }

    /**
     * Create alert detail content for FIM events
     */
    createAlertDetailContent(event) {
        const severityClass = this.getSeverityClass(event.severity);
        const timestamp = new Date(event.timestamp).toLocaleString();
        
        return `
            <div class="alert-detail-grid">
                <div class="detail-card">
                    <h4 class="detail-card-title">File Information</h4>
                    <div class="detail-item">
                        <div class="detail-label">File Name</div>
                        <div class="detail-value">${this.escapeHtml(event.filename)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Full Path</div>
                        <div class="detail-value font-mono">${this.escapeHtml(event.file_path)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">File Size</div>
                        <div class="detail-value">${event.file_size || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">File Hash</div>
                        <div class="detail-value font-mono">${event.file_hash || 'N/A'}</div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4 class="detail-card-title">Change Details</h4>
                    <div class="detail-item">
                        <div class="detail-label">Change Type</div>
                        <div class="detail-value">
                            <span class="change-type-badge change-${event.change_type}">
                                ${this.formatChangeType(event.change_type)}
                            </span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Timestamp</div>
                        <div class="detail-value">${timestamp}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">User</div>
                        <div class="detail-value">${this.escapeHtml(event.user)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Severity</div>
                        <div class="detail-value">
                            <span class="severity-badge ${severityClass}">
                                ${event.severity}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4 class="detail-card-title">Agent Information</h4>
                    <div class="detail-item">
                        <div class="detail-label">Agent Name</div>
                        <div class="detail-value">${this.escapeHtml(event.agent_name)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Agent IP</div>
                        <div class="detail-value">${event.agent_ip || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Process Name</div>
                        <div class="detail-value">${event.process_name || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Operating System</div>
                        <div class="detail-value">${event.os_name || 'N/A'}</div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4 class="detail-card-title">Rule Information</h4>
                    <div class="detail-item">
                        <div class="detail-label">Rule ID</div>
                        <div class="detail-value font-mono">${event.rule_id || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Description</div>
                        <div class="detail-value">${event.rule_description || 'N/A'}</div>
                    </div>
                    ${event.changed_attributes && event.changed_attributes.length > 0 ? `
                    <div class="detail-item">
                        <div class="detail-label">Changed Attributes</div>
                        <div class="detail-value">
                            ${event.changed_attributes.map(attr => 
                                `<span class="mitre-tag" style="background: #3b82f6;">${attr}</span>`
                            ).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                ${event.old_permissions || event.new_permissions ? `
                <div class="detail-card">
                    <h4 class="detail-card-title">Permission Changes</h4>
                    ${event.old_permissions ? `
                    <div class="detail-item">
                        <div class="detail-label">Old Permissions</div>
                        <div class="detail-value font-mono">${this.escapeHtml(event.old_permissions)}</div>
                    </div>
                    ` : ''}
                    ${event.new_permissions ? `
                    <div class="detail-item">
                        <div class="detail-label">New Permissions</div>
                        <div class="detail-value font-mono">${this.escapeHtml(event.new_permissions)}</div>
                    </div>
                    ` : ''}
                </div>
                ` : ''}
            </div>
            
            <div class="detail-card" style="grid-column: 1 / -1;">
                <h4 class="detail-card-title">Raw Event Data</h4>
                <pre style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: var(--radius-md); overflow-x: auto; font-size: 0.75rem; line-height: 1.4; max-height: 300px;">${JSON.stringify(event, null, 2)}</pre>
            </div>
        `;
    }

    /**
     * Get severity class for styling
     */
    getSeverityClass(severity) {
        const severityMap = {
            'critical': 'severity-critical',
            'high': 'severity-high', 
            'medium': 'severity-medium',
            'low': 'severity-low'
        };
        return severityMap[severity] || 'severity-low';
    }

    /**
     * Close modal
     */
    closeModal() {
        document.getElementById('alertModal').classList.add('hidden');
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showLoading() {
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.classList.remove('hidden');
            console.log("🔍 Showing loading overlay");
        }
    }

    hideLoading() {
        const loading = document.getElementById('loadingOverlay');
        if (loading) {
            loading.classList.add('hidden');
            console.log("🔍 Hiding loading overlay");
        }
    }

    showError(message) {
        console.error('❌ FIM Dashboard Error:', message);
        // Simple error notification - you can enhance this
        alert('Error: ' + message);
    }

    updateLastUpdate() {
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) {
            const now = new Date();
            const timeString = `Last updated: ${now.toLocaleTimeString()}`;
            lastUpdate.querySelector('span').textContent = timeString;
            console.log("🔍 Updated last update time:", timeString);
        }
    }

    startRealTimeUpdates() {
        console.log("🔍 Starting real-time updates");
        // Real-time updates can be implemented here
        setInterval(() => {
            this.loadFIMData();
        }, 30000); // Update every 30 seconds
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 FIM Dashboard DOM loaded, initializing...");
    try {
        window.fimDashboard = new FIMDashboard();
        console.log("✅ FIM Dashboard initialized successfully");
    } catch (error) {
        console.error("❌ FIM Dashboard initialization failed:", error);
    }
});

// Test function that can be called from browser console
window.testFIM = function() {
    console.log("🧪 Testing FIM Dashboard...");
    if (window.fimDashboard) {
        window.fimDashboard.loadFIMData();
    } else {
        console.error("❌ FIM Dashboard not initialized");
    }
};
