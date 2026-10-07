/**
 * Face Recognition Smart Door Lock - Dashboard Controller
 * Computes and renders real-time statistics from LocalStorage data.
 * Zero fake numbers.
 */

document.addEventListener('DOMContentLoaded', () => {
  renderDashboard();

  // Refresh stats every 3 seconds to keep synchronized
  setInterval(renderDashboard, 3000);
});

function renderDashboard() {
  const stats = StorageManager.getStats();

  // Update KPI counters
  const elUsers = document.getElementById('statTotalUsers');
  const elEvents = document.getElementById('statTodayEvents');
  const elGranted = document.getElementById('statGrantedToday');
  const elDenied = document.getElementById('statDeniedToday');

  if (elUsers) elUsers.textContent = stats.totalUsers;
  if (elEvents) elEvents.textContent = stats.todayEvents;
  if (elGranted) elGranted.textContent = stats.grantedToday;
  if (elDenied) elDenied.textContent = stats.deniedToday;

  // Render Recent Activity Logs
  renderRecentLogs();
}

function renderRecentLogs() {
  const tableBody = document.getElementById('recentLogsTableBody');
  const emptyState = document.getElementById('recentLogsEmptyState');
  if (!tableBody) return;

  const logs = StorageManager.getLogs().slice(0, 5); // Latest 5 events

  if (logs.length === 0) {
    tableBody.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  tableBody.innerHTML = logs.map(log => {
    const isGranted = log.status === 'GRANTED';
    const badgeClass = isGranted ? 'badge-success' : 'badge-danger';
    const statusText = isGranted ? 'Access Granted' : (log.status === 'DENIED' ? 'Access Denied' : 'Unrecognized');
    const avatar = log.avatarSnapshot || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" fill="%2394a3b8"><circle cx="18" cy="18" r="18"/></svg>';
    const timeFormatted = new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    return `
      <tr>
        <td>
          <div class="table-user-cell">
            <img src="${avatar}" alt="Subject" class="table-avatar" />
            <div>
              <div style="font-weight: 600;">${escapeHTML(log.userName)}</div>
              <div style="font-size: 11px; color: #64748b;">ID: ${escapeHTML(log.userId)} &bull; ${escapeHTML(log.role)}</div>
            </div>
          </div>
        </td>
        <td>
          <span class="badge ${badgeClass}">${statusText}</span>
        </td>
        <td style="font-family: var(--font-mono); font-size: 12px;">
          ${log.confidence}%
        </td>
        <td style="color: #64748b; font-size: 12px;">
          ${timeFormatted}
        </td>
      </tr>
    `;
  }).join('');
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
