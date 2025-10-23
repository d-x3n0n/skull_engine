/**
 * Professional SOC Dashboard - Utilities
 * Common utility functions used across the application
 */

class DashboardUtils {
    constructor() {
        this.version = '1.0.0';
        this.debugMode = false;
    }

    /**
     * Format timestamp for display
     */
    formatTimestamp(timestamp, format = 'full') {
        if (!timestamp) return 'N/A';
        
        const date = new Date(timestamp);
        
        if (isNaN(date.getTime())) {
            return 'Invalid Date';
        }
        
        const formats = {
            full: date.toLocaleString(),
            date: date.toLocaleDateString(),
            time: date.toLocaleTimeString(),
            relative: this.getRelativeTime(date),
            iso: date.toISOString(),
            filename: date.toISOString().replace(/[:.]/g, '-')
        };
        
        return formats[format] || formats.full;
    }

    /**
     * Get relative time (e.g., "2 hours ago")
     */
    getRelativeTime(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffSecs < 60) {
            return 'Just now';
        } else if (diffMins < 60) {
            return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        } else if (diffHours < 24) {
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        } else if (diffDays < 7) {
            return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
        } else {
            return this.formatTimestamp(date, 'date');
        }
    }

    /**
     * Format number with thousands separators
     */
    formatNumber(number) {
        if (typeof number !== 'number') {
            number = parseFloat(number) || 0;
        }
        return number.toLocaleString();
    }

    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get severity level name
     */
    getSeverityLevel(severity) {
        if (severity >= 12) return { name: 'Critical', class: 'severity-critical' };
        if (severity >= 8) return { name: 'High', class: 'severity-high' };
        if (severity >= 4) return { name: 'Medium', class: 'severity-medium' };
        return { name: 'Low', class: 'severity-low' };
    }

    /**
     * Generate unique ID
     */
    generateId(length = 8) {
        return Math.random().toString(36).substring(2, 2 + length);
    }

    /**
     * Deep clone object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj.getTime());
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (obj instanceof Object) {
            const clonedObj = {};
            Object.keys(obj).forEach(key => {
                clonedObj[key] = this.deepClone(obj[key]);
            });
            return clonedObj;
        }
    }

    /**
     * Debounce function
     */
    debounce(func, wait, immediate = false) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    /**
     * Throttle function
     */
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Validate email address
     */
    validateEmail(email) {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    }

    /**
     * Validate URL
     */
    validateUrl(url) {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Escape HTML characters
     */
    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    /**
     * Convert object to query string
     */
    objectToQueryString(obj) {
        const params = new URLSearchParams();
        Object.keys(obj).forEach(key => {
            if (obj[key] !== null && obj[key] !== undefined) {
                params.append(key, obj[key]);
            }
        });
        return params.toString();
    }

    /**
     * Parse query string to object
     */
    queryStringToObject(queryString) {
        const params = new URLSearchParams(queryString);
        const obj = {};
        for (const [key, value] of params) {
            obj[key] = value;
        }
        return obj;
    }

    /**
     * Download data as file
     */
    downloadFile(data, filename, type = 'text/plain') {
        const blob = new Blob([data], { type });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Read file as text
     */
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(e);
            reader.readAsText(file);
        });
    }

    /**
     * Copy text to clipboard
     */
    copyToClipboard(text) {
        return new Promise((resolve, reject) => {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(resolve).catch(reject);
            } else {
                // Fallback for older browsers
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                try {
                    document.execCommand('copy');
                    resolve();
                } catch (err) {
                    reject(err);
                }
                document.body.removeChild(textArea);
            }
        });
    }

    /**
     * Get browser information
     */
    getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';
        
        // Detect browser
        if (ua.includes('Firefox')) {
            browser = 'Firefox';
            version = ua.match(/Firefox\/([0-9.]+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Chrome') && !ua.includes('Edg')) {
            browser = 'Chrome';
            version = ua.match(/Chrome\/([0-9.]+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Safari') && !ua.includes('Chrome')) {
            browser = 'Safari';
            version = ua.match(/Version\/([0-9.]+)/)?.[1] || 'Unknown';
        } else if (ua.includes('Edg')) {
            browser = 'Edge';
            version = ua.match(/Edg\/([0-9.]+)/)?.[1] || 'Unknown';
        }
        
        return { browser, version, userAgent: ua };
    }

    /**
     * Check if element is in viewport
     */
    isInViewport(element) {
        const rect = element.getBoundingClientRect();
        return (
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth)
        );
    }

    /**
     * Smooth scroll to element
     */
    smoothScrollTo(element, offset = 0) {
        const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }

    /**
     * Format duration in milliseconds to human readable
     */
    formatDuration(ms) {
        if (ms < 1000) return `${ms}ms`;
        
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${days}d ${hours % 24}h`;
        if (hours > 0) return `${hours}h ${minutes % 60}m`;
        if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
        return `${seconds}s`;
    }

    /**
     * Get color for value based on threshold
     */
    getValueColor(value, thresholds = [30, 70]) {
        if (value < thresholds[0]) return '#10b981'; // Green
        if (value < thresholds[1]) return '#f59e0b'; // Yellow
        return '#ef4444'; // Red
    }

    /**
     * Calculate percentage
     */
    calculatePercentage(part, total) {
        if (total === 0) return 0;
        return Math.round((part / total) * 100);
    }

    /**
     * Generate random color
     */
    generateRandomColor() {
        return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
    }

    /**
     * Hex to RGB conversion
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : null;
    }

    /**
     * RGB to Hex conversion
     */
    rgbToHex(r, g, b) {
        return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
    }

    /**
     * Lighten or darken color
     */
    adjustColor(hex, percent) {
        const rgb = this.hexToRgb(hex);
        if (!rgb) return hex;
        
        const r = Math.min(255, Math.max(0, rgb.r + percent));
        const g = Math.min(255, Math.max(0, rgb.g + percent));
        const b = Math.min(255, Math.max(0, rgb.b + percent));
        
        return this.rgbToHex(r, g, b);
    }

    /**
     * Log message with timestamp
     */
    log(message, level = 'info') {
        if (!this.debugMode && level === 'debug') return;
        
        const timestamp = new Date().toISOString();
        const styles = {
            info: 'color: #3b82f6;',
            warn: 'color: #f59e0b;',
            error: 'color: #ef4444;',
            debug: 'color: #6b7280;'
        };
        
        console.log(`%c[${timestamp}] ${message}`, styles[level] || styles.info);
    }

    /**
     * Performance measurement
     */
    measurePerformance(name, fn) {
        const start = performance.now();
        const result = fn();
        const end = performance.now();
        
        this.log(`Performance [${name}]: ${(end - start).toFixed(2)}ms`, 'debug');
        return result;
    }

    /**
     * Error handler
     */
    handleError(error, context = '') {
        const errorInfo = {
            message: error.message,
            stack: error.stack,
            context,
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        };
        
        this.log(`Error${context ? ` in ${context}` : ''}: ${error.message}`, 'error');
        console.error('Error details:', errorInfo);
        
        // You can send this to your error tracking service
        // this.sendErrorReport(errorInfo);
        
        return errorInfo;
    }

    /**
     * Get current performance metrics
     */
    getPerformanceMetrics() {
        return {
            memory: performance.memory ? {
                used: performance.memory.usedJSHeapSize,
                total: performance.memory.totalJSHeapSize,
                limit: performance.memory.jsHeapSizeLimit
            } : null,
            timing: performance.timing ? {
                load: performance.timing.loadEventEnd - performance.timing.navigationStart,
                domReady: performance.timing.domContentLoadedEventEnd - performance.timing.navigationStart,
                redirect: performance.timing.redirectEnd - performance.timing.redirectStart,
                dns: performance.timing.domainLookupEnd - performance.timing.domainLookupStart,
                tcp: performance.timing.connectEnd - performance.timing.connectStart,
                request: performance.timing.responseEnd - performance.timing.requestStart
            } : null
        };
    }
}

// Global utility functions (backward compatibility)
function debounce(func, wait, immediate = false) {
    return new DashboardUtils().debounce(func, wait, immediate);
}

function throttle(func, limit) {
    return new DashboardUtils().throttle(func, limit);
}

function formatTimestamp(timestamp, format = 'full') {
    return new DashboardUtils().formatTimestamp(timestamp, format);
}

function formatNumber(number) {
    return new DashboardUtils().formatNumber(number);
}

// Initialize utilities when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardUtils = new DashboardUtils();
    
    // Enable debug mode in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.dashboardUtils.debugMode = true;
        window.dashboardUtils.log('Debug mode enabled', 'debug');
    }
});
