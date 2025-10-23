// FIM Charts Management
class FIMCharts {
    constructor() {
        this.charts = {};
    }

    initCharts(fimData) {
        this.destroyCharts();
        this.createChangeTypeChart(fimData);
        this.createTimelineChart(fimData);
        this.createTopFilesChart(fimData);
        this.createAgentsChart(fimData);
        this.updateCriticalChanges(fimData);
    }

    createChangeTypeChart(data) {
        const ctx = document.getElementById('changeTypeChart').getContext('2d');
        
        const changeTypes = ['created', 'modified', 'deleted', 'permission', 'ownership'];
        const counts = changeTypes.map(type => 
            data.filter(event => event.change_type === type).length
        );

        this.charts.changeType = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Created', 'Modified', 'Deleted', 'Permission', 'Ownership'],
                datasets: [{
                    data: counts,
                    backgroundColor: [
                        '#10b981', // Green for created
                        '#3b82f6', // Blue for modified
                        '#ef4444', // Red for deleted
                        '#f59e0b', // Yellow for permission
                        '#8b5cf6'  // Purple for ownership
                    ],
                    borderWidth: 2,
                    borderColor: '#1e293b'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            color: '#e2e8f0',
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#e2e8f0'
                    }
                }
            }
        });
    }

    createTimelineChart(data) {
        const ctx = document.getElementById('timelineChart').getContext('2d');
        
        // Group data by hour for the last 24 hours
        const hours = Array.from({length: 24}, (_, i) => {
            const date = new Date();
            date.setHours(date.getHours() - (23 - i));
            date.setMinutes(0, 0, 0);
            return date;
        });

        const hourlyCounts = hours.map(hour => {
            const hourEnd = new Date(hour);
            hourEnd.setHours(hour.getHours() + 1);
            return data.filter(event => {
                const eventTime = new Date(event.timestamp);
                return eventTime >= hour && eventTime < hourEnd;
            }).length;
        });

        this.charts.timeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours.map(h => h.toLocaleTimeString([], {hour: '2-digit'})),
                datasets: [{
                    label: 'File Changes',
                    data: hourlyCounts,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#e2e8f0'
                    }
                },
                scales: {
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    }
                }
            }
        });
    }

    createTopFilesChart(data) {
        const ctx = document.getElementById('topFilesChart').getContext('2d');
        
        // Group by filename and count modifications
        const fileCounts = {};
        data.forEach(event => {
            if (event.change_type === 'modified') {
                fileCounts[event.filename] = (fileCounts[event.filename] || 0) + 1;
            }
        });

        const topFiles = Object.entries(fileCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 8);

        this.charts.topFiles = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: topFiles.map(([filename]) => filename.length > 20 ? filename.substring(0, 20) + '...' : filename),
                datasets: [{
                    label: 'Modification Count',
                    data: topFiles.map(([, count]) => count),
                    backgroundColor: '#8b5cf6',
                    borderColor: '#7c3aed',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: 'y',
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#e2e8f0'
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    },
                    y: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: '#94a3b8'
                        }
                    }
                }
            }
        });
    }

    createAgentsChart(data) {
        const ctx = document.getElementById('agentsChart').getContext('2d');
        
        // Group by agent and count events
        const agentCounts = {};
        data.forEach(event => {
            agentCounts[event.agent_name] = (agentCounts[event.agent_name] || 0) + 1;
        });

        const topAgents = Object.entries(agentCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 6);

        this.charts.agents = new Chart(ctx, {
            type: 'pie',
            data: {
                labels: topAgents.map(([agent]) => agent),
                datasets: [{
                    data: topAgents.map(([, count]) => count),
                    backgroundColor: [
                        '#3b82f6', '#ef4444', '#10b981', '#f59e0b', 
                        '#8b5cf6', '#06b6d4', '#84cc16', '#f97316'
                    ],
                    borderWidth: 2,
                    borderColor: '#1e293b'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#e2e8f0',
                            font: {
                                size: 11
                            }
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(15, 23, 42, 0.9)',
                        titleColor: '#e2e8f0',
                        bodyColor: '#e2e8f0'
                    }
                }
            }
        });
    }

    updateCriticalChanges(data) {
        const container = document.getElementById('criticalChanges');
        const criticalEvents = data
            .filter(event => event.severity === 'critical')
            .slice(0, 10);

        container.innerHTML = criticalEvents.map(event => `
            <div class="critical-change-item">
                <div class="change-severity-indicator critical"></div>
                <div class="change-details">
                    <div class="change-file">${event.filename}</div>
                    <div class="change-meta">
                        <span class="change-agent">${event.agent_name}</span> • 
                        <span class="change-type">${event.change_type}</span> • 
                        <span class="change-time">${this.formatRelativeTime(event.timestamp)}</span>
                    </div>
                </div>
                <div class="change-actions">
                    <button class="btn-icon" title="Investigate">
                        <i class="fas fa-search"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    formatRelativeTime(timestamp) {
        const now = new Date();
        const eventTime = new Date(timestamp);
        const diffMs = now - eventTime;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        return `${Math.floor(diffHours / 24)}d ago`;
    }

    destroyCharts() {
        Object.values(this.charts).forEach(chart => {
            if (chart) {
                chart.destroy();
            }
        });
        this.charts = {};
    }
}

// Initialize charts manager
window.fimCharts = new FIMCharts();
