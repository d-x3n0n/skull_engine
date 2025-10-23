// Threat Intelligence Dashboard JavaScript
class ThreatIntelDashboard {
    constructor() {
        this.currentAlertsPage = 1;
        this.currentFeedsPage = 1;
        this.alertsPerPage = 20;
        this.feedsPerPage = 12;
        this.alertsData = [];
        this.feedsData = [];
        this.filteredAlerts = [];
        this.filteredFeeds = [];
        this.alertsAutoRefresh = false;
        this.feedsAutoRefresh = false;
        this.autoRefreshInterval = null;
        this.isRefreshing = false;
        
        this.initialize();
    }

    async initialize() {
        await this.initializeEventListeners();
        await this.loadInitialData();
        this.updateLastUpdateTime();
    }

    async loadInitialData() {
        // Load alerts by default
        await this.loadAlertsData();
    }

    async initializeEventListeners() {
        // Wait for DOM to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupListeners());
        } else {
            this.setupListeners();
        }
    }

    setupListeners() {
        console.log('Setting up threat intel event listeners...');
        
        // Tab switching
        document.querySelectorAll('.threat-tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchTab(e.currentTarget));
        });
        
        // Auto refresh
        document.getElementById('alertsAutoRefreshBtn')?.addEventListener('click', () => this.toggleAlertsAutoRefresh());
        document.getElementById('feedsAutoRefreshBtn')?.addEventListener('click', () => this.toggleFeedsAutoRefresh());

        // Export buttons
        document.getElementById('exportAlertsBtn')?.addEventListener('click', () => this.exportAlerts());
        document.getElementById('exportFeedsBtn')?.addEventListener('click', () => this.exportFeeds());

        // Pagination
        document.getElementById('alertsFirstPage')?.addEventListener('click', () => this.goToAlertsPage(1));
        document.getElementById('alertsPrevPage')?.addEventListener('click', () => this.goToAlertsPage(this.currentAlertsPage - 1));
        document.getElementById('alertsNextPage')?.addEventListener('click', () => this.goToAlertsPage(this.currentAlertsPage + 1));
        document.getElementById('alertsLastPage')?.addEventListener('click', () => this.goToAlertsPage(this.getTotalAlertsPages()));

        document.getElementById('feedsFirstPage')?.addEventListener('click', () => this.goToFeedsPage(1));
        document.getElementById('feedsPrevPage')?.addEventListener('click', () => this.goToFeedsPage(this.currentFeedsPage - 1));
        document.getElementById('feedsNextPage')?.addEventListener('click', () => this.goToFeedsPage(this.currentFeedsPage + 1));
        document.getElementById('feedsLastPage')?.addEventListener('click', () => this.goToFeedsPage(this.getTotalFeedsPages()));

        // Global refresh
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshAllData());

        // Modal close buttons
        document.getElementById('closeAlertModal')?.addEventListener('click', () => this.closeModal('alertModal'));
        document.getElementById('closeFeedModal')?.addEventListener('click', () => this.closeModal('feedModal'));

        // Close modals on overlay click
        document.getElementById('alertModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'alertModal') this.closeModal('alertModal');
        });
        document.getElementById('feedModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'feedModal') this.closeModal('feedModal');
        });

        console.log('Threat intel event listeners initialized successfully');
    }

    async switchTab(clickedTab) {
        // Update tab styles
        document.querySelectorAll('.threat-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        clickedTab.classList.add('active');

        // Update content visibility
        const tabName = clickedTab.getAttribute('data-tab');
        document.querySelectorAll('.threat-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const contentElement = document.getElementById(tabName + 'Content');
        if (contentElement) {
            contentElement.classList.add('active');
        }

        // Load data when tab is clicked
        if (tabName === 'alerts') {
            await this.loadAlertsData();
        } else if (tabName === 'feeds') {
            await this.loadFeedsData();
        }
    }

    async refreshAllData() {
        if (this.isRefreshing) return;
        
        this.isRefreshing = true;
        const refreshBtn = document.getElementById('refreshBtn');
        if (!refreshBtn) {
            this.isRefreshing = false;
            return;
        }
        
        const originalHtml = refreshBtn.innerHTML;
        
        try {
            refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Refreshing...';
            refreshBtn.disabled = true;
            
            this.showLoading('Refreshing Threat Intelligence Data...');
            
            // Get current active tab
            const activeTab = document.querySelector('.threat-tab.active');
            const activeTabName = activeTab ? activeTab.getAttribute('data-tab') : 'alerts';
            
            if (activeTabName === 'alerts') {
                await this.loadAlertsData(true);
            } else {
                await this.loadFeedsData(true);
            }
            
            this.updateLastUpdateTime();
            this.showNotification('Data refreshed successfully', 'success');
            
        } catch (error) {
            console.error('Refresh error:', error);
            this.showNotification('Failed to refresh data', 'error');
        } finally {
            this.hideLoading();
            refreshBtn.innerHTML = originalHtml;
            refreshBtn.disabled = false;
            this.isRefreshing = false;
        }
    }

    async loadAlertsData(forceRefresh = false) {
        try {
            this.showLoading('Loading Threat Alerts...');
            
            let url = '/api/threat-intel/alerts';
            if (forceRefresh) {
                url += '?refresh=' + Date.now();
            }
            
            console.log('Fetching threat alerts from:', url);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.alertsData = data.alerts || [];
            this.filteredAlerts = [...this.alertsData];
            
            console.log('Threat alerts data loaded:', {
                alertsCount: this.alertsData.length,
                alerts: this.alertsData
            });
            
            this.updateAlertsSummary(data.summary);
            this.renderAlertsTable();
            this.updateAlertsBadge();
            
        } catch (error) {
            console.error('Error loading threat alerts:', error);
            this.showError('Failed to load threat alerts: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    async loadFeedsData(forceRefresh = false) {
        try {
            this.showLoading('Loading Threat Feeds...');
            
            let url = '/api/threat-intel/feeds';
            if (forceRefresh) {
                url += '?refresh=' + Date.now();
            }
            
            console.log('Fetching threat feeds from:', url);
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }
            
            this.feedsData = data.events || [];
            this.filteredFeeds = [...this.feedsData];
            
            console.log('Threat feeds data loaded:', {
                eventsCount: this.feedsData.length,
                summary: data.summary,
                events: this.feedsData
            });
            
            this.updateFeedsSummary(data.summary);
            this.renderFeedsGrid();
            this.updateFeedsBadge();
            
        } catch (error) {
            console.error('Error loading threat feeds:', error);
            this.showError('Failed to load threat feeds: ' + error.message);
        } finally {
            this.hideLoading();
        }
    }

    updateAlertsSummary(summary) {
        console.log('Updating alerts summary with:', summary);
        
        const totalAlertsEl = document.getElementById('totalAlerts');
        const criticalAlertsEl = document.getElementById('criticalAlerts');
        const uniqueIocsEl = document.getElementById('uniqueIocs');
        const affectedAgentsEl = document.getElementById('affectedAgents');

        if (!totalAlertsEl || !criticalAlertsEl || !uniqueIocsEl || !affectedAgentsEl) {
            console.error('Some alerts summary elements not found');
            return;
        }

        totalAlertsEl.textContent = (summary?.total_alerts || 0).toLocaleString();
        criticalAlertsEl.textContent = (summary?.critical_alerts || 0).toLocaleString();
        uniqueIocsEl.textContent = (summary?.unique_iocs || 0).toLocaleString();
        affectedAgentsEl.textContent = (summary?.affected_agents || 0).toLocaleString();
    }

    updateFeedsSummary(summary) {
        console.log('Updating feeds summary with:', summary);
        
        const totalEventsEl = document.getElementById('totalEvents');
        const totalAttributesEl = document.getElementById('totalAttributes');
        const uniqueTagsEl = document.getElementById('uniqueTags');
        const last7DaysEl = document.getElementById('last7Days');

        if (!totalEventsEl || !totalAttributesEl || !uniqueTagsEl || !last7DaysEl) {
            console.error('Some feeds summary elements not found');
            return;
        }

        totalEventsEl.textContent = (summary.total_events || 0).toLocaleString();
        totalAttributesEl.textContent = (summary.total_attributes || 0).toLocaleString();
        uniqueTagsEl.textContent = (summary.unique_tags || 0).toLocaleString();
        last7DaysEl.textContent = (summary.last_7_days || 0).toLocaleString();
    }

    renderAlertsTable() {
        const tbody = document.getElementById('alertsTableBody');
        const emptyState = document.getElementById('alertsEmptyState');
        const alertsTable = document.getElementById('alertsTable');

        if (!tbody || !emptyState || !alertsTable) {
            console.error('Alerts table elements not found');
            return;
        }

        const startIndex = (this.currentAlertsPage - 1) * this.alertsPerPage;
        const endIndex = startIndex + this.alertsPerPage;
        const currentAlerts = this.filteredAlerts.slice(startIndex, endIndex);

        tbody.innerHTML = '';

        if (currentAlerts.length === 0) {
            emptyState.classList.remove('hidden');
            alertsTable.style.display = 'none';
            this.updateAlertsPagination();
            return;
        }

        emptyState.classList.add('hidden');
        alertsTable.style.display = 'table';

        currentAlerts.forEach(alert => {
            const row = this.createAlertRow(alert);
            tbody.appendChild(row);
        });

        this.updateAlertsPagination();
    }

    createAlertRow(alert) {
        const row = document.createElement('tr');
        row.className = 'alert-row';
        
        row.innerHTML = `
            <td>
                <div class="timestamp-cell">
                    <div class="timestamp">${this.formatTimestamp(alert.timestamp)}</div>
                    <div class="timestamp-relative">${this.getRelativeTime(alert.timestamp)}</div>
                </div>
            </td>
            <td>
                <span class="severity-badge level-${alert.severity}">
                    ${alert.severity}
                </span>
            </td>
            <td>
                <div class="agent-info">
                    <i class="fas fa-desktop"></i>
                    <span>${this.escapeHtml(alert.agent_name || 'Unknown')}</span>
                </div>
                <div class="agent-ip">${this.escapeHtml(alert.agent_ip || 'N/A')}</div>
            </td>
            <td>
                <div class="ioc-value">
                    <span class="ioc-badge">
                        <i class="fas fa-fingerprint"></i>
                        ${this.escapeHtml(alert.ioc_value || 'N/A')}
                    </span>
                </div>
            </td>
            <td>
                <span class="threat-type">${this.escapeHtml(alert.ioc_type || 'Unknown')}</span>
            </td>
            <td>
                <span class="threat-category">${this.escapeHtml(alert.category || 'Unknown')}</span>
            </td>
            <td>
                <div class="misp-event">
                    <i class="fas fa-database"></i>
                    Event #${this.escapeHtml(alert.event_id || 'N/A')}
                </div>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-icon view-alert" title="View Details">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn-icon block-ioc" title="Block IoC">
                        <i class="fas fa-ban"></i>
                    </button>
                </div>
            </td>
        `;

        // Add event listeners
        const viewBtn = row.querySelector('.view-alert');
        const blockBtn = row.querySelector('.block-ioc');

        if (viewBtn) viewBtn.addEventListener('click', () => this.showAlertDetails(alert));
        if (blockBtn) blockBtn.addEventListener('click', () => this.blockIOC(alert));

        return row;
    }

    renderFeedsGrid() {
        const grid = document.getElementById('feedsGrid');
        const emptyState = document.getElementById('feedsEmptyState');

        if (!grid || !emptyState) {
            console.error('Feeds grid elements not found');
            return;
        }

        const startIndex = (this.currentFeedsPage - 1) * this.feedsPerPage;
        const endIndex = startIndex + this.feedsPerPage;
        const currentFeeds = this.filteredFeeds.slice(startIndex, endIndex);

        grid.innerHTML = '';

        if (currentFeeds.length === 0) {
            emptyState.classList.remove('hidden');
            grid.style.display = 'none';
            this.updateFeedsPagination();
            return;
        }

        emptyState.classList.add('hidden');
        grid.style.display = 'grid';

        currentFeeds.forEach(feed => {
            const card = this.createFeedCard(feed);
            grid.appendChild(card);
        });

        this.updateFeedsPagination();
    }

    createFeedCard(feed) {
        const card = document.createElement('div');
        card.className = 'feed-card';
        
        const attributes = feed.attributes || [];
        const iocs = attributes.slice(0, 5);

        card.innerHTML = `
            <div class="feed-header">
                <h3 class="feed-title">${this.escapeHtml(feed.info || 'Untitled Event')}</h3>
                <div class="feed-meta">
                    <span class="threat-level-badge level-${feed.threat_level_id}">
                        ${this.getThreatLevelText(feed.threat_level_id)}
                    </span>
                    <span>${this.formatDate(feed.date)}</span>
                </div>
            </div>
            
            <div class="feed-description">
                ${this.escapeHtml(feed.description || 'No description available.')}
            </div>
            
            ${feed.tags && feed.tags.length > 0 ? `
                <div class="feed-tags">
                    ${feed.tags.slice(0, 5).map(tag => `
                        <span class="feed-tag">${this.escapeHtml(tag)}</span>
                    `).join('')}
                    ${feed.tags.length > 5 ? `<span class="feed-tag">+${feed.tags.length - 5}</span>` : ''}
                </div>
            ` : ''}
            
            <div class="feed-iocs">
                <div class="ioc-list">
                    ${iocs.map(attr => `
                        <div class="ioc-item">
                            <span class="ioc-type">${this.escapeHtml(attr.type)}</span>
                            <span class="ioc-value">${this.escapeHtml(attr.value)}</span>
                        </div>
                    `).join('')}
                    ${attributes.length > 5 ? `
                        <div class="ioc-item more-iocs">
                            <span>+ ${attributes.length - 5} more indicators</span>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <div class="feed-actions">
                <button class="btn btn-outline view-feed">View Details</button>
            </div>
        `;

        const viewBtn = card.querySelector('.view-feed');
        if (viewBtn) viewBtn.addEventListener('click', () => this.showFeedDetails(feed));

        return card;
    }

    // Auto refresh methods
    toggleAlertsAutoRefresh() {
        this.alertsAutoRefresh = !this.alertsAutoRefresh;
        const button = document.getElementById('alertsAutoRefreshBtn');
        const text = document.getElementById('alertsAutoRefreshText');
        
        if (!button || !text) return;
        
        if (this.alertsAutoRefresh) {
            text.textContent = 'Auto Refresh: On (30s)';
            button.classList.add('active');
            this.startAutoRefresh();
        } else {
            text.textContent = 'Auto Refresh: Off';
            button.classList.remove('active');
            this.stopAutoRefresh();
        }
    }

    toggleFeedsAutoRefresh() {
        this.feedsAutoRefresh = !this.feedsAutoRefresh;
        const button = document.getElementById('feedsAutoRefreshBtn');
        const text = document.getElementById('feedsAutoRefreshText');
        
        if (!button || !text) return;
        
        if (this.feedsAutoRefresh) {
            text.textContent = 'Auto Refresh: On (60s)';
            button.classList.add('active');
            this.startAutoRefresh();
        } else {
            text.textContent = 'Auto Refresh: Off';
            button.classList.remove('active');
            this.stopAutoRefresh();
        }
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        this.autoRefreshInterval = setInterval(() => {
            const activeTab = document.querySelector('.threat-tab.active');
            const activeTabName = activeTab ? activeTab.getAttribute('data-tab') : 'alerts';
            
            if (activeTabName === 'alerts' && this.alertsAutoRefresh) {
                this.loadAlertsData(true);
            } else if (activeTabName === 'feeds' && this.feedsAutoRefresh) {
                this.loadFeedsData(true);
            }
        }, 30000);
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    // Pagination methods
    updateAlertsPagination() {
        const paginationInfo = document.getElementById('alertsPaginationInfo');
        const pageNumbers = document.getElementById('alertsPageNumbers');
        const resultsCount = document.getElementById('alertsResultsCount');
        const firstPage = document.getElementById('alertsFirstPage');
        const prevPage = document.getElementById('alertsPrevPage');
        const nextPage = document.getElementById('alertsNextPage');
        const lastPage = document.getElementById('alertsLastPage');

        if (!paginationInfo || !pageNumbers || !resultsCount || !firstPage || !prevPage || !nextPage || !lastPage) {
            console.error('Alerts pagination elements not found');
            return;
        }

        const totalPages = this.getTotalAlertsPages();
        const startItem = (this.currentAlertsPage - 1) * this.alertsPerPage + 1;
        const endItem = Math.min(this.currentAlertsPage * this.alertsPerPage, this.filteredAlerts.length);
        
        paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${this.filteredAlerts.length} alerts`;
        pageNumbers.textContent = `Page ${this.currentAlertsPage} of ${totalPages}`;
        resultsCount.textContent = `(${this.filteredAlerts.length} alerts)`;

        // Update button states
        firstPage.disabled = this.currentAlertsPage === 1;
        prevPage.disabled = this.currentAlertsPage === 1;
        nextPage.disabled = this.currentAlertsPage === totalPages;
        lastPage.disabled = this.currentAlertsPage === totalPages;
    }

    updateFeedsPagination() {
        const paginationInfo = document.getElementById('feedsPaginationInfo');
        const pageNumbers = document.getElementById('feedsPageNumbers');
        const resultsCount = document.getElementById('feedsResultsCount');
        const firstPage = document.getElementById('feedsFirstPage');
        const prevPage = document.getElementById('feedsPrevPage');
        const nextPage = document.getElementById('feedsNextPage');
        const lastPage = document.getElementById('feedsLastPage');

        if (!paginationInfo || !pageNumbers || !resultsCount || !firstPage || !prevPage || !nextPage || !lastPage) {
            console.error('Feeds pagination elements not found');
            return;
        }

        const totalPages = this.getTotalFeedsPages();
        const startItem = (this.currentFeedsPage - 1) * this.feedsPerPage + 1;
        const endItem = Math.min(this.currentFeedsPage * this.feedsPerPage, this.filteredFeeds.length);
        
        paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${this.filteredFeeds.length} events`;
        pageNumbers.textContent = `Page ${this.currentFeedsPage} of ${totalPages}`;
        resultsCount.textContent = `(${this.filteredFeeds.length} events)`;

        // Update button states
        firstPage.disabled = this.currentFeedsPage === 1;
        prevPage.disabled = this.currentFeedsPage === 1;
        nextPage.disabled = this.currentFeedsPage === totalPages;
        lastPage.disabled = this.currentFeedsPage === totalPages;
    }

    getTotalAlertsPages() {
        return Math.ceil(this.filteredAlerts.length / this.alertsPerPage);
    }

    getTotalFeedsPages() {
        return Math.ceil(this.filteredFeeds.length / this.feedsPerPage);
    }

    goToAlertsPage(page) {
        const totalPages = this.getTotalAlertsPages();
        if (page >= 1 && page <= totalPages) {
            this.currentAlertsPage = page;
            this.renderAlertsTable();
        }
    }

    goToFeedsPage(page) {
        const totalPages = this.getTotalFeedsPages();
        if (page >= 1 && page <= totalPages) {
            this.currentFeedsPage = page;
            this.renderFeedsGrid();
        }
    }

    // Modal methods
    showAlertDetails(alert) {
        const modalContent = document.getElementById('alertModalContent');
        if (!modalContent) return;
        
        modalContent.innerHTML = `
            <div class="alert-details">
                <div class="detail-section">
                    <h4>Alert Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Timestamp:</label>
                            <span>${this.formatTimestamp(alert.timestamp)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Severity Level:</label>
                            <span class="severity-badge level-${alert.severity}">
                                ${alert.severity}
                            </span>
                        </div>
                        <div class="detail-item">
                            <label>Agent:</label>
                            <span>${this.escapeHtml(alert.agent_name)} (${this.escapeHtml(alert.agent_ip)})</span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>MISP IoC Details</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>IoC Value:</label>
                            <span class="ioc-badge">${this.escapeHtml(alert.ioc_value)}</span>
                        </div>
                        <div class="detail-item">
                            <label>IoC Type:</label>
                            <span class="threat-type">${this.escapeHtml(alert.ioc_type)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Category:</label>
                            <span class="threat-category">${this.escapeHtml(alert.category)}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        this.showModal('alertModal');
    }

    showFeedDetails(feed) {
        const modalContent = document.getElementById('feedModalContent');
        if (!modalContent) return;

        const attributes = feed.attributes || [];
        
        modalContent.innerHTML = `
            <div class="feed-details">
                <div class="detail-section">
                    <h4>Event Information</h4>
                    <div class="detail-grid">
                        <div class="detail-item">
                            <label>Event ID:</label>
                            <span>${this.escapeHtml(feed.id)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Date:</label>
                            <span>${this.formatDate(feed.date)}</span>
                        </div>
                        <div class="detail-item">
                            <label>Threat Level:</label>
                            <span class="threat-level-badge level-${feed.threat_level_id}">
                                ${this.getThreatLevelText(feed.threat_level_id)}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Event Details</h4>
                    <div class="detail-item full-width">
                        <label>Title:</label>
                        <span>${this.escapeHtml(feed.info)}</span>
                    </div>
                    <div class="detail-item full-width">
                        <label>Description:</label>
                        <span>${this.escapeHtml(feed.description || 'No description available')}</span>
                    </div>
                </div>
                
                <div class="detail-section">
                    <h4>Indicators of Compromise (${attributes.length})</h4>
                    <div class="ioc-table-container">
                        <table class="ioc-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Value</th>
                                    <th>Category</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${attributes.map(attr => `
                                    <tr>
                                        <td><span class="threat-type">${this.escapeHtml(attr.type)}</span></td>
                                        <td><code>${this.escapeHtml(attr.value)}</code></td>
                                        <td>${this.escapeHtml(attr.category)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        this.showModal('feedModal');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
            document.body.style.overflow = 'hidden';
        }
    }

    closeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
            document.body.style.overflow = '';
        }
    }

    // Utility methods
    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return unsafe
            .toString()
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    formatTimestamp(timestamp) {
        try {
            return new Date(timestamp).toLocaleString();
        } catch (e) {
            return 'Invalid Date';
        }
    }

    formatDate(dateString) {
        try {
            return new Date(dateString).toLocaleDateString();
        } catch (e) {
            return 'Invalid Date';
        }
    }

    getRelativeTime(timestamp) {
        try {
            const now = new Date();
            const time = new Date(timestamp);
            const diffMs = now - time;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);

            if (diffMins < 1) return 'Just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            return `${diffDays}d ago`;
        } catch (e) {
            return 'Unknown';
        }
    }

    getThreatLevelText(levelId) {
        const levels = {
            '1': 'Low',
            '2': 'Medium',
            '3': 'High',
            '4': 'Critical'
        };
        return levels[levelId] || 'Unknown';
    }

    blockIOC(alert) {
        if (confirm(`Block IoC: ${alert.ioc_value}?`)) {
            this.showNotification(`IoC ${alert.ioc_value} blocked successfully`, 'success');
        }
    }

    exportAlerts() {
        const data = this.filteredAlerts.map(alert => ({
            timestamp: alert.timestamp,
            severity: alert.severity,
            agent: alert.agent_name,
            ioc_value: alert.ioc_value,
            ioc_type: alert.ioc_type,
            category: alert.category
        }));
        
        this.downloadJSON(data, 'threat-alerts.json');
        this.showNotification('Alerts exported successfully', 'success');
    }

    exportFeeds() {
        const data = this.filteredFeeds.map(feed => ({
            id: feed.id,
            date: feed.date,
            info: feed.info,
            threat_level: this.getThreatLevelText(feed.threat_level_id),
            description: feed.description,
            attributes: feed.attributes?.map(attr => ({
                type: attr.type,
                value: attr.value,
                category: attr.category
            }))
        }));
        
        this.downloadJSON(data, 'threat-feeds.json');
        this.showNotification('Feeds exported successfully', 'success');
    }

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    updateAlertsBadge() {
        const badge = document.getElementById('alertsBadge');
        if (badge) {
            badge.textContent = this.alertsData.length.toLocaleString();
        }
    }

    updateFeedsBadge() {
        const badge = document.getElementById('feedsBadge');
        if (badge) {
            badge.textContent = this.feedsData.length.toLocaleString();
        }
    }

    showLoading(message) {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');
        if (overlay && text) {
            text.textContent = message;
            overlay.classList.remove('hidden');
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${this.escapeHtml(message)}</span>
            </div>
        `;
        
        // Add styles if not already added
        if (!document.querySelector('#notification-styles')) {
            const styles = document.createElement('style');
            styles.id = 'notification-styles';
            styles.textContent = `
                .notification {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    padding: 1rem 1.5rem;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    z-index: 10000;
                    animation: slideIn 0.3s ease;
                    max-width: 400px;
                }
                .notification.success {
                    border-left: 4px solid #10B981;
                }
                .notification.error {
                    border-left: 4px solid #EF4444;
                }
                .notification.info {
                    border-left: 4px solid #3B82F6;
                }
                .notification.warning {
                    border-left: 4px solid #F59E0B;
                }
                .notification-content {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
            `;
            document.head.appendChild(styles);
        }
        
        document.body.appendChild(notification);
        
        // Remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 5000);
    }

    updateLastUpdateTime() {
        const lastUpdateElement = document.getElementById('lastUpdate');
        if (lastUpdateElement) {
            const span = lastUpdateElement.querySelector('span');
            if (span) {
                span.textContent = new Date().toLocaleString();
            }
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Threat Intelligence Dashboard...');
    window.threatIntelDashboard = new ThreatIntelDashboard();
});
