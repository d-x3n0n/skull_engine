/**
 * Professional Case Management Dashboard
 * DFIR-IRIS Integration - FIXED FOR CORRECT ENDPOINTS
 */

class CaseManagementDashboard {
    constructor() {
        this.config = {
            refreshInterval: 30000, // 30 seconds
            apiBaseUrl: '/api/case-management',
            maxCases: 1000,
            enableRealtime: true
        };
        
        this.state = {
            cases: [],
            filteredCases: [],
            currentPage: 1,
            itemsPerPage: 25,
            totalPages: 1,
            currentFilters: {
                search: '',
                status: '',
                severity: '',
                analyst: '',
                sort: 'date_desc'
            },
            sortConfig: {
                key: 'created_at',
                direction: 'desc'
            },
            charts: {},
            lastUpdate: null,
            isLoading: false,
            connectionStatus: 'checking'
        };
        
        this.init();
    }

    /**
     * Initialize the dashboard
     */
    async init() {
        try {
            this.showLoading(true);
            
            console.log('🚀 Initializing Case Management Dashboard...');
            
            // Initialize components
            this.initializeEventListeners();
            this.initializeCharts();
            
            // Load initial data
            await this.loadDashboardData();
            await this.loadCases();
            
            // Start real-time updates
            if (this.config.enableRealtime) {
                this.startRealTimeUpdates();
            }
            
            this.updateLastRefreshTime();
            await this.checkIrisHealth();
            
            console.log('✅ Case Management Dashboard initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize case management:', error);
            this.showError('Failed to initialize case management: ' + error.message);
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
            this.loadCases();
        });

        // New case button
        document.getElementById('newCaseBtn').addEventListener('click', () => {
            this.showNewCaseModal();
        });

        // Filters
        document.getElementById('statusFilter').addEventListener('change', (e) => {
            this.state.currentFilters.status = e.target.value;
            this.applyFilters();
        });

        document.getElementById('severityFilter').addEventListener('change', (e) => {
            this.state.currentFilters.severity = e.target.value;
            this.applyFilters();
        });

        document.getElementById('analystFilter').addEventListener('change', (e) => {
            this.state.currentFilters.analyst = e.target.value;
            this.applyFilters();
        });

        document.getElementById('sortFilter').addEventListener('change', (e) => {
            this.state.currentFilters.sort = e.target.value;
            this.applySorting();
        });

        // Search input
        document.getElementById('searchInput').addEventListener('input', debounce((e) => {
            this.state.currentFilters.search = e.target.value.toLowerCase();
            this.applyFilters();
        }, 300));

        // Table sorting
        this.initializeTableSorting();

        // Pagination
        this.initializePagination();

