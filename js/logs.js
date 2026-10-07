/**
 * Face Recognition Smart Door Lock - Access Logs Controller
 * Comprehensive audit trail rendering, status filtering, search, and CSV/JSON export.
 */

let allLogs = [];

document.addEventListener('DOMContentLoaded', () => {
  setupLogEvents();
  loadAndRenderLogs();
});

function setupLogEvents() {
  const searchInput = document.getElementById('logSearchInput');
  const statusFilter = document.getElementById('logStatusFilter');
  const dateFilter = document.getElementById('logDateFilter');
  const btnExportCSV = document.getElementById('btnExportCSV');
  const btnExportJSON = document.getElementById('btnExportJSON');
  const btnClearLogs = document.getElementById('btnClearLogs');

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (statusFilter) statusFilter.addEventListener('change', applyFilters);
  if (dateFilter) dateFilter.addEventListener('change', applyFilters);

  if (btnExportCSV) {
    btnExportCSV.addEventListener('click', () => {
      const csvContent = StorageManager.exportLogsCSV();
      if (!csvContent) {
        App.showToast('Export Notice', 'No logs available to export.', 'warning');
        return;
      }
      downloadFile(csvContent, `access_audit_logs_${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8;');
      App.showToast('Export Successful', 'CSV log file downloaded.', 'success');
    });
  }

  if (btnExportJSON) {
    btnExportJSON.addEventListener('click', () => {
      const logs = StorageManager.getLogs();
      if (!logs.length) {
        App.showToast('Export Notice', 'No logs available to export.', 'warning');
        return;
      }
      const jsonContent = JSON.stringify(logs, null, 2);
      downloadFile(jsonContent, `access_audit_logs_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
      App.showToast('Export Successful', 'JSON log file downloaded.', 'success');
    });
  }

  if (btnClearLogs) {
    btnClearLogs.addEventListener('click', () => {
      if (confirm('Are you sure you want to permanently clear all access audit records?')) {
        StorageManager.clearLogs();
        loadAndRenderLogs();
        App.showToast('Logs Cleared', 'All audit entries have been wiped.', 'info');
      }
    });
  }
}

function loadAndRenderLogs() {
  allLogs = StorageManager.getLogs();
  applyFilters();
}

function applyFilters() {
  const searchVal = (document.getElementById('logSearchInput')?.value || '').toLowerCase().trim();
  const statusVal = document.getElementById('logStatusFilter')?.value || 'ALL';
  const dateVal = document.getElementById('logDateFilter')?.value || 'ALL';

  const todayStr = new Date().toISOString().slice(0, 10);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  let filtered = allLogs.filter(log => {
    // Search match
    if (searchVal) {
      const matchesSearch = log.userName.toLowerCase().includes(searchVal) ||
                            (log.userId && log.userId.toLowerCase().includes(searchVal)) ||
                            (log.role && log.role.toLowerCase().includes(searchVal));
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusVal === 'GRANTED' && log.status !== 'GRANTED') return false;
    if (statusVal === 'DENIED' && log.status !== 'DENIED' && log.status !== 'UNRECOGNIZED') return false;

    // Date filter
    if (dateVal === 'TODAY') {
      if (!log.timestamp || !log.timestamp.startsWith(todayStr)) return false;
    } else if (dateVal === 'WEEK') {
      if (!log.timestamp || new Date(log.timestamp) < sevenDaysAgo) return false;
    }

    return true;
  });

  renderTable(filtered);
}

function renderTable(logs) {
  const tbody = document.getElementById('logsTableBody');
  const emptyState = document.getElementById('logsEmptyState');
  const countBadge = document.getElementById('filteredCountBadge');

  if (countBadge) countBadge.textContent = `${logs.length} Records`;

  if (!tbody) return;

  if (logs.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tbody.innerHTML = logs.map(log => {
    const isGranted = log.status === 'GRANTED';
    const badgeClass = isGranted ? 'badge-success' : 'badge-danger';
    const statusText = isGranted ? 'Access Granted' : 'Access Denied';
    const avatar = log.avatarSnapshot || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="%2394a3b8"><circle cx="18" cy="18" r="18"/></svg>';
    const dateObj = new Date(log.timestamp);
    const dateFormatted = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeFormatted = dateObj.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

    return `
      <tr>
        <td style="font-family: var(--font-mono); font-size: 11px; color: #64748b;">
          ${escapeHTML(log.id)}
        </td>
        <td>
          <div style="font-weight: 600; font-size: 13px;">${dateFormatted}</div>
          <div style="font-size: 11px; color: #64748b; font-family: var(--font-mono);">${timeFormatted}</div>
        </td>
        <td>
          <div class="table-user-cell">
            <img src="${avatar}" alt="Subject" class="table-avatar" />
            <div>
              <div style="font-weight: 700; color: #0f172a;">${escapeHTML(log.userName)}</div>
              <div style="font-size: 11px; color: #64748b;">ID: ${escapeHTML(log.userId)} &bull; ${escapeHTML(log.role)}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge ${badgeClass}">${statusText}</span>
        </td>
        <td>
          <div style="font-weight: 700; font-family: var(--font-mono); font-size: 13px;">${log.confidence}%</div>
          <div style="font-size: 10px; color: #64748b;">Dist: ${log.distance}</div>
        </td>
        <td>
          <span class="badge badge-neutral" style="font-size: 11px;">${log.method || 'Biometric'}</span>
        </td>
      </tr>
    `;
  }).join('');
}

function downloadFile(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
