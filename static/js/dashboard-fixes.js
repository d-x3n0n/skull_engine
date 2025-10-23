(function (global) {
  const _charts = {};
  let _refreshTimers = {};

  function createOrUpdateChart(canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
      console.warn('createOrUpdateChart: canvas not found:', canvasId);
      return null;
    }

    if (_charts[canvasId]) {
      try {
        _charts[canvasId].destroy();
      } catch (err) {
        console.warn('Error destroying existing chart for', canvasId, err);
      } finally {
        _charts[canvasId] = null;
      }
    }

    const ctx = canvas.getContext('2d');
    try {
      const chart = new Chart(ctx, config);
      _charts[canvasId] = chart;
      return chart;
    } catch (err) {
      console.error('createOrUpdateChart: failed to create chart', err);
      return null;
    }
  }

  function updateChartData(canvasId, newData) {
    const chart = _charts[canvasId];
    if (!chart) {
      console.warn('updateChartData: no existing chart, create instead', canvasId);
      return createOrUpdateChart(canvasId, newData);
    }
    try {
      chart.data = newData.data || chart.data;
      if (newData.options) chart.options = newData.options;
      chart.update();
      return chart;
    } catch (err) {
      console.warn('updateChartData failed, recreating chart', err);
      return createOrUpdateChart(canvasId, newData);
    }
  }

  function safeAttachListener(selectorOrElement, event, handler) {
    const el = typeof selectorOrElement === 'string' ? document.querySelector(selectorOrElement) : selectorOrElement;
    if (el) {
      el.addEventListener(event, handler);
      return true;
    } else {
      console.warn('safeAttachListener: element not found for', selectorOrElement);
      return false;
    }
  }

  async function safeFetch(url, opts = {}, timeout = 15000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, Object.assign({}, opts, { signal: controller.signal }));
      clearTimeout(id);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      clearTimeout(id);
      console.error('safeFetch error:', err);
      throw err;
    }
  }

  function scheduleRefresh(key, fn, delay = 1000) {
    if (_refreshTimers[key]) clearTimeout(_refreshTimers[key]);
    _refreshTimers[key] = setTimeout(async () => {
      try {
        await fn();
      } catch (err) {
        console.error('scheduled refresh error:', err);
      } finally {
        _refreshTimers[key] = null;
      }
    }, delay);
  }

  global.dashboardHelpers = {
    createOrUpdateChart,
    updateChartData,
    safeAttachListener,
    safeFetch,
    scheduleRefresh
  };
})(window);

document.addEventListener('DOMContentLoaded', () => {
  try {
    dashboardHelpers.safeAttachListener('#init-dashboard-button', 'click', () => {
      if (typeof initializeDashboard === 'function') initializeDashboard();
    });

    if (typeof initializeDashboard === 'function') {
      initializeDashboard();
    }
  } catch (err) {
    console.error('Failed to initialize dashboard:', err);
  }
});