        // Modals
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeModal();
        });

        document.getElementById('closeNewCaseModal').addEventListener('click', () => {
            this.closeNewCaseModal();
        });

        document.getElementById('cancelNewCase').addEventListener('click', () => {
            this.closeNewCaseModal();
        });

        // New case form
        document.getElementById('newCaseForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createNewCase();
        });

        // Export button
        document.getElementById('exportBtn').addEventListener('click', () => {
            this.exportCases();
        });

        // Refresh recent cases
        document.getElementById('refreshRecent').addEventListener('click', () => {
            this.loadDashboardData();
        });

        // Close modals on overlay click
        document.getElementById('caseModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeModal();
            }
        });

        document.getElementById('newCaseModal').addEventListener('click', (e) => {
            if (e.target === e.currentTarget) {
                this.closeNewCaseModal();
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
     * Initialize charts
     */
    initializeCharts() {
        // Charts will be initialized when data is loaded
        window.caseCharts = {};
    }

    /**
     * Load dashboard summary data
     */
    async loadDashboardData() {
        try {
            console.log('📊 Loading dashboard summary data...');
            
            const response = await fetch(`${this.config.apiBaseUrl}/summary`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            console.log('📊 Dashboard data received:', data);
            
            if (data.error) {
                throw new Error(data.error);
            }

            // Update all dashboard components
            this.updateSummaryCards(data.summary);
            this.updateCharts(data.charts);
            this.updateRecentCases(data.recent_cases);
            
            this.updateLastRefreshTime();
            
        } catch (error) {
            console.error('❌ Failed to load dashboard data:', error);
            this.showError('Failed to load dashboard data: ' + error.message);
        }
    }

    /**
     * Load cases data
     */
    async loadCases() {
        try {
            const { currentPage, itemsPerPage } = this.state;
            const { status, severity } = this.state.currentFilters;
            
            console.log(`📋 Loading cases - page ${currentPage}, items ${itemsPerPage}`);
            
            let url = `${this.config.apiBaseUrl}/cases?page=${currentPage}&per_page=${itemsPerPage}`;
            if (status) url += `&status=${status}`;
            if (severity) url += `&severity=${severity}`;

            console.log(`🔗 API URL: ${url}`);
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            console.log('📋 Cases data received:', data);
            
            if (data.error) {
                throw new Error(data.error);
            }

            this.state.cases = data.cases || [];
            console.log(`📋 Loaded ${this.state.cases.length} cases`);
            
            this.applyFilters();
            
        } catch (error) {
            console.error('❌ Failed to load cases:', error);
            this.showError('Failed to load cases: ' + error.message);
        }
    }

    /**
     * Apply filters to cases
     */
    applyFilters() {
        console.log('🔍 Applying filters...');
        
        let filtered = this.state.cases.filter(caseItem => {
            // Search filter
            const matchesSearch = !this.state.currentFilters.search || 
                (caseItem.case_name && caseItem.case_name.toLowerCase().includes(this.state.currentFilters.search)) ||
                (caseItem.name && caseItem.name.toLowerCase().includes(this.state.currentFilters.search)) ||
                (caseItem.title && caseItem.title.toLowerCase().includes(this.state.currentFilters.search)) ||
                (caseItem.description && caseItem.description.toLowerCase().includes(this.state.currentFilters.search)) ||
                (caseItem.case_id && caseItem.case_id.toString().includes(this.state.currentFilters.search)) ||
                (caseItem.id && caseItem.id.toString().includes(this.state.currentFilters.search));
            
            // Status filter
            const matchesStatus = !this.state.currentFilters.status || 
                (this.getCaseStatus(caseItem) && this.getCaseStatus(caseItem).toLowerCase() === this.state.currentFilters.status.toLowerCase());
            
            // Severity filter
            const matchesSeverity = !this.state.currentFilters.severity || 
                (this.getCaseSeverity(caseItem) && this.getCaseSeverity(caseItem).toLowerCase() === this.state.currentFilters.severity.toLowerCase());
            
            // Analyst filter
            const matchesAnalyst = !this.state.currentFilters.analyst || 
                this.getCaseAnalyst(caseItem) === this.state.currentFilters.analyst;
            
            return matchesSearch && matchesStatus && matchesSeverity && matchesAnalyst;
        });
        
        console.log(`🔍 Filtered to ${filtered.length} cases`);
        
        // Apply sorting
        this.applySorting(filtered);
    }

    /**
     * Apply sorting to cases
     */
    applySorting(filteredCases = this.state.filteredCases) {
        const { sort } = this.state.currentFilters;
        
        let sorted = [...filteredCases];
        
        switch (sort) {
            case 'date_desc':
                sorted.sort((a, b) => new Date(this.getCaseDate(b)) - new Date(this.getCaseDate(a)));
                break;
            case 'date_asc':
                sorted.sort((a, b) => new Date(this.getCaseDate(a)) - new Date(this.getCaseDate(b)));
                break;
            case 'severity_desc':
                sorted.sort((a, b) => this.getSeverityLevel(b) - this.getSeverityLevel(a));
                break;
            case 'severity_asc':
                sorted.sort((a, b) => this.getSeverityLevel(a) - this.getSeverityLevel(b));
                break;
        }
        
        this.state.filteredCases = sorted;
        this.state.currentPage = 1;
        this.updateCasesTable();
        this.updatePagination();
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
        this.applySorting();
    }

    /**
     * Update cases table
     */
    updateCasesTable() {
        const tbody = document.getElementById('casesTableBody');
        const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const endIndex = startIndex + this.state.itemsPerPage;
        const pageCases = this.state.filteredCases.slice(startIndex, endIndex);
        
        tbody.innerHTML = '';

        if (pageCases.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="9" class="text-center" style="padding: 3rem;">
                        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <div>No cases found matching your criteria</div>
                        ${this.state.cases.length === 0 ? 
                            '<div style="font-size: 0.875rem; margin-top: 0.5rem; color: var(--text-muted);">No cases available in IRIS or connection issue</div>' : 
                            ''}
                    </td>
                </tr>
            `;
            return;
        }

        pageCases.forEach(caseItem => {
            const row = this.createCaseRow(caseItem);
            tbody.appendChild(row);
        });
    }

    /**
     * Create case table row
     */
    createCaseRow(caseItem) {
        const row = document.createElement('tr');
        const severityLevel = this.getSeverityLevel(caseItem);
        row.className = `severity-${this.getSeverityLevelName(severityLevel)}`;
        
        const statusClass = this.getStatusClass(this.getCaseStatus(caseItem));
        const severityClass = this.getSeverityClass(severityLevel);
        const caseDate = this.getCaseDate(caseItem);
        const displayDate = caseDate ? new Date(caseDate).toLocaleDateString() : 'N/A';
        
        const caseName = this.getCaseName(caseItem);
        const caseId = this.getCaseId(caseItem);
        const caseStatus = this.getCaseStatus(caseItem);
        const caseSeverity = this.getCaseSeverity(caseItem);
        const caseAnalyst = this.getCaseAnalyst(caseItem);
        const caseDescription = this.getCaseDescription(caseItem);
        
        row.innerHTML = `
            <td class="font-mono" style="font-size: 0.75rem;">${caseId}</td>
            <td>
                <div class="font-medium">${this.escapeHtml(caseName)}</div>
                <div class="text-secondary" style="font-size: 0.75rem;">ID: ${caseId}</div>
            </td>
            <td>
                <span class="status-badge ${statusClass}">
                    ${this.escapeHtml(caseStatus)}
                </span>
            </td>
            <td>
                <span class="severity-badge ${severityClass}">
                    ${this.escapeHtml(caseSeverity)}
                </span>
            </td>
            <td>
                <div class="font-medium">${this.escapeHtml(caseAnalyst)}</div>
            </td>
            <td class="font-mono" style="font-size: 0.75rem;">${displayDate}</td>
            <td class="font-mono" style="font-size: 0.75rem;">-</td>
            <td>
                <div class="case-description">${this.escapeHtml(caseDescription)}</div>
            </td>
            <td>
                <button class="btn btn-outline" onclick="caseDashboard.showCaseDetails(${caseId})" style="padding: 0.5rem; font-size: 0.75rem;">
                    <i class="fas fa-eye"></i>
                    View
                </button>
            </td>
        `;
        
        return row;
    }

    /**
     * Update pagination
     */
    updatePagination() {
        const totalItems = this.state.filteredCases.length;
        this.state.totalPages = Math.ceil(totalItems / this.state.itemsPerPage);
        
        // Update pagination info
        document.getElementById('paginationInfo').textContent = 
            `Showing ${Math.min(this.state.itemsPerPage, totalItems)} of ${totalItems} cases`;
        
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
            this.updateCasesTable();
            this.updatePagination();
        }
    }

    /**
     * Show case details modal
     */
    async showCaseDetails(caseId) {
        try {
            this.showLoading(true);
            
            const response = await fetch(`${this.config.apiBaseUrl}/case/${caseId}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            const modal = document.getElementById('caseModal');
            const content = document.getElementById('modalContent');
            
            content.innerHTML = this.createCaseDetailContent(data, caseId);
            modal.classList.remove('hidden');
            
        } catch (error) {
            console.error('❌ Failed to load case details:', error);
            this.showError('Failed to load case details: ' + error.message);
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Create case detail content
     */
    createCaseDetailContent(data, caseId) {
        const caseDetails = data.case_details?.data || data.case_details || {};
        const timeline = data.timeline?.data || data.timeline || [];
        const assets = data.assets?.data || data.assets || [];
        const iocs = data.iocs?.data || data.iocs || [];
        
        const severityClass = this.getSeverityClass(this.getSeverityLevel(caseDetails));
        const statusClass = this.getStatusClass(this.getCaseStatus(caseDetails));
        
        return `
            <div class="case-detail-grid">
                <div class="detail-card">
                    <h4 class="detail-card-title">Case Information</h4>
                    <div class="detail-item">
                        <div class="detail-label">Case ID</div>
                        <div class="detail-value font-mono">${this.getCaseId(caseDetails)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Case Name</div>
                        <div class="detail-value">${this.escapeHtml(this.getCaseName(caseDetails))}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Description</div>
                        <div class="detail-value">${this.escapeHtml(this.getCaseDescription(caseDetails))}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Status</div>
                        <div class="detail-value">
                            <span class="status-badge ${statusClass}">
                                ${this.escapeHtml(this.getCaseStatus(caseDetails))}
                            </span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Severity</div>
                        <div class="detail-value">
                            <span class="severity-badge ${severityClass}">
                                ${this.escapeHtml(this.getCaseSeverity(caseDetails))}
                            </span>
                        </div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4 class="detail-card-title">Assignment & Dates</h4>
                    <div class="detail-item">
                        <div class="detail-label">Assigned To</div>
                        <div class="detail-value">${this.escapeHtml(this.getCaseAnalyst(caseDetails))}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Created Date</div>
                        <div class="detail-value">${this.getCaseDate(caseDetails) ? new Date(this.getCaseDate(caseDetails)).toLocaleString() : 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Last Updated</div>
                        <div class="detail-value">${caseDetails.updated_at ? new Date(caseDetails.updated_at).toLocaleString() : 'N/A'}</div>
                    </div>
                </div>
                
                ${assets.length > 0 ? `
                <div class="detail-card">
                    <h4 class="detail-card-title">Assets (${assets.length})</h4>
                    <div class="assets-list">
                        ${assets.slice(0, 5).map(asset => `
                            <div class="asset-item">
                                <div class="asset-name">${this.escapeHtml(asset.asset_name || asset.name || 'Unnamed Asset')}</div>
                                <div class="asset-type">${this.escapeHtml(asset.asset_type || asset.type || 'Unknown')}</div>
                            </div>
                        `).join('')}
                        ${assets.length > 5 ? `<div class="text-secondary">+ ${assets.length - 5} more assets</div>` : ''}
                    </div>
                </div>
                ` : ''}
                
                ${iocs.length > 0 ? `
                <div class="detail-card">
                    <h4 class="detail-card-title">IOCs (${iocs.length})</h4>
                    <div class="iocs-list">
                        ${iocs.slice(0, 5).map(ioc => `
                            <div class="ioc-item">
                                <div class="ioc-value font-mono">${this.escapeHtml(ioc.ioc_value || ioc.value || 'N/A')}</div>
                                <div class="ioc-type">${this.escapeHtml(ioc.ioc_type || ioc.type || 'Unknown')}</div>
                            </div>
                        `).join('')}
                        ${iocs.length > 5 ? `<div class="text-secondary">+ ${iocs.length - 5} more IOCs</div>` : ''}
                    </div>
                </div>
                ` : ''}
            </div>
            
            ${timeline.length > 0 ? `
            <div class="detail-card" style="grid-column: 1 / -1;">
                <h4 class="detail-card-title">Timeline Events (${timeline.length})</h4>
                <div class="timeline">
                    ${timeline.slice(0, 10).map(event => `
                        <div class="timeline-event">
                            <div class="timeline-date">${event.event_date ? new Date(event.event_date).toLocaleString() : 'N/A'}</div>
                            <div class="timeline-content">${this.escapeHtml(event.event_content || event.content || 'No content')}</div>
                        </div>
                    `).join('')}
                    ${timeline.length > 10 ? `<div class="text-secondary">+ ${timeline.length - 10} more events</div>` : ''}
                </div>
            </div>
            ` : ''}
            
            <div class="detail-card" style="grid-column: 1 / -1;">
                <h4 class="detail-card-title">Raw Case Data</h4>
                <pre style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: var(--radius-md); overflow-x: auto; font-size: 0.75rem; line-height: 1.4; max-height: 300px;">${JSON.stringify(caseDetails, null, 2)}</pre>
            </div>
        `;
    }

    /**
     * Show new case modal
     */
    showNewCaseModal() {
        document.getElementById('newCaseModal').classList.remove('hidden');
        document.getElementById('caseName').focus();
    }

    /**
     * Create new case
     */
    async createNewCase() {
        try {
            const formData = {
                case_name: document.getElementById('caseName').value,
                case_description: document.getElementById('caseDescription').value,
                severity: document.getElementById('caseSeverity').value,
                status: document.getElementById('caseStatus').value,
                assigned_to: document.getElementById('caseAssignee').value || 'Unassigned'
            };

            const response = await fetch(`${this.config.apiBaseUrl}/create`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.error) {
                throw new Error(result.error);
            }

            this.showSuccess('Case created successfully!');
            this.closeNewCaseModal();
            this.loadDashboardData();
            this.loadCases();
            
        } catch (error) {
            console.error('❌ Failed to create case:', error);
            this.showError('Failed to create case: ' + error.message);
        }
    }

    /**
     * Close modal
     */
    closeModal() {
        document.getElementById('caseModal').classList.add('hidden');
    }

    /**
     * Close new case modal
     */
    closeNewCaseModal() {
        document.getElementById('newCaseModal').classList.add('hidden');
        document.getElementById('newCaseForm').reset();
    }

    /**
     * Update summary cards
     */
    updateSummaryCards(summary) {
        console.log('📈 Updating summary cards:', summary);
        
        document.getElementById('totalCases').textContent = 
            summary?.total_cases?.toLocaleString() || '0';
        document.getElementById('openCases').textContent = 
            summary?.open_cases?.toLocaleString() || '0';
        document.getElementById('closedCases').textContent = 
            summary?.closed_cases?.toLocaleString() || '0';
        document.getElementById('activeInvestigations').textContent = 
            summary?.active_investigations?.toLocaleString() || '0';
        document.getElementById('avgResolution').textContent = 
            summary?.average_resolution_time || '0h';
        document.getElementById('escalatedCases').textContent = 
            summary?.escalated_cases?.toLocaleString() || '0';
    }

    /**
     * Update charts
     */
    updateCharts(chartsData) {
        console.log('📊 Updating charts:', chartsData);
        
        if (!chartsData) {
            console.warn('⚠️ No charts data provided');
            this.createEmptyCharts();
            return;
        }

        // Update status distribution chart
        this.createStatusChart(chartsData.status_distribution);
        
        // Update severity distribution chart
        this.createSeverityChart(chartsData.severity_distribution);
        
        // Update workload chart
        this.createWorkloadChart(chartsData.analyst_workload);
    }

    /**
     * Create empty charts when no data
     */
    createEmptyCharts() {
        const emptyData = { 'No Data': 1 };
        
        this.createStatusChart(emptyData);
        this.createSeverityChart(emptyData);
        this.createWorkloadChart(emptyData);
    }

    /**
     * Create status distribution chart
     */
    createStatusChart(statusData) {
        const ctx = document.getElementById('statusChart');
        if (!ctx) {
            console.error('❌ Status chart canvas not found');
            return;
        }

        // Destroy existing chart
        if (window.caseCharts.statusChart) {
            window.caseCharts.statusChart.destroy();
        }

        const labels = Object.keys(statusData);
        const data = Object.values(statusData);

        // If only "No Data", make it visually clear
        const backgroundColor = labels[0] === 'No Data' ? 
            ['#6B7280'] : // Gray for no data
            [
                '#10B981', // Open - Green
                '#F59E0B', // Investigating - Amber
                '#EF4444', // Closed - Red
                '#8B5CF6', // Other - Purple
                '#3B82F6', // Additional colors
                '#F97316',
                '#84CC16'
            ];

        window.caseCharts.statusChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColor,
                    borderWidth: 2,
                    borderColor: '#1F2937'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#D1D5DB',
                            font: {
                                size: 11
                            }
                        }
                    },
                    title: {
                        display: false
                    }
                }
            }
        });
    }

    /**
     * Create severity distribution chart
     */
    createSeverityChart(severityData) {
        const ctx = document.getElementById('severityChart');
        if (!ctx) {
            console.error('❌ Severity chart canvas not found');
            return;
        }

        if (window.caseCharts.severityChart) {
            window.caseCharts.severityChart.destroy();
        }

        const labels = Object.keys(severityData);
        const data = Object.values(severityData);

        const backgroundColor = labels[0] === 'No Data' ? 
            ['#6B7280'] :
            [
                '#10B981', // Low - Green
                '#F59E0B', // Medium - Amber
                '#EF4444', // High - Red
                '#7C3AED', // Critical - Purple
            ];

        window.caseCharts.severityChart = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: backgroundColor,
                    borderWidth: 2,
                    borderColor: '#1F2937'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#D1D5DB',
                            font: {
                                size: 11
                            }
                        }
                    }
                }
            }
        });
    }

    /**
     * Create workload chart
     */
    createWorkloadChart(workloadData) {
        const ctx = document.getElementById('workloadChart');
        if (!ctx) {
            console.error('❌ Workload chart canvas not found');
            return;
        }

        if (window.caseCharts.workloadChart) {
            window.caseCharts.workloadChart.destroy();
        }

        const labels = Object.keys(workloadData);
        const data = Object.values(workloadData);

        // If no data, create empty chart
        if (labels.length === 0 || (labels.length === 1 && labels[0] === 'No Data')) {
            labels = ['No Analysts'];
            data = [1];
        }

        window.caseCharts.workloadChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Cases Assigned',
                    data: data,
                    backgroundColor: '#3B82F6',
                    borderColor: '#2563EB',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            color: '#9CA3AF'
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    },
                    x: {
                        ticks: {
                            color: '#9CA3AF',
                            maxRotation: 45
                        },
                        grid: {
                            display: false
                        }
                    }
                }
            }
        });
    }

    /**
     * Update recent cases
     */
    updateRecentCases(recentCases) {
        const container = document.getElementById('recentCases');
        
        console.log('🔄 Updating recent cases:', recentCases);
        
        if (!recentCases || recentCases.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 2rem; color: var(--text-muted);">
                    <i class="fas fa-folder-open" style="font-size: 2rem; margin-bottom: 1rem;"></i>
                    <div>No recent cases found</div>
                    <div style="font-size: 0.875rem; margin-top: 0.5rem;">
                        ${this.state.connectionStatus === 'connected' ? 
                          'No cases available in IRIS' : 
                          'Check IRIS connection in health status'}
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = recentCases.map(caseItem => `
            <div class="recent-case-item">
                <div class="recent-case-header">
                    <div class="recent-case-title">${this.escapeHtml(this.getCaseName(caseItem))}</div>
                    <span class="status-badge ${this.getStatusClass(this.getCaseStatus(caseItem))}">
                        ${this.escapeHtml(this.getCaseStatus(caseItem))}
                    </span>
                </div>
                <div class="recent-case-body">
                    <div class="recent-case-info">
                        <span class="recent-case-id">ID: ${this.getCaseId(caseItem)}</span>
                        <span class="recent-case-severity ${this.getSeverityClass(this.getSeverityLevel(caseItem))}">
                            ${this.escapeHtml(this.getCaseSeverity(caseItem))}
                        </span>
                        <span class="recent-case-date">${this.getCaseDate(caseItem) ? new Date(this.getCaseDate(caseItem)).toLocaleDateString() : 'N/A'}</span>
                    </div>
                    <div class="recent-case-assignee">
                        Assigned to: ${this.escapeHtml(this.getCaseAnalyst(caseItem))}
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
     * Check IRIS health
     */
    async checkIrisHealth() {
        try {
            console.log('🔍 Checking IRIS health...');
            
            const response = await fetch(`${this.config.apiBaseUrl}/health`);
            const health = await response.json();
            
            console.log('🔍 IRIS health response:', health);
            
            const statusIndicator = document.getElementById('irisStatus');
            const statusText = document.getElementById('irisStatusText');
            
            if (health.status === 'healthy') {
                statusIndicator.className = 'status-indicator active';
                statusText.textContent = 'Connected';
                this.state.connectionStatus = 'connected';
            } else {
                statusIndicator.className = 'status-indicator error';
                statusText.textContent = 'IRIS Disconnected';
                this.state.connectionStatus = 'disconnected';
                this.showError(`IRIS Connection Failed: ${health.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('❌ IRIS health check failed:', error);
            const statusIndicator = document.getElementById('irisStatus');
            const statusText = document.getElementById('irisStatusText');
            statusIndicator.className = 'status-indicator error';
            statusText.textContent = 'IRIS Connection Failed';
            this.state.connectionStatus = 'failed';
            this.showError('IRIS health check failed: ' + error.message);
        }
    }

    /**
     * Export cases
     */
    exportCases() {
        const data = this.state.filteredCases.length > 0 ? this.state.filteredCases : this.state.cases;
        
        if (data.length === 0) {
            this.showError('No cases available to export');
            return;
        }
        
        const csv = this.convertToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `iris-cases-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        this.showSuccess(`Exported ${data.length} cases successfully`);
    }

    /**
     * Convert data to CSV
     */
    convertToCSV(data) {
        const headers = ['Case ID', 'Name', 'Status', 'Severity', 'Assigned To', 'Created Date', 'Description'];
        const rows = data.map(caseItem => [
            this.getCaseId(caseItem),
            `"${(this.getCaseName(caseItem) || '').replace(/"/g, '""')}"`,
            this.getCaseStatus(caseItem),
            this.getCaseSeverity(caseItem),
            this.getCaseAnalyst(caseItem),
            this.getCaseDate(caseItem),
            `"${(this.getCaseDescription(caseItem) || '').replace(/"/g, '""')}"`
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
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
                <div style="flex: 1;">
                    <i class="fas fa-exclamation-circle"></i>
                    ${this.escapeHtml(message)}
                </div>
                <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; margin-left: 1rem;">
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
     * Show success message
     */
    showSuccess(message) {
        // Create success notification
        const successDiv = document.createElement('div');
        successDiv.className = 'success-notification';
        successDiv.innerHTML = `
            <div style="background: var(--success-color); color: white; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; display: flex; justify-content: between; align-items: center;">
                <div style="flex: 1;">
                    <i class="fas fa-check-circle"></i>
                    ${this.escapeHtml(message)}
                </div>
                <button onclick="this.parentElement.remove()" style="background: none; border: none; color: white; cursor: pointer; margin-left: 1rem;">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        const container = document.querySelector('.container');
        container.insertBefore(successDiv, container.firstChild);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (successDiv.parentElement) {
                successDiv.remove();
            }
        }, 5000);
    }

    /**
     * Case data field getters - handle different field name possibilities
     */
    getCaseId(caseItem) {
        return caseItem.case_id || caseItem.id || 'N/A';
    }

    getCaseName(caseItem) {
        return caseItem.case_name || caseItem.name || caseItem.title || 'Unnamed Case';
    }

    getCaseStatus(caseItem) {
        return caseItem.case_status || caseItem.status || caseItem.state || 'Unknown';
    }

    getCaseSeverity(caseItem) {
        return caseItem.case_severity || caseItem.severity || 'Unknown';
    }

    getCaseAnalyst(caseItem) {
        return caseItem.user_name || caseItem.assigned_to || caseItem.owner || 'Unassigned';
    }

    getCaseDescription(caseItem) {
        return caseItem.case_description || caseItem.description || 'No description available';
    }

    getCaseDate(caseItem) {
        return caseItem.case_open_date || caseItem.created_at || caseItem.date_created || caseItem.open_date;
    }

    /**
     * Get severity level as integer
     */
    getSeverityLevel(caseItem) {
        const severity = this.getCaseSeverity(caseItem);
        const severityStr = String(severity).toLowerCase();
        
        if (severityStr.includes('critical') || severity === 4) return 4;
        if (severityStr.includes('high') || severity === 3) return 3;
        if (severityStr.includes('medium') || severity === 2) return 2;
        if (severityStr.includes('low') || severity === 1) return 1;
        return 1; // Default to low
    }

    getSeverityLevelName(severityLevel) {
        switch (severityLevel) {
            case 4: return 'critical';
            case 3: return 'high';
            case 2: return 'medium';
            default: return 'low';
        }
    }

    /**
     * Get severity class
     */
    getSeverityClass(severityLevel) {
        if (typeof severityLevel === 'object') {
            severityLevel = this.getSeverityLevel(severityLevel);
        }
        
        switch (severityLevel) {
            case 4: return 'severity-critical';
            case 3: return 'severity-high';
            case 2: return 'severity-medium';
            default: return 'severity-low';
        }
    }

    /**
     * Get status class
     */
    getStatusClass(status) {
        const statusLower = String(status || '').toLowerCase();
        if (statusLower.includes('open') || statusLower.includes('investigating') || statusLower.includes('active')) {
            return 'status-open';
        } else if (statusLower.includes('closed') || statusLower.includes('resolved') || statusLower.includes('completed')) {
            return 'status-closed';
        } else {
            return 'status-other';
        }
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Show debug information
     */
    showDebugInfo() {
        console.group('🔧 Dashboard Debug Information');
        console.log('State:', this.state);
        console.log('Config:', this.config);
        console.log('Connection Status:', this.state.connectionStatus);
        console.log('Cases loaded:', this.state.cases.length);
        console.log('Filtered cases:', this.state.filteredCases.length);
        console.groupEnd();
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

// Add debug function to global scope
window.debugCaseDashboard = function() {
    if (window.caseDashboard) {
        window.caseDashboard.showDebugInfo();
    } else {
        console.error('Case dashboard not initialized');
    }
};

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Starting Case Management Dashboard...');
    window.caseDashboard = new CaseManagementDashboard();
    
    // Add debug button to navbar for testing
    const debugButton = document.createElement('button');
    debugButton.className = 'btn btn-outline';
    debugButton.innerHTML = '<i class="fas fa-bug"></i> Debug';
    debugButton.style.marginLeft = '0.5rem';
    debugButton.onclick = window.debugCaseDashboard;
    
    const navbarControls = document.querySelector('.navbar-controls');
    if (navbarControls) {
        navbarControls.appendChild(debugButton);
    }
});
