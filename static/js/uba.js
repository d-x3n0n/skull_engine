/**
 * Professional UBA Dashboard
 * User Behavior Analytics Module for Bangla SOC
 */

class UBADashboard {
    constructor() {
        this.config = {
            refreshInterval: 45000, // 45 seconds
            apiBaseUrl: '/api/uba',
            maxAnomalies: 1000,
            enableRealtime: true
        };
        
        this.state = {
            anomalies: [],
            filteredAnomalies: [],
            detectors: [],
            currentPage: 1,
            itemsPerPage: 20,
            totalPages: 1,
            currentFilters: {
                search: '',
                detector: '',
                confidence: '',
                timeRange: '7'
            },
            sortConfig: {
                key: 'execution_start_time',
                direction: 'desc'
            },
            charts: {},
            lastUpdate: null,
            isLoading: false
        };
        
        this.init();
    }

    /**
     * Initialize UBA dashboard
     */
    async init() {
        try {
            this.showLoading(true);
            
            this.initializeEventListeners();
            this.initializeCharts();
            
            await this.loadDetectors();
            await this.loadDashboardData();
            
            if (this.config.enableRealtime) {
                this.startRealTimeUpdates();
            }
            
            this.updateLastRefreshTime();
            
        } catch (error) {
            this.showError('Failed to initialize UBA dashboard: ' + error.message);
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

        // Detector filter
        document.getElementById('detectorFilter').addEventListener('change', (e) => {
            this.state.currentFilters.detector = e.target.value;
            this.applyFilters();
        });

        // Confidence filter
        document.getElementById('confidenceFilter').addEventListener('change', (e) => {
            this.state.currentFilters.confidence = e.target.value;
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
            this.exportAnomalies();
        });

        // Close modal on overlay click
        document.getElementById('anomalyModal').addEventListener('click', (e) => {
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
     * Load detectors list
     */
    async loadDetectors() {
        try {
            const response = await fetch(`${this.config.apiBaseUrl}/detectors`);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            
            const data = await response.json();
            if (data.error) throw new Error(data.error);
            
            this.state.detectors = data.detectors || [];
            this.updateDetectorFilter();
            
        } catch (error) {
            console.warn('Failed to load detectors:', error.message);
            // Use sample detectors if API fails
            this.state.detectors = [
                {id: "failed-logins-srcip", name: "Failed Logins by Source IP"},
                {id: "failed-logins-agentip", name: "Failed Logins by Agent IP"},
                {id: "brute-anomalies", name: "Brute Force Anomalies"},
                {id: "test_99", name: "Test Detector"}
            ];
            this.updateDetectorFilter();
        }
    }

    /**
     * Update detector filter options
     */
    updateDetectorFilter() {
        const filter = document.getElementById('detectorFilter');
        const options = filter.querySelectorAll('option:not(:first-child)');
        options.forEach(opt => opt.remove());
        
        this.state.detectors.forEach(detector => {
            const option = document.createElement('option');
            option.value = detector.id;
            option.textContent = detector.name || detector.id;
            filter.appendChild(option);
        });
    }

    /**
     * Load dashboard data
     */
    async loadDashboardData() {
        try {
            this.showLoading(true);
            
            const timeRange = this.state.currentFilters.timeRange;
            const url = `${this.config.apiBaseUrl}/anomalies?days=${timeRange}`;

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error);
            }

            this.state.anomalies = data.anomalies || [];
            this.state.lastUpdate = new Date();
            
            // Update all dashboard components
            this.updateSummaryCards(data.summary);
            this.updateCharts(data.charts);
            this.applyFilters();
            
            this.updateLastRefreshTime();
            
        } catch (error) {
            console.error('Failed to load UBA data:', error);
            this.showError('Failed to load UBA data: ' + error.message);
            
            // Load sample data for demonstration
            await this.loadSampleData();
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Load sample data when API is unavailable
     */
    async loadSampleData() {
        console.log('Loading sample UBA data for demonstration...');
        
        // Generate sample anomalies
        const sampleAnomalies = this.generateSampleAnomalies(25);
        const sampleSummary = this.generateSampleSummary(sampleAnomalies);
        const sampleCharts = this.generateSampleCharts(sampleAnomalies);
        
        this.state.anomalies = sampleAnomalies;
        this.state.lastUpdate = new Date();
        
        this.updateSummaryCards(sampleSummary);
        this.updateCharts(sampleCharts);
        this.applyFilters();
        
        // Show demo mode indicator
        this.showDemoIndicator();
    }

    /**
     * Generate sample anomalies for demonstration
     */
    generateSampleAnomalies(count = 25) {
        const anomalies = [];
        const detectors = [
            {id: 'brute-anomalies', name: 'Brute Force Anomalies'},
            {id: 'failed-logins-srcip', name: 'Failed Logins by Source IP'},
            {id: 'failed-logins-agentip', name: 'Failed Logins by Agent IP'},
            {id: 'test_99', name: 'Test Detector'}
        ];
        
        const baseTime = new Date().getTime();
        
        for (let i = 0; i < count; i++) {
            const detector = detectors[Math.floor(Math.random() * detectors.length)];
            const anomalyGrade = parseFloat((Math.random() * 0.9 + 0.1).toFixed(3));
            const confidence = parseFloat((Math.random() * 0.6 + 0.3).toFixed(3));
            
            // Generate feature data based on detector type
            let featureData = {};
            if (detector.id.includes('login')) {
                featureData = {
                    'failed-logins-srcip': Math.floor(Math.random() * 50),
                    'failed-logins-agentip': Math.floor(Math.random() * 30),
                    'login_attempts': Math.floor(Math.random() * 100)
                };
            } else if (detector.id === 'brute-anomalies') {
                featureData = {
                    'failed-logins-srcip': Math.floor(Math.random() * 200),
                    'failed-logins-agentip': Math.floor(Math.random() * 100),
                    'time_window': Math.floor(Math.random() * 60)
                };
            } else {
                featureData = {
                    'feature01': Math.floor(Math.random() * 100),
                    'feature02': Math.floor(Math.random() * 50),
                    'feature03': Math.floor(Math.random() * 75)
                };
            }
            
            anomalies.push({
                id: `sample_anomaly_${i}`,
                detector_id: detector.id,
                detector_name: detector.name,
                anomaly_grade: anomalyGrade,
                anomaly_score: parseFloat((Math.random() * 4.5 + 0.5).toFixed(3)),
                confidence: confidence,
                execution_start_time: baseTime - Math.random() * 7 * 24 * 60 * 60 * 1000,
                data_start_time: baseTime - Math.random() * 10 * 24 * 60 * 60 * 1000,
                data_end_time: baseTime - Math.random() * 2 * 24 * 60 * 60 * 1000,
                feature_data: featureData,
                relevant_attribution: [
                    {feature_id: 'feature_1', data: parseFloat((Math.random()).toFixed(3))},
                    {feature_id: 'feature_2', data: parseFloat((Math.random()).toFixed(3))}
                ],
                user: {
                    name: `user_${Math.floor(Math.random() * 100)}`,
                    roles: ['user', 'admin'][Math.floor(Math.random() * 2)]
                },
                threshold: 0.8,
                model_id: `${detector.id}_model`
            });
        }
        
        return anomalies;
    }

    /**
     * Generate sample summary
     */
    generateSampleSummary(anomalies) {
        const total = anomalies.length;
        const highConfidence = anomalies.filter(a => a.confidence > 0.7).length;
        const highGrade = anomalies.filter(a => a.anomaly_grade > 0.5).length;
        const activeDetectors = new Set(anomalies.map(a => a.detector_id)).size;
        const avgGrade = anomalies.reduce((sum, a) => sum + a.anomaly_grade, 0) / total;
        const avgConfidence = anomalies.reduce((sum, a) => sum + a.confidence, 0) / total;
        
        return {
            total_anomalies: total,
            high_confidence_anomalies: highConfidence,
            high_grade_anomalies: highGrade,
            active_detectors: activeDetectors,
            avg_anomaly_grade: parseFloat(avgGrade.toFixed(3)),
            avg_confidence: parseFloat(avgConfidence.toFixed(3))
        };
    }

    /**
     * Generate sample charts
     */
    generateSampleCharts(anomalies) {
        // Anomalies over time (last 7 days)
        const anomaliesOverTime = {};
        const baseDate = new Date();
        
        for (let i = 0; i < 7; i++) {
            const date = new Date(baseDate);
            date.setDate(date.getDate() - i);
            const dateKey = date.toISOString().split('T')[0];
            anomaliesOverTime[dateKey] = Math.floor(Math.random() * 8) + 2;
        }
        
        // Detector distribution
        const detectorDistribution = {};
        anomalies.forEach(anomaly => {
            const detectorName = anomaly.detector_name || anomaly.detector_id;
            detectorDistribution[detectorName] = (detectorDistribution[detectorName] || 0) + 1;
        });
        
        return {
            anomalies_over_time: anomaliesOverTime,
            detector_distribution: detectorDistribution,
            anomaly_grades: anomalies.map(a => a.anomaly_grade),
            confidence_levels: anomalies.map(a => a.confidence)
        };
    }

    /**
     * Show demo mode indicator
     */
    showDemoIndicator() {
        // Remove existing demo indicator
        const existingIndicator = document.querySelector('.demo-indicator');
        if (existingIndicator) {
            existingIndicator.remove();
        }
        
        // Create demo indicator
        const indicator = document.createElement('div');
        indicator.className = 'demo-indicator';
        indicator.innerHTML = `
            <div style="
                position: fixed;
                top: 10px;
                right: 10px;
                background: #f59e0b;
                color: white;
                padding: 0.5rem 1rem;
                border-radius: var(--radius-md);
                font-size: 0.75rem;
                font-weight: 600;
                z-index: 10000;
                box-shadow: var(--shadow-md);
            ">
                <i class="fas fa-vial"></i>
                DEMO MODE - Sample Data
            </div>
        `;
        
        document.body.appendChild(indicator);
    }

    /**
     * Apply filters to anomalies
     */
    applyFilters() {
        let filtered = this.state.anomalies.filter(anomaly => {
            // Search filter
            const matchesSearch = !this.state.currentFilters.search || 
                anomaly.detector_id.toLowerCase().includes(this.state.currentFilters.search) ||
                (anomaly.detector_name && anomaly.detector_name.toLowerCase().includes(this.state.currentFilters.search)) ||
                Object.keys(anomaly.feature_data).some(key => 
                    key.toLowerCase().includes(this.state.currentFilters.search)
                );
            
            // Detector filter
            const matchesDetector = !this.state.currentFilters.detector || 
                anomaly.detector_id === this.state.currentFilters.detector;
            
            // Confidence filter
            const matchesConfidence = !this.state.currentFilters.confidence || 
                anomaly.confidence >= parseFloat(this.state.currentFilters.confidence);
            
            return matchesSearch && matchesDetector && matchesConfidence;
        });
        
        // Apply sorting
        filtered = this.sortAnomalies(filtered, this.state.sortConfig.key, this.state.sortConfig.direction);
        
        this.state.filteredAnomalies = filtered;
        this.state.currentPage = 1;
        this.updateAnomaliesTable();
        this.updatePagination();
    }

    /**
     * Sort anomalies array
     */
    sortAnomalies(anomalies, key, direction) {
        return anomalies.sort((a, b) => {
            let aValue = a[key];
            let bValue = b[key];
            
            if (key === 'execution_start_time') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
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
     * Update anomalies table
     */
    updateAnomaliesTable() {
        const tbody = document.getElementById('anomaliesTableBody');
        const startIndex = (this.state.currentPage - 1) * this.state.itemsPerPage;
        const endIndex = startIndex + this.state.itemsPerPage;
        const pageAnomalies = this.state.filteredAnomalies.slice(startIndex, endIndex);
        
        tbody.innerHTML = '';

        if (pageAnomalies.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center" style="padding: 3rem;">
                        <i class="fas fa-search" style="font-size: 2rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                        <div>No anomalies found matching your criteria</div>
                    </td>
                </tr>
            `;
            return;
        }

        pageAnomalies.forEach(anomaly => {
            const row = this.createAnomalyRow(anomaly);
            tbody.appendChild(row);
        });
    }

    /**
     * Create anomaly table row
     */
    createAnomalyRow(anomaly) {
        const row = document.createElement('tr');
        row.className = `anomaly-grade-${this.getAnomalyGradeLevel(anomaly.anomaly_grade)}`;
        
        const timestamp = new Date(anomaly.execution_start_time).toLocaleString();
        const gradeClass = this.getAnomalyGradeClass(anomaly.anomaly_grade);
        const confidenceClass = this.getConfidenceClass(anomaly.confidence);
        
        // Get top 3 features
        const topFeatures = Object.keys(anomaly.feature_data).slice(0, 3);
        const featureValues = topFeatures.map(feature => 
            `${anomaly.feature_data[feature]}`
        ).join(', ');
        
        // Get detector display name
        const detectorName = anomaly.detector_name || anomaly.detector_id;
        const shortDetectorId = anomaly.detector_id.substring(0, 12) + (anomaly.detector_id.length > 12 ? '...' : '');
        
        row.innerHTML = `
            <td class="font-mono" style="font-size: 0.75rem;">${timestamp}</td>
            <td>
                <span class="anomaly-badge ${gradeClass}">
                    ${anomaly.anomaly_grade.toFixed(3)}
                </span>
            </td>
            <td>
                <span class="confidence-badge ${confidenceClass}">
                    ${anomaly.confidence.toFixed(3)}
                </span>
            </td>
            <td class="font-mono" style="font-size: 0.75rem;" title="${detectorName}">
                ${shortDetectorId}
            </td>
            <td>
                ${topFeatures.map(feature => 
                    `<span class="feature-tag">${feature}</span>`
                ).join('')}
            </td>
            <td class="font-mono" style="font-size: 0.75rem;" title="${topFeatures.map(f => f + ': ' + anomaly.feature_data[f]).join(', ')}">
                ${featureValues.substring(0, 40)}${featureValues.length > 40 ? '...' : ''}
            </td>
            <td>
                <button class="btn btn-outline" onclick="ubaDashboard.showAnomalyDetails('${anomaly.id}')" style="padding: 0.5rem; font-size: 0.75rem;">
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
        const totalItems = this.state.filteredAnomalies.length;
        this.state.totalPages = Math.ceil(totalItems / this.state.itemsPerPage);
        
        document.getElementById('paginationInfo').textContent = 
            `Showing ${Math.min(this.state.itemsPerPage, totalItems)} of ${totalItems} anomalies`;
        
        document.getElementById('tablePaginationInfo').textContent = 
            `Page ${this.state.currentPage} of ${this.state.totalPages}`;
        
        document.getElementById('firstPage').disabled = this.state.currentPage === 1;
        document.getElementById('prevPage').disabled = this.state.currentPage === 1;
        document.getElementById('nextPage').disabled = this.state.currentPage === this.state.totalPages;
        document.getElementById('lastPage').disabled = this.state.currentPage === this.state.totalPages;
        
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
            this.updateAnomaliesTable();
            this.updatePagination();
        }
    }

    /**
     * Show anomaly details modal
     */
    async showAnomalyDetails(anomalyId) {
        try {
            const anomaly = this.state.anomalies.find(a => a.id === anomalyId);
            if (!anomaly) {
                throw new Error('Anomaly not found');
            }
            
            const modal = document.getElementById('anomalyModal');
            const content = document.getElementById('modalContent');
            
            content.innerHTML = this.createAnomalyDetailContent(anomaly);
            modal.classList.remove('hidden');
            
        } catch (error) {
            this.showError('Failed to load anomaly details: ' + error.message);
        }
    }

    /**
     * Create anomaly detail content
     */
    createAnomalyDetailContent(anomaly) {
        const timestamp = new Date(anomaly.execution_start_time).toLocaleString();
        const dataStart = new Date(anomaly.data_start_time).toLocaleString();
        const dataEnd = new Date(anomaly.data_end_time).toLocaleString();
        const detectorName = anomaly.detector_name || anomaly.detector_id;
        
        return `
            <div class="anomaly-detail-grid">
                <div class="detail-card">
                    <h4 class="detail-card-title">Basic Information</h4>
                    <div class="detail-item">
                        <div class="detail-label">Anomaly ID</div>
                        <div class="detail-value font-mono">${anomaly.id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Detector</div>
                        <div class="detail-value">${detectorName}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Detector ID</div>
                        <div class="detail-value font-mono">${anomaly.detector_id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Model ID</div>
                        <div class="detail-value font-mono">${anomaly.model_id}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Execution Time</div>
                        <div class="detail-value">${timestamp}</div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4 class="detail-card-title">Anomaly Metrics</h4>
                    <div class="detail-item">
                        <div class="detail-label">Anomaly Grade</div>
                        <div class="detail-value">
                            <span class="anomaly-badge ${this.getAnomalyGradeClass(anomaly.anomaly_grade)}">
                                ${anomaly.anomaly_grade.toFixed(4)}
                            </span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Anomaly Score</div>
                        <div class="detail-value">${anomaly.anomaly_score.toFixed(4)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Confidence</div>
                        <div class="detail-value">
                            <span class="confidence-badge ${this.getConfidenceClass(anomaly.confidence)}">
                                ${anomaly.confidence.toFixed(4)}
                            </span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Threshold</div>
                        <div class="detail-value">${anomaly.threshold}</div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4 class="detail-card-title">Time Range</h4>
                    <div class="detail-item">
                        <div class="detail-label">Data Start</div>
                        <div class="detail-value">${dataStart}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Data End</div>
                        <div class="detail-value">${dataEnd}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Analysis Window</div>
                        <div class="detail-value">${((anomaly.data_end_time - anomaly.data_start_time) / 60000).toFixed(0)} minutes</div>
                    </div>
                </div>
                
                <div class="detail-card full-width">
                    <h4 class="detail-card-title">Feature Data</h4>
                    <div class="feature-grid">
                        ${Object.entries(anomaly.feature_data).map(([feature, value]) => `
                            <div class="feature-item">
                                <div class="feature-name">${feature}</div>
                                <div class="feature-value">${value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                ${anomaly.relevant_attribution?.length ? `
                <div class="detail-card full-width">
                    <h4 class="detail-card-title">Feature Attribution</h4>
                    <div class="attribution-grid">
                        ${anomaly.relevant_attribution.map(attr => `
                            <div class="attribution-item">
                                <div class="attribution-feature">${attr.feature_id}</div>
                                <div class="attribution-value">${attr.data.toFixed(4)}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
                
                ${anomaly.user ? `
                <div class="detail-card">
                    <h4 class="detail-card-title">User Context</h4>
                    <div class="detail-item">
                        <div class="detail-label">Username</div>
                        <div class="detail-value">${anomaly.user.name || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Roles</div>
                        <div class="detail-value">${anomaly.user.roles?.join(', ') || 'N/A'}</div>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Close modal
     */
    closeModal() {
        document.getElementById('anomalyModal').classList.add('hidden');
    }

    /**
     * Update summary cards
     */
    updateSummaryCards(summary) {
        document.getElementById('totalAnomalies').textContent = 
            summary?.total_anomalies?.toLocaleString() || '0';
        document.getElementById('highConfidence').textContent = 
            summary?.high_confidence_anomalies?.toLocaleString() || '0';
        document.getElementById('activeDetectors').textContent = 
            summary?.active_detectors?.toLocaleString() || '0';
        document.getElementById('avgGrade').textContent = 
            summary?.avg_anomaly_grade?.toFixed(3) || '0.000';
        document.getElementById('avgConfidence').textContent = 
            summary?.avg_confidence?.toFixed(3) || '0.000';
    }

    /**
     * Initialize charts
     */
    initializeCharts() {
        this.charts = {
            anomaliesOverTime: this.createTimeSeriesChart('anomaliesOverTimeChart'),
            gradeVsConfidence: this.createEnhancedScatterChart('gradeVsConfidenceChart')
        };
    }

    /**
     * Create time series chart
     */
    createTimeSeriesChart(canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        return new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Behaviour Anomalies',
                    data: [],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true,
                    borderWidth: 3,
                    pointBackgroundColor: '#3b82f6',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#f8fafc',
                            font: { size: 12 }
                        }
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f8fafc',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(59, 130, 246, 0.5)',
                        borderWidth: 1
                    }
                },
                scales: {
                    x: { 
                        title: { 
                            display: true, 
                            text: 'Date',
                            color: '#94a3b8'
                        },
                        grid: { 
                            color: 'rgba(255, 255, 255, 0.1)',
                            borderColor: 'rgba(255, 255, 255, 0.2)'
                        },
                        ticks: { color: '#94a3b8' }
                    },
                    y: { 
                        title: { 
                            display: true, 
                            text: 'Number of Anomalies',
                            color: '#94a3b8'
                        },
                        beginAtZero: true,
                        grid: { 
                            color: 'rgba(255, 255, 255, 0.1)',
                            borderColor: 'rgba(255, 255, 255, 0.2)'
                        },
                        ticks: { color: '#94a3b8' }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                animations: {
                    tension: {
                        duration: 1000,
                        easing: 'linear'
                    }
                }
            }
        });
    }

    /**
     * Create enhanced scatter chart for grade vs confidence
     */
    createEnhancedScatterChart(canvasId) {
        const ctx = document.getElementById(canvasId).getContext('2d');
        
        // Create gradient for the background
        const gradient = ctx.createLinearGradient(0, 0, 0, 400);
        gradient.addColorStop(0, 'rgba(239, 68, 68, 0.1)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0.1)');
        
        return new Chart(ctx, {
            type: 'scatter',
            data: {
                datasets: [{
                    label: 'High Risk',
                    data: [],
                    backgroundColor: 'rgba(239, 68, 68, 0.8)',
                    borderColor: 'rgba(239, 68, 68, 1)',
                    borderWidth: 2,
                    pointRadius: 6,
                    pointHoverRadius: 10,
                    pointStyle: 'circle'
                }, {
                    label: 'Medium Risk',
                    data: [],
                    backgroundColor: 'rgba(245, 158, 11, 0.7)',
                    borderColor: 'rgba(245, 158, 11, 1)',
                    borderWidth: 2,
                    pointRadius: 5,
                    pointHoverRadius: 8,
                    pointStyle: 'circle'
                }, {
                    label: 'Low Risk',
                    data: [],
                    backgroundColor: 'rgba(59, 130, 246, 0.6)',
                    borderColor: 'rgba(59, 130, 246, 1)',
                    borderWidth: 2,
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    pointStyle: 'circle'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#f8fafc',
                            font: { size: 12 },
                            usePointStyle: true,
                            padding: 20
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const point = context.raw;
                                return [
                                    `Grade: ${point.x.toFixed(3)}`,
                                    `Confidence: ${point.y.toFixed(3)}`,
                                    `Detector: ${point.detector || 'Unknown'}`,
                                    `Risk: ${point.riskLevel || 'Unknown'}`
                                ];
                            }
                        },
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#f8fafc',
                        bodyColor: '#e2e8f0',
                        borderColor: 'rgba(59, 130, 246, 0.5)',
                        borderWidth: 1,
                        displayColors: false
                    },
                    annotation: {
                        annotations: {
                            highRiskZone: {
                                type: 'box',
                                xMin: 0.7,
                                xMax: 1.0,
                                yMin: 0.7,
                                yMax: 1.0,
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                borderColor: 'rgba(239, 68, 68, 0.3)',
                                borderWidth: 1
                            },
                            mediumRiskZone: {
                                type: 'box',
                                xMin: 0.5,
                                xMax: 0.7,
                                yMin: 0.5,
                                yMax: 0.7,
                                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                                borderColor: 'rgba(245, 158, 11, 0.3)',
                                borderWidth: 1
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: { 
                            display: true, 
                            text: 'Behaviour Anomaly Grade',
                            color: '#94a3b8',
                            font: { size: 12, weight: 'bold' }
                        },
                        min: 0,
                        max: 1,
                        grid: { 
                            color: 'rgba(255, 255, 255, 0.1)',
                            borderColor: 'rgba(255, 255, 255, 0.2)'
                        },
                        ticks: { 
                            color: '#94a3b8',
                            stepSize: 0.2,
                            callback: function(value) {
                                return value.toFixed(1);
                            }
                        }
                    },
                    y: {
                        title: { 
                            display: true, 
                            text: 'Confidence Level',
                            color: '#94a3b8',
                            font: { size: 12, weight: 'bold' }
                        },
                        min: 0,
                        max: 1,
                        grid: { 
                            color: 'rgba(255, 255, 255, 0.1)',
                            borderColor: 'rgba(255, 255, 255, 0.2)'
                        },
                        ticks: { 
                            color: '#94a3b8',
                            stepSize: 0.2,
                            callback: function(value) {
                                return value.toFixed(1);
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'nearest'
                },
                elements: {
                    point: {
                        hoverBackgroundColor: '#ffffff',
                        hoverBorderColor: '#000000',
                        hoverBorderWidth: 2
                    }
                }
            }
        });
    }

    /**
     * Update charts with new data
     */
    updateCharts(chartsData) {
        // Update time series chart
        if (this.charts.anomaliesOverTime && chartsData.anomalies_over_time) {
            const labels = Object.keys(chartsData.anomalies_over_time).reverse();
            const data = Object.values(chartsData.anomalies_over_time).reverse();
            
            this.charts.anomaliesOverTime.data.labels = labels;
            this.charts.anomaliesOverTime.data.datasets[0].data = data;
            this.charts.anomaliesOverTime.update('none');
        }

        // Update enhanced scatter chart
        if (this.charts.gradeVsConfidence && this.state.anomalies.length > 0) {
            const highRiskData = [];
            const mediumRiskData = [];
            const lowRiskData = [];
            
            this.state.anomalies.forEach(anomaly => {
                const point = {
                    x: anomaly.anomaly_grade,
                    y: anomaly.confidence,
                    detector: anomaly.detector_name || anomaly.detector_id,
                    riskLevel: this.getRiskLevel(anomaly.anomaly_grade, anomaly.confidence)
                };
                
                if (anomaly.anomaly_grade >= 0.7 && anomaly.confidence >= 0.7) {
                    highRiskData.push(point);
                } else if (anomaly.anomaly_grade >= 0.5 && anomaly.confidence >= 0.5) {
                    mediumRiskData.push(point);
                } else {
                    lowRiskData.push(point);
                }
            });
            
            this.charts.gradeVsConfidence.data.datasets[0].data = highRiskData;
            this.charts.gradeVsConfidence.data.datasets[1].data = mediumRiskData;
            this.charts.gradeVsConfidence.data.datasets[2].data = lowRiskData;
            this.charts.gradeVsConfidence.update('none');
        }
    }

    /**
     * Get risk level based on grade and confidence
     */
    getRiskLevel(grade, confidence) {
        if (grade >= 0.7 && confidence >= 0.7) return 'High';
        if (grade >= 0.5 && confidence >= 0.5) return 'Medium';
        return 'Low';
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
     * Export anomalies
     */
    exportAnomalies() {
        const data = this.state.filteredAnomalies.length > 0 ? this.state.filteredAnomalies : this.state.anomalies;
        const csv = this.convertToCSV(data);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `uba-anomalies-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    }

    /**
     * Convert data to CSV
     */
    convertToCSV(data) {
        const headers = ['Timestamp', 'Anomaly Grade', 'Confidence', 'Detector ID', 'Detector Name', 'Features'];
        const rows = data.map(anomaly => [
            new Date(anomaly.execution_start_time).toISOString(),
            anomaly.anomaly_grade,
            anomaly.confidence,
            anomaly.detector_id,
            anomaly.detector_name || anomaly.detector_id,
            Object.entries(anomaly.feature_data).map(([k, v]) => `${k}:${v}`).join(';')
        ]);
        
        return [headers, ...rows].map(row => row.join(',')).join('\n');
    }

    /**
     * Get anomaly grade class
     */
    getAnomalyGradeClass(grade) {
        if (grade >= 0.8) return 'anomaly-critical';
        if (grade >= 0.5) return 'anomaly-high';
        if (grade >= 0.3) return 'anomaly-medium';
        return 'anomaly-low';
    }

    /**
     * Get anomaly grade level
     */
    getAnomalyGradeLevel(grade) {
        if (grade >= 0.8) return 'critical';
        if (grade >= 0.5) return 'high';
        if (grade >= 0.3) return 'medium';
        return 'low';
    }

    /**
     * Get confidence class
     */
    getConfidenceClass(confidence) {
        if (confidence >= 0.8) return 'confidence-high';
        if (confidence >= 0.5) return 'confidence-medium';
        return 'confidence-low';
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
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-notification';
        errorDiv.innerHTML = `
            <div style="background: var(--danger-color); color: white; padding: 1rem; border-radius: var(--radius-md); margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
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
        
        setTimeout(() => {
            if (errorDiv.parentElement) {
                errorDiv.remove();
            }
        }, 5000);
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

// Initialize UBA dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.ubaDashboard = new UBADashboard();
});
