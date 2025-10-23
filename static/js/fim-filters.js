// FIM Filters Management
class FIMFilters {
    constructor(dashboard) {
        this.dashboard = dashboard;
        this.initFilters();
    }

    initFilters() {
        this.setupTimeFilter();
        this.setupSearchFilter();
        this.setupChangeTypeFilter();
        this.setupAgentFilter();
    }

    setupTimeFilter() {
        const timeRangeFilter = document.getElementById('timeRangeFilter');
        const customDateRange = document.getElementById('customDateRange');

        timeRangeFilter.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customDateRange.style.display = 'block';
            } else {
                customDateRange.style.display = 'none';
                this.dashboard.loadFIMData();
            }
        });

        // Setup date inputs with current time
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - (60 * 60 * 1000));
        
        document.getElementById('startDate').value = this.formatDateForInput(oneHourAgo);
        document.getElementById('endDate').value = this.formatDateForInput(now);
    }

    setupSearchFilter() {
        let searchTimeout;
        const searchInput = document.getElementById('searchInput');
        
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.dashboard.applyFilters();
            }, 300);
        });
    }

    setupChangeTypeFilter() {
        document.getElementById('changeTypeFilter').addEventListener('change', () => {
            this.dashboard.applyFilters();
        });
    }

    setupAgentFilter() {
        document.getElementById('agentFilter').addEventListener('change', () => {
            this.dashboard.applyFilters();
        });
    }

    formatDateForInput(date) {
        return date.toISOString().slice(0, 16);
    }

    getActiveFilters() {
        return {
            search: document.getElementById('searchInput').value.toLowerCase(),
            changeType: document.getElementById('changeTypeFilter').value,
            agent: document.getElementById('agentFilter').value
        };
    }
}
