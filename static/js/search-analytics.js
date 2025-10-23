// Search & Analytics Dashboard Application
class SearchAnalytics {
    constructor() {
        this.currentPage = 1;
        this.itemsPerPage = 25;
        this.currentData = [];
        this.filteredData = [];
        this.sortField = 'timestamp';
        this.sortDirection = 'desc';
        this.autoRefreshInterval = null;
        this.isAutoRefresh = false;
        this.activeFilters = []; // Store active filters
        
        this.init();
    }

    init() {
        console.log("🔍 Search Analytics initializing...");
        this.bindEvents();
        this.testConnection();
        this.loadSearchFields();
        this.loadSavedSearches();
        this.setupAdvancedFilters();
        
        setTimeout(() => {
            console.log("🔍 Initialization complete");
        }, 1000);
    }

    setupAdvancedFilters() {
        // Initialize with one filter row
        this.filterCounter = 1;
    }

    bindEvents() {
        console.log("🔍 Binding Search Analytics events...");
        
        // Refresh button
        const refreshBtn = document.getElementById('refreshBtn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                console.log("🔍 Refresh button clicked");
                this.executeSearch();
            });
        }

        // Search button
        const searchButton = document.getElementById('searchButton');
        if (searchButton) {
            searchButton.addEventListener('click', () => {
                this.executeSearch();
            });
        }

        // Search input (Enter key)
        const searchQuery = document.getElementById('searchQuery');
        if (searchQuery) {
            searchQuery.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.executeSearch();
                }
            });
        }

        // Clear button
        const clearButton = document.getElementById('clearButton');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.clearSearch();
            });
        }

        // Field selector change
        const fieldSelector = document.getElementById('fieldSelector');
        if (fieldSelector) {
            fieldSelector.addEventListener('change', (e) => {
                if (e.target.value) {
                    document.getElementById('searchQuery').placeholder = `Enter keyword for ${e.target.value}...`;
                    document.getElementById('searchQuery').focus();
                } else {
                    document.getElementById('searchQuery').placeholder = 'Enter search keyword...';
                }
            });
        }

        // Saved searches button
        const savedSearchesButton = document.getElementById('savedSearchesButton');
        if (savedSearchesButton) {
            savedSearchesButton.addEventListener('click', () => {
                this.showSavedSearches();
            });
        }

        // Export results button
        const exportResultsBtn = document.getElementById('exportResultsBtn');
        if (exportResultsBtn) {
            exportResultsBtn.addEventListener('click', () => {
                this.exportResults();
            });
        }

        // Auto refresh button
        const autoRefreshBtn = document.getElementById('autoRefreshBtn');
        if (autoRefreshBtn) {
            autoRefreshBtn.addEventListener('click', () => {
                this.toggleAutoRefresh();
            });
        }

        // Advanced Filters Events
        const addFilterBtn = document.getElementById('addFilterBtn');
        if (addFilterBtn) {
            addFilterBtn.addEventListener('click', () => {
                this.addFilterRow();
            });
        }

        const applyFiltersBtn = document.getElementById('applyFiltersBtn');
        if (applyFiltersBtn) {
            applyFiltersBtn.addEventListener('click', () => {
                this.applyAdvancedFilters();
            });
        }

        const clearFiltersBtn = document.getElementById('clearFiltersBtn');
        if (clearFiltersBtn) {
            clearFiltersBtn.addEventListener('click', () => {
                this.clearAdvancedFilters();
            });
        }

        // Table sorting
        document.querySelectorAll('th[data-sort]').forEach(th => {
            th.addEventListener('click', () => {
                const field = th.getAttribute('data-sort');
                console.log("🔍 Sorting by:", field);
                this.sortTable(field);
            });
        });
        
        // Modal close buttons
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closeModal();
            });
        }

        const closeSavedSearchesModal = document.getElementById('closeSavedSearchesModal');
        if (closeSavedSearchesModal) {
            closeSavedSearchesModal.addEventListener('click', () => {
                this.closeModal('savedSearchesModal');
            });
        }

        const closeSearchHelpModal = document.getElementById('closeSearchHelpModal');
        if (closeSearchHelpModal) {
            closeSearchHelpModal.addEventListener('click', () => {
                this.closeModal('searchHelpModal');
            });
        }

        console.log("✅ Search Analytics events bound successfully");
    }

    // Advanced Filters Methods
    addFilterRow() {
        this.filterCounter++;
        const filtersContainer = document.getElementById('filtersContainer');
        
        const filterRow = document.createElement('div');
        filterRow.className = 'filter-row';
        filterRow.setAttribute('data-filter-id', this.filterCounter.toString());
        
        filterRow.innerHTML = `
            <div class="filter-field-group">
                <label class="control-label">Field</label>
                <select class="control-select filter-field">
                    <option value="">Select Field...</option>
                    <optgroup label="Basic Fields">
                        <option value="agent.name">Agent Name</option>
                        <option value="agent.id">Agent ID</option>
                        <option value="agent.ip">Agent IP</option>
                        <option value="rule.level">Severity Level</option>
                        <option value="rule.description">Rule Description</option>
                    </optgroup>
                    <optgroup label="MITRE ATT&CK">
                        <option value="rule.mitre.tactic">MITRE Tactic</option>
                        <option value="rule.mitre.id">MITRE Technique ID</option>
                    </optgroup>
                    <optgroup label="File Integrity">
                        <option value="syscheck.event">FIM Event Type</option>
                        <option value="syscheck.path">File Path</option>
                    </optgroup>
                </select>
            </div>
            
            <div class="filter-operator-group">
                <label class="control-label">Operator</label>
                <select class="control-select filter-operator">
                    <option value="equals">Equals</option>
                    <option value="contains">Contains</option>
                    <option value="starts_with">Starts With</option>
                    <option value="ends_with">Ends With</option>
                    <option value="greater_than">Greater Than</option>
                    <option value="less_than">Less Than</option>
                    <option value="exists">Exists</option>
                    <option value="not_exists">Not Exists</option>
                </select>
            </div>
            
            <div class="filter-value-group">
                <label class="control-label">Value</label>
                <input type="text" class="control-input filter-value" placeholder="Enter value...">
            </div>
            
            <div class="filter-actions">
                <button class="btn btn-danger filter-remove" title="Remove Filter">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        filtersContainer.appendChild(filterRow);
        
        // Add event listener for remove button
        const removeBtn = filterRow.querySelector('.filter-remove');
        removeBtn.addEventListener('click', () => {
            this.removeFilterRow(this.filterCounter);
        });
    }

    removeFilterRow(filterId) {
        const filterRow = document.querySelector(`[data-filter-id="${filterId}"]`);
        if (filterRow) {
            filterRow.remove();
            // Also remove from active filters if it was applied
            this.activeFilters = this.activeFilters.filter(f => f.id !== filterId);
            this.updateActiveFiltersDisplay();
        }
    }

    applyAdvancedFilters() {
        const filterRows = document.querySelectorAll('.filter-row');
        const filters = [];
        
        filterRows.forEach((row, index) => {
            const field = row.querySelector('.filter-field').value;
            const operator = row.querySelector('.filter-operator').value;
            const value = row.querySelector('.filter-value').value;
            const filterId = row.getAttribute('data-filter-id');
            
            if (field && operator) {
                // For exists/not_exists operators, value is not required
                if ((operator === 'exists' || operator === 'not_exists') || value.trim()) {
                    filters.push({
                        id: filterId,
                        field: field,
                        operator: operator,
                        value: value.trim(),
                        display: this.getFilterDisplayText(field, operator, value)
                    });
                }
            }
        });
        
        this.activeFilters = filters;
        this.updateActiveFiltersDisplay();
        this.applyFiltersToData();
    }

    getFilterDisplayText(field, operator, value) {
        const operatorSymbols = {
            'equals': '=',
            'contains': 'contains',
            'starts_with': 'starts with',
            'ends_with': 'ends with',
            'greater_than': '>',
            'less_than': '<',
            'exists': 'exists',
            'not_exists': 'not exists'
        };
        
        const operatorText = operatorSymbols[operator] || operator;
        
        if (operator === 'exists' || operator === 'not_exists') {
            return `${field} ${operatorText}`;
        }
        
        return `${field} ${operatorText} "${value}"`;
    }

    updateActiveFiltersDisplay() {
        const activeFiltersContainer = document.getElementById('activeFilters');
        activeFiltersContainer.innerHTML = '';
        
        this.activeFilters.forEach(filter => {
            const filterTag = document.createElement('div');
            filterTag.className = 'filter-tag';
            filterTag.innerHTML = `
                <span>${filter.display}</span>
                <button class="filter-tag-remove" data-filter-id="${filter.id}">
                    <i class="fas fa-times"></i>
                </button>
            `;
            
            activeFiltersContainer.appendChild(filterTag);
            
            // Add event listener to remove individual filter
            const removeBtn = filterTag.querySelector('.filter-tag-remove');
            removeBtn.addEventListener('click', () => {
                this.removeActiveFilter(filter.id);
            });
        });
    }

    removeActiveFilter(filterId) {
        this.activeFilters = this.activeFilters.filter(f => f.id !== filterId);
        this.updateActiveFiltersDisplay();
        this.applyFiltersToData();
    }

    clearAdvancedFilters() {
        this.activeFilters = [];
        this.updateActiveFiltersDisplay();
        
        // Clear all filter inputs
        const filterRows = document.querySelectorAll('.filter-row');
        filterRows.forEach(row => {
            row.querySelector('.filter-field').value = '';
            row.querySelector('.filter-operator').value = 'equals';
            row.querySelector('.filter-value').value = '';
        });
        
        // Reset to original data
        this.filteredData = [...this.currentData];
        this.currentPage = 1;
        this.renderTable();
        this.updatePagination();
        
        console.log('✅ Cleared all advanced filters');
    }

    applyFiltersToData() {
        console.log('🔍 applyFiltersToData called');
        console.log('📊 currentData length:', this.currentData.length);
        console.log('📊 activeFilters count:', this.activeFilters.length);
        
        if (this.activeFilters.length === 0) {
            this.filteredData = [...this.currentData];
            console.log('📊 No filters applied, filteredData:', this.filteredData.length);
        } else {
            let filtered = [...this.currentData];
            
            console.log('🔍 Applying filters:', this.activeFilters);
            
            this.activeFilters.forEach((filter, index) => {
                const beforeCount = filtered.length;
                filtered = filtered.filter(hit => {
                    return this.evaluateFilter(hit, filter);
                });
                const afterCount = filtered.length;
                console.log(`🔍 Filter ${index + 1} (${filter.display}): ${beforeCount} → ${afterCount} events`);
            });
            
            this.filteredData = filtered;
            console.log('📊 Final filteredData:', this.filteredData.length);
        }
        
        this.currentPage = 1;
        this.renderTable();
        this.updatePagination();
        
        console.log(`✅ Applied ${this.activeFilters.length} filters: ${this.filteredData.length} events remaining`);
    }

    evaluateFilter(hit, filter) {
        const source = hit.data || {};
        let fieldValue = this.getNestedValue(source, filter.field);
        
        console.log(`🔍 Evaluating filter: ${filter.field} ${filter.operator} "${filter.value}"`);
        console.log(`🔍 Field value: "${fieldValue}"`);
        
        // Convert to string for comparison (except for numeric fields)
        if (filter.field === 'rule.level' || filter.field === 'data.win.system.eventID') {
            fieldValue = parseFloat(fieldValue) || 0;
            const filterValue = parseFloat(filter.value) || 0;
            
            console.log(`🔍 Numeric comparison: ${fieldValue} ${filter.operator} ${filterValue}`);
            
            switch (filter.operator) {
                case 'equals': return fieldValue === filterValue;
                case 'greater_than': return fieldValue > filterValue;
                case 'less_than': return fieldValue < filterValue;
                default: return true;
            }
        } else {
            // String field comparison
            fieldValue = String(fieldValue || '').toLowerCase();
            const filterValue = filter.value.toLowerCase();
            
            console.log(`🔍 String comparison: "${fieldValue}" ${filter.operator} "${filterValue}"`);
            
            switch (filter.operator) {
                case 'equals': return fieldValue === filterValue;
                case 'contains': return fieldValue.includes(filterValue);
                case 'starts_with': return fieldValue.startsWith(filterValue);
                case 'ends_with': return fieldValue.endsWith(filterValue);
                case 'exists': 
                    const exists = fieldValue !== '' && fieldValue !== 'undefined' && fieldValue !== 'null';
                    console.log(`🔍 Exists check: ${exists}`);
                    return exists;
                case 'not_exists': 
                    const notExists = fieldValue === '' || fieldValue === 'undefined' || fieldValue === 'null';
                    console.log(`🔍 Not exists check: ${notExists}`);
                    return notExists;
                default: return true;
            }
        }
    }

    getNestedValue(obj, path) {
        try {
            return path.split('.').reduce((current, key) => {
                if (current && typeof current === 'object' && key in current) {
                    return current[key];
                }
                return '';
            }, obj);
        } catch (error) {
            console.error(`❌ Error getting nested value for path ${path}:`, error);
            return '';
        }
    }

    // Existing Methods
    async loadSearchFields() {
        try {
            const response = await fetch('/api/search/fields');
            const data = await response.json();
            
            if (data.success && data.fields) {
                this.populateFieldSelector(data.fields);
            } else {
                this.populateStaticFields();
            }
        } catch (error) {
            console.error('Failed to load search fields:', error);
            this.populateStaticFields();
        }
    }

    populateFieldSelector(fields) {
        const fieldSelector = document.getElementById('fieldSelector');
        if (!fieldSelector) return;

        fieldSelector.innerHTML = '<option value="">Select Field...</option>';
        
        const categories = {};
        fields.forEach(field => {
            if (!categories[field.category]) {
                categories[field.category] = [];
            }
            categories[field.category].push(field);
        });

        Object.keys(categories).forEach(category => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category;
            
            categories[category].forEach(field => {
                const option = document.createElement('option');
                option.value = field.name;
                option.textContent = `${field.name} (${field.type})`;
                option.title = field.description;
                optgroup.appendChild(option);
            });
            
            fieldSelector.appendChild(optgroup);
        });

        console.log("✅ Field selector populated with", fields.length, "fields");
    }

    populateStaticFields() {
        const fieldSelector = document.getElementById('fieldSelector');
        if (!fieldSelector) return;

        const staticFields = [
            { category: "Basic", name: "agent.name", type: "keyword", description: "Agent Name" },
            { category: "Basic", name: "agent.id", type: "keyword", description: "Agent ID" },
            { category: "Basic", name: "agent.ip", type: "ip", description: "Agent IP" },
            { category: "Basic", name: "rule.level", type: "integer", description: "Severity Level" },
            { category: "Basic", name: "rule.description", type: "text", description: "Rule Description" },
            { category: "MITRE", name: "rule.mitre.tactic", type: "keyword", description: "MITRE Tactic" },
            { category: "FIM", name: "syscheck.event", type: "keyword", description: "FIM Event Type" },
            { category: "Windows", name: "data.win.system.eventID", type: "integer", description: "Windows Event ID" },
            { category: "Network", name: "data.srcip", type: "ip", description: "Source IP" }
        ];

        this.populateFieldSelector(staticFields);
    }

    async executeSearch() {
        const fieldSelector = document.getElementById('fieldSelector');
        const searchValue = document.getElementById('searchQuery').value.trim();
        const selectedField = fieldSelector.value;
        
        let query = '';
        
        // Build query based on field selection
        if (selectedField && searchValue) {
            // Field-specific search
            query = `${selectedField}:${searchValue}`;
        } else if (searchValue) {
            // General search without field selection - search across multiple fields
            query = searchValue;
        } else {
            // No search value - show all results
            query = '';
        }

        const timeRange = document.getElementById('timeRangeFilter').value;
        const resultSize = parseInt(document.getElementById('resultSize').value);

        console.log("🔍 Executing search:", { query, selectedField, searchValue, timeRange, resultSize });

        let startTime, endTime;
        if (timeRange === 'custom') {
            startTime = document.getElementById('startDate').value;
            endTime = document.getElementById('endDate').value;
            if (!startTime || !endTime) {
                this.showError('Please select both start and end time for custom range');
                return;
            }
            startTime = new Date(startTime).toISOString();
            endTime = new Date(endTime).toISOString();
        }

        const searchData = {
            query: query,
            time_range: timeRange,
            start_time: startTime,
            end_time: endTime,
            size: resultSize,
            from: (this.currentPage - 1) * this.itemsPerPage
        };

        console.log("🔍 Sending search request:", searchData);
        this.showLoading();
        
        try {
            const response = await fetch('/api/search/query', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(searchData)
            });

            console.log("🔍 Response status:", response.status);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const result = await response.json();
            console.log('✅ Search API response:', result);
            
            if (!result.success) {
                throw new Error(result.error || 'Search failed');
            }
            
            this.displayResults(result);
            
        } catch (error) {
            console.error('❌ Search execution failed:', error);
            this.showError('Search failed: ' + error.message);
            this.currentData = [];
            this.filteredData = [];
            this.displayResults({
                success: false,
                error: error.message,
                hits: [],
                total: 0
            });
        } finally {
            this.hideLoading();
        }
    }

    displayResults(result) {
        console.log("🔍 Displaying results:", result);
        
        if (!result.success) {
            console.error("❌ API returned error:", result.error);
            this.showError(result.error);
            return;
        }

        console.log("📊 Total results:", result.total);
        console.log("📊 Hits count:", result.hits?.length);

        if (result.total === 0 || result.hits.length === 0) {
            console.log("🔍 No results found, showing empty state");
            this.showEmptyState();
            return;
        }

        console.log("🔍 Results found, displaying data...");
        
        this.hideEmptyState();
        this.showResultsSections();
        
        // Store the raw data first
        this.currentData = result.hits || [];
        console.log('📊 Stored currentData:', this.currentData.length);
        
        // Then apply any existing filters
        if (this.activeFilters.length > 0) {
            console.log('🔍 Applying existing filters to new data');
            this.applyFiltersToData();
        } else {
            // No filters, just use all data
            this.filteredData = [...this.currentData];
            console.log('📊 No filters, filteredData:', this.filteredData.length);
            this.renderTable();
            this.updatePagination();
        }
        
        this.updateSummaryMetrics(result);
        this.updateLastUpdate();
        
        console.log("✅ Results displayed successfully");
    }

    showResultsSections() {
        const elements = {
            'resultsSummary': 'grid',
            'resultsSection': 'block',
            'quickSearchExamples': 'none',
            'emptyState': 'none'
        };

        Object.entries(elements).forEach(([id, display]) => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = display;
                element.classList.remove('hidden');
            }
        });
    }

    updateSummaryMetrics(result) {
        console.log("🔍 Updating summary metrics:", result);
        
        const metrics = {
            'totalResults': result.total?.toLocaleString() || '0',
            'highSeverityAlerts': this.countHighSeverityAlerts(result.hits || []),
            'uniqueAgents': this.countUniqueAgents(result.hits || []),
            'searchTime': `${result.took || 0}ms`,
            'mitreTactics': this.countMitreTactics(result.hits || [])
        };

        Object.entries(metrics).forEach(([key, value]) => {
            const element = document.getElementById(key);
            if (element) {
                element.textContent = value;
            }
        });
    }

    countHighSeverityAlerts(hits) {
        return hits.filter(hit => {
            const severity = hit.data?.rule?.level || 0;
            return severity >= 10;
        }).length;
    }

    countUniqueAgents(hits) {
        const agents = new Set();
        hits.forEach(hit => {
            const agentName = hit.data?.agent?.name;
            if (agentName) {
                agents.add(agentName);
            }
        });
        return agents.size;
    }

    countMitreTactics(hits) {
        const tactics = new Set();
        hits.forEach(hit => {
            const mitreTactics = hit.data?.rule?.mitre?.tactic || [];
            mitreTactics.forEach(tactic => tactics.add(tactic));
        });
        return tactics.size;
    }

    renderTable() {
        const tbody = document.getElementById('searchResultsBody');
        if (!tbody) {
            console.error("❌ Search results table body not found");
            return;
        }

        console.log('🔍 renderTable called');
        console.log('📊 filteredData length:', this.filteredData.length);
        console.log('📊 currentPage:', this.currentPage);
        
        const startIndex = (this.currentPage - 1) * this.itemsPerPage;
        const endIndex = startIndex + this.itemsPerPage;
        const pageData = this.filteredData.slice(startIndex, endIndex);
        
        console.log('📊 pageData to render:', pageData.length);

        if (pageData.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" class="no-data">
                        <i class="fas fa-search"></i>
                        No search results found matching your filters
                    </td>
                </tr>
            `;
            return;
        }

        tbody.innerHTML = pageData.map((hit, index) => {
            const source = hit.data || {};
            const severity = source.rule?.level || 0;
            const agentName = source.agent?.name || 'Unknown';
            const agentIp = source.agent?.ip || 'N/A';
            const ruleDescription = source.rule?.description || 'No description';
            const ruleId = source.rule?.id || 'N/A';
            const location = source.location || 'N/A';
            const timestamp = hit.timestamp;
            
            return `
                <tr class="alert-row ${this.getSeverityClass(severity)}-alert" data-event-id="${hit.id}">
                    <td>${this.formatTimestamp(timestamp)}</td>
                    <td>
                        <span class="severity-badge ${this.getSeverityClass(severity)}">
                            ${severity}
                        </span>
                    </td>
                    <td>
                        <div class="agent-info">
                            <div class="agent-name">${agentName}</div>
                            <div class="agent-ip">${agentIp}</div>
                        </div>
                    </td>
                    <td class="description-cell">${this.truncateText(ruleDescription, 80)}</td>
                    <td class="rule-id-cell">${ruleId}</td>
                    <td>${location}</td>
                    <td>
                        <button class="btn btn-outline" onclick="searchAnalytics.showEventDetails('${hit.id}')" style="padding: 0.5rem; font-size: 0.75rem;">
                            <i class="fas fa-search"></i>
                            Details
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

        console.log("🔍 Table HTML created, rows:", tbody.children.length);
        
        const resultsSection = document.getElementById('resultsSection');
        if (resultsSection) {
            resultsSection.style.display = 'block';
        }
    }

    truncateText(text, maxLength) {
        if (!text) return 'N/A';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    getSeverityClass(severity) {
        if (severity >= 12) return 'critical';
        if (severity >= 10) return 'high';
        if (severity >= 7) return 'medium';
        if (severity >= 4) return 'low';
        return 'info';
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredData.length / this.itemsPerPage);
        const paginationInfo = document.getElementById('paginationInfo');
        const startItem = (this.currentPage - 1) * this.itemsPerPage + 1;
        const endItem = Math.min(this.currentPage * this.itemsPerPage, this.filteredData.length);

        if (paginationInfo) {
            paginationInfo.textContent = `Showing ${startItem}-${endItem} of ${this.filteredData.length} results`;
        }

        document.getElementById('firstPage').disabled = this.currentPage === 1;
        document.getElementById('prevPage').disabled = this.currentPage === 1;
        document.getElementById('nextPage').disabled = this.currentPage === totalPages;
        document.getElementById('lastPage').disabled = this.currentPage === totalPages;

        this.updatePageNumbers(totalPages);

        const paginationSection = document.getElementById('paginationSection');
        if (paginationSection && totalPages > 1) {
            paginationSection.style.display = 'flex';
        }
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
            let aValue, bValue;

            if (field === 'timestamp') {
                aValue = new Date(a.timestamp);
                bValue = new Date(b.timestamp);
            } else if (field === 'severity') {
                aValue = a.data?.rule?.level || 0;
                bValue = b.data?.rule?.level || 0;
            } else if (field === 'agent_name') {
                aValue = a.data?.agent?.name || '';
                bValue = b.data?.agent?.name || '';
            } else if (field === 'rule_description') {
                aValue = a.data?.rule?.description || '';
                bValue = b.data?.rule?.description || '';
            } else if (field === 'rule_id') {
                aValue = a.data?.rule?.id || '';
                bValue = b.data?.rule?.id || '';
            } else if (field === 'location') {
                aValue = a.data?.location || '';
                bValue = b.data?.location || '';
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

    createAlertDetailContent(event) {
        const source = event.data || {};
        const severity = source.rule?.level || 0;
        const severityClass = this.getSeverityClass(severity);
        const timestamp = new Date(event.timestamp).toLocaleString();
        
        return `
            <div class="alert-detail-grid">
                <div class="detail-card">
                    <h4 class="detail-card-title">Basic Information</h4>
                    <div class="detail-item">
                        <div class="detail-label">Timestamp</div>
                        <div class="detail-value">${timestamp}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Index</div>
                        <div class="detail-value font-mono">${this.escapeHtml(event.index)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Document ID</div>
                        <div class="detail-value font-mono">${this.escapeHtml(event.id)}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Score</div>
                        <div class="detail-value">${event.score || 'N/A'}</div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4 class="detail-card-title">Rule Information</h4>
                    <div class="detail-item">
                        <div class="detail-label">Rule ID</div>
                        <div class="detail-value font-mono">${source.rule?.id || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Level</div>
                        <div class="detail-value">
                            <span class="severity-badge ${severityClass}">
                                ${severity}
                            </span>
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Description</div>
                        <div class="detail-value">${source.rule?.description || 'N/A'}</div>
                    </div>
                    ${source.rule?.mitre ? `
                    <div class="detail-item">
                        <div class="detail-label">MITRE ATT&CK</div>
                        <div class="detail-value">
                            ${(source.rule.mitre.tactic || []).map(tactic => 
                                `<span class="mitre-tag">${tactic}</span>`
                            ).join('')}
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <div class="detail-card">
                    <h4 class="detail-card-title">Agent Information</h4>
                    <div class="detail-item">
                        <div class="detail-label">Agent Name</div>
                        <div class="detail-value">${source.agent?.name || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Agent ID</div>
                        <div class="detail-value">${source.agent?.id || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Agent IP</div>
                        <div class="detail-value">${source.agent?.ip || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Manager</div>
                        <div class="detail-value">${source.manager?.name || 'N/A'}</div>
                    </div>
                </div>
                
                <div class="detail-card">
                    <h4 class="detail-card-title">Event Details</h4>
                    <div class="detail-item">
                        <div class="detail-label">Location</div>
                        <div class="detail-value">${source.location || 'N/A'}</div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Groups</div>
                        <div class="detail-value">
                            ${(source.rule?.groups || []).map(group => 
                                `<span class="mitre-tag" style="background: #3b82f6;">${group}</span>`
                            ).join('')}
                        </div>
                    </div>
                    <div class="detail-item">
                        <div class="detail-label">Full Log</div>
                        <div class="detail-value font-mono" style="word-break: break-all;">${source.full_log || 'N/A'}</div>
                    </div>
                </div>
            </div>
            
            <div class="detail-card" style="grid-column: 1 / -1;">
                <h4 class="detail-card-title">Complete Event Data</h4>
                <pre style="background: rgba(0, 0, 0, 0.3); padding: 1rem; border-radius: var(--radius-md); overflow-x: auto; font-size: 0.75rem; line-height: 1.4; max-height: 400px;">${JSON.stringify(source, null, 2)}</pre>
            </div>
        `;
    }

    closeModal(modalId = 'alertModal') {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    clearSearch() {
        document.getElementById('fieldSelector').value = '';
        document.getElementById('searchQuery').value = '';
        document.getElementById('searchQuery').placeholder = 'Enter search keyword...';
        this.currentData = [];
        this.filteredData = [];
        this.currentPage = 1;
        this.showEmptyState();
    }

    showEmptyState() {
        console.log("🔍 Showing empty state");
        
        const elements = {
            'resultsSummary': 'none',
            'resultsSection': 'none',
            'quickSearchExamples': 'block',
            'emptyState': 'block'
        };

        Object.entries(elements).forEach(([id, display]) => {
            const element = document.getElementById(id);
            if (element) {
                element.style.display = display;
            }
        });
    }

    hideEmptyState() {
        console.log("🔍 Hiding empty state");
        const emptyState = document.getElementById('emptyState');
        const quickSearchExamples = document.getElementById('quickSearchExamples');
        
        if (emptyState) emptyState.style.display = 'none';
        if (quickSearchExamples) quickSearchExamples.style.display = 'none';
    }

    async loadSavedSearches() {
        try {
            const response = await fetch('/api/search/saved');
            const data = await response.json();
            this.displaySavedSearches(data.saved_searches);
        } catch (error) {
            console.error('Failed to load saved searches:', error);
        }
    }

    displaySavedSearches(searches) {
        const container = document.getElementById('savedSearchesList');
        if (container) {
            container.innerHTML = searches.map(search => `
                <div class="saved-search-item">
                    <div class="saved-search-header">
                        <h4>${search.name}</h4>
                        <button class="btn btn-sm btn-primary" onclick="searchAnalytics.loadSavedSearch('${search.query}')">
                            Load
                        </button>
                    </div>
                    <p class="saved-search-desc">${search.description}</p>
                    <code class="saved-search-query">${search.query}</code>
                </div>
            `).join('');
        }
    }

    loadSavedSearch(query) {
        document.getElementById('searchQuery').value = query;
        document.getElementById('fieldSelector').value = '';
        document.getElementById('searchQuery').placeholder = 'Enter search keyword...';
        this.closeModal('savedSearchesModal');
        this.executeSearch();
    }

    loadExample(query) {
        document.getElementById('searchQuery').value = query;
        document.getElementById('fieldSelector').value = '';
        document.getElementById('searchQuery').placeholder = 'Enter search keyword...';
        this.executeSearch();
    }

    showSavedSearches() {
        this.showModal('savedSearchesModal');
    }

    showSearchHelp() {
        this.showModal('searchHelpModal');
    }

    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('hidden');
        }
    }

    toggleAutoRefresh() {
        this.isAutoRefresh = !this.isAutoRefresh;
        const buttonText = document.getElementById('autoRefreshText');
        
        if (this.isAutoRefresh) {
            buttonText.textContent = 'Auto Refresh: On (30s)';
            this.autoRefreshInterval = setInterval(() => {
                if (document.getElementById('searchQuery').value.trim()) {
                    this.executeSearch();
                }
            }, 30000);
        } else {
            buttonText.textContent = 'Auto Refresh: Off';
            if (this.autoRefreshInterval) {
                clearInterval(this.autoRefreshInterval);
                this.autoRefreshInterval = null;
            }
        }
    }

    exportResults() {
        if (!this.filteredData.length) {
            this.showError('No results to export');
            return;
        }
        
        const data = this.filteredData.map(hit => {
            const source = hit.data || {};
            return {
                timestamp: hit.timestamp,
                severity: source.rule?.level || 0,
                agent: source.agent?.name || 'Unknown',
                agent_ip: source.agent?.ip || 'N/A',
                rule_id: source.rule?.id || 'N/A',
                description: source.rule?.description || 'N/A',
                location: source.location || 'N/A',
                manager: source.manager?.name || 'N/A'
            };
        });
        
        const csv = this.convertToCSV(data);
        this.downloadCSV(csv, 'search-results.csv');
    }

    convertToCSV(data) {
        if (!data.length) return '';
        
        const headers = Object.keys(data[0]);
        const csv = [
            headers.join(','),
            ...data.map(row => headers.map(header => 
                `"${String(row[header] || '').replace(/"/g, '""')}"`
            ).join(','))
        ].join('\n');
        
        return csv;
    }

    downloadCSV(csv, filename) {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
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
        console.error('❌ Search Analytics Error:', message);
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

    async testConnection() {
        try {
            const response = await fetch('/api/search/test-connection');
            const result = await response.json();
            
            const systemStatus = document.querySelector('.status-text');
            if (systemStatus) {
                if (result.success) {
                    systemStatus.textContent = 'System Online';
                    systemStatus.style.color = '#10B981';
                } else {
                    systemStatus.textContent = 'System Offline';
                    systemStatus.style.color = '#EF4444';
                }
            }
        } catch (error) {
            console.error('Connection test failed:', error);
            const systemStatus = document.querySelector('.status-text');
            if (systemStatus) {
                systemStatus.textContent = 'Connection Error';
                systemStatus.style.color = '#EF4444';
            }
        }
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("🚀 Search Analytics DOM loaded, initializing...");
    try {
        window.searchAnalytics = new SearchAnalytics();
        console.log("✅ Search Analytics initialized successfully");
    } catch (error) {
        console.error("❌ Search Analytics initialization failed:", error);
    }
});

// Global functions for example queries
function loadExample(query) {
    if (window.searchAnalytics) {
        window.searchAnalytics.loadExample(query);
    }
}

function showSearchHelp() {
    if (window.searchAnalytics) {
        window.searchAnalytics.showSearchHelp();
    }
}

// Test function that can be called from browser console
window.testSearch = function() {
    console.log("🧪 Testing Search Analytics...");
    if (window.searchAnalytics) {
        window.searchAnalytics.executeSearch();
    } else {
        console.error("❌ Search Analytics not initialized");
    }
};
