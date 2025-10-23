/**
 * Professional SOC Dashboard - Charts Manager
 * Handles all chart visualizations for the SOC dashboard
 */

class ChartManager {
    constructor() {
        this.charts = {};
        this.colors = {
            severity: [
                '#65a30d', // Low (1-3)
                '#65a30d',
                '#65a30d',
                '#d97706', // Medium (4-7)
                '#d97706',
                '#d97706',
                '#d97706',
                '#ea580c', // High (8-11)
                '#ea580c',
                '#ea580c',
                '#ea580c',
                '#dc2626', // Critical (12-15)
                '#dc2626',
                '#dc2626',
                '#dc2626'
            ],
            agents: [
                '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
                '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#64748b'
            ],
            mitre: [
                '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
                '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#64748b',
                '#14b8a6', '#f43f5e', '#84cc16', '#f97316', '#8b5cf6'
            ],
            timeline: '#3b82f6'
        };
        
        this.init();
    }

    init() {
        this.initializeCharts();
    }

    /**
     * Initialize all charts
     */
    initializeCharts() {
        this.createSeverityChart();
        this.createTimelineChart();
        this.createAgentsChart();
        this.createMitreChart();
    }

    /**
     * Create severity distribution chart
     */
    createSeverityChart() {
        const ctx = document.getElementById('severityChart').getContext('2d');
        
        this.charts.severity = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Array.from({length: 15}, (_, i) => `L${i + 1}`),
                datasets: [{
                    label: 'Alert Count',
                    data: Array(15).fill(0),
                    backgroundColor: this.colors.severity,
                    borderColor: this.colors.severity.map(color => this.adjustBrightness(color, -20)),
                    borderWidth: 1,
                    borderRadius: 4,
                    borderSkipped: false,
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
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                return `Level ${context.label}: ${context.parsed.y} alerts`;
                            }
                        }
                    },
                    datalabels: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 11
                            }
                        },
                        title: {
                            display: true,
                            text: 'Number of Alerts',
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 12,
                                weight: 'normal'
                            }
                        }
                    },
                    x: {
                        grid: {
                            display: false,
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 11
                            }
                        },
                        title: {
                            display: true,
                            text: 'Severity Level',
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 12,
                                weight: 'normal'
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                animation: {
                    duration: 750,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    /**
     * Create alerts timeline chart
     */
    createTimelineChart() {
        const ctx = document.getElementById('timelineChart').getContext('2d');
        
        this.charts.timeline = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Alerts per Hour',
                    data: [],
                    borderColor: this.colors.timeline,
                    backgroundColor: this.hexToRgba(this.colors.timeline, 0.1),
                    tension: 0.4,
                    fill: true,
                    pointBackgroundColor: this.colors.timeline,
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
                        display: false
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 11
                            }
                        },
                        title: {
                            display: true,
                            text: 'Number of Alerts',
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 12,
                                weight: 'normal'
                            }
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 11
                            },
                            maxRotation: 45,
                            minRotation: 45
                        },
                        title: {
                            display: true,
                            text: 'Time',
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 12,
                                weight: 'normal'
                            }
                        }
                    }
                },
                interaction: {
                    mode: 'nearest',
                    axis: 'x',
                    intersect: false
                },
                animation: {
                    duration: 750,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    /**
     * Create top agents chart
     */
    createAgentsChart() {
        const ctx = document.getElementById('agentsChart').getContext('2d');
        
        this.charts.agents = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: this.colors.agents,
                    borderColor: '#1e293b',
                    borderWidth: 2,
                    hoverOffset: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '60%',
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 11
                            },
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1,
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return `${label}: ${value} (${percentage}%)`;
                            }
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 750,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    /**
     * Create MITRE ATT&CK chart
     */
    createMitreChart() {
        const ctx = document.getElementById('mitreChart').getContext('2d');
        
        this.charts.mitre = new Chart(ctx, {
            type: 'polarArea',
            data: {
                labels: [],
                datasets: [{
                    data: [],
                    backgroundColor: this.colors.mitre,
                    borderColor: '#1e293b',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 11
                            },
                            padding: 15,
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(30, 41, 59, 0.95)',
                        titleColor: '#f8fafc',
                        bodyColor: '#cbd5e1',
                        borderColor: 'rgba(255, 255, 255, 0.1)',
                        borderWidth: 1
                    }
                },
                scales: {
                    r: {
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        },
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.7)',
                            font: {
                                size: 10
                            },
                            backdropColor: 'transparent'
                        },
                        pointLabels: {
                            display: false
                        }
                    }
                },
                animation: {
                    animateScale: true,
                    animateRotate: true,
                    duration: 750,
                    easing: 'easeOutQuart'
                }
            }
        });
    }

    /**
     * Update all charts with new data
     */
    updateAllCharts(chartsData) {
        if (!chartsData) return;

        this.updateSeverityChart(chartsData.severity_distribution);
        this.updateTimelineChart(chartsData.timeline);
        this.updateAgentsChart(chartsData.top_agents);
        this.updateMitreChart(chartsData.mitre_tactics);
    }

    /**
     * Update severity chart
     */
    updateSeverityChart(severityData) {
        if (!this.charts.severity || !severityData) return;

        const labels = Object.keys(severityData).map(level => `L${level}`);
        const data = Object.values(severityData);

        this.charts.severity.data.labels = labels;
        this.charts.severity.data.datasets[0].data = data;
        this.charts.severity.update('none');
    }

    /**
     * Update timeline chart
     */
    updateTimelineChart(timelineData) {
        if (!this.charts.timeline || !timelineData) return;

        // Sort timeline data by time
        const sortedEntries = Object.entries(timelineData)
            .sort(([a], [b]) => a.localeCompare(b))
            .slice(-24); // Last 24 hours

        const labels = sortedEntries.map(([time]) => {
            const date = new Date(time);
            return date.toLocaleTimeString('en-US', { 
                hour: '2-digit', 
                minute: '2-digit',
                hour12: false 
            });
        });

        const data = sortedEntries.map(([, count]) => count);

        this.charts.timeline.data.labels = labels;
        this.charts.timeline.data.datasets[0].data = data;
        this.charts.timeline.update('none');
    }

    /**
     * Update agents chart
     */
    updateAgentsChart(agentsData) {
        if (!this.charts.agents || !agentsData) return;

        const labels = Object.keys(agentsData);
        const data = Object.values(agentsData);

        // Only show top 10 agents
        const topLabels = labels.slice(0, 10);
        const topData = data.slice(0, 10);

        this.charts.agents.data.labels = topLabels;
        this.charts.agents.data.datasets[0].data = topData;
        this.charts.agents.update('none');
    }

    /**
     * Update MITRE chart
     */
    updateMitreChart(mitreData) {
        if (!this.charts.mitre || !mitreData) return;

        const labels = Object.keys(mitreData);
        const data = Object.values(mitreData);

        // Only show top 15 tactics
        const topLabels = labels.slice(0, 15);
        const topData = data.slice(0, 15);

        this.charts.mitre.data.labels = topLabels;
        this.charts.mitre.data.datasets[0].data = topData;
        this.charts.mitre.update('none');
    }

    /**
     * Export chart as image
     */
    exportChart(chartId, format = 'png') {
        const chart = this.charts[chartId];
        if (!chart) {
            console.error('Chart not found:', chartId);
            return;
        }

        const link = document.createElement('a');
        link.download = `soc-chart-${chartId}-${new Date().toISOString().split('T')[0]}.${format}`;
        link.href = chart.toBase64Image();
        link.click();
    }

    /**
     * Utility: Convert hex to rgba
     */
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /**
     * Utility: Adjust color brightness
     */
    adjustBrightness(hex, percent) {
        // Remove the # if present
        hex = hex.replace(/^\#/, '');
        
        // Parse the r, g, b values
        let r = parseInt(hex.substr(0, 2), 16);
        let g = parseInt(hex.substr(2, 2), 16);
        let b = parseInt(hex.substr(4, 2), 16);

        // Adjust brightness
        r = Math.max(0, Math.min(255, r + percent));
        g = Math.max(0, Math.min(255, g + percent));
        b = Math.max(0, Math.min(255, b + percent));

        // Convert back to hex
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
    }

    /**
     * Destroy all charts (for cleanup)
     */
    destroy() {
        Object.values(this.charts).forEach(chart => {
            if (chart && typeof chart.destroy === 'function') {
                chart.destroy();
            }
        });
        this.charts = {};
    }
}

// Initialize chart manager when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chartManager = new ChartManager();
});
