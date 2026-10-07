/**
 * Face Recognition Smart Door Lock - Storage Manager
 * Encapsulates LocalStorage access for registered users, access audit logs, and settings.
 * NO fake data. Computes genuine metrics dynamically from stored records.
 */

const SDLS_KEYS = {
  USERS: 'sdls_registered_users',
  LOGS: 'sdls_access_logs',
  SETTINGS: 'sdls_system_settings',
  LOCK_STATE: 'sdls_door_lock_state'
};

const DEFAULT_SETTINGS = {
  sensitivityThreshold: 0.55,     // Euclidean distance threshold (lower is stricter)
  unlockDurationSeconds: 5,        // Simulated door unlock duration
  soundEnabled: true,              // Web Audio chime / buzzer
  autoLogCooldownMs: 4000          // Delay between recording consecutive logs for same state
};

const StorageManager = {
  /**
   * Get all registered users
   * @returns {Array<Object>}
   */
  getUsers() {
    try {
      const raw = localStorage.getItem(SDLS_KEYS.USERS);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('[StorageManager] Error reading users:', err);
      return [];
    }
  },

  /**
   * Save a newly registered user
   * @param {Object} user 
   * @returns {boolean}
   */
  saveUser(user) {
    try {
      const users = this.getUsers();
      // Ensure unique ID
      const newUser = {
        id: user.id || 'USR-' + Date.now().toString(36).toUpperCase(),
        name: user.name.trim(),
        role: user.role || 'Student',
        dept: user.dept ? user.dept.trim() : 'General',
        regNumber: user.regNumber ? user.regNumber.trim() : 'N/A',
        privilege: user.privilege || 'Standard',
        avatar: user.avatar, // Base64 data URL
        faceDescriptor: user.faceDescriptor, // Array of floats (128-D vector)
        createdAt: new Date().toISOString()
      };
      users.unshift(newUser);
      localStorage.setItem(SDLS_KEYS.USERS, JSON.stringify(users));
      return newUser;
    } catch (err) {
      console.error('[StorageManager] Error saving user:', err);
      return null;
    }
  },

  /**
   * Delete a registered user by ID
   * @param {string} userId 
   * @returns {boolean}
   */
  deleteUser(userId) {
    try {
      const users = this.getUsers().filter(u => u.id !== userId);
      localStorage.setItem(SDLS_KEYS.USERS, JSON.stringify(users));
      return true;
    } catch (err) {
      console.error('[StorageManager] Error deleting user:', err);
      return false;
    }
  },

  /**
   * Get single user by ID
   * @param {string} userId 
   */
  getUserById(userId) {
    const users = this.getUsers();
    return users.find(u => u.id === userId) || null;
  },

  /**
   * Get all access audit logs
   * @returns {Array<Object>}
   */
  getLogs() {
    try {
      const raw = localStorage.getItem(SDLS_KEYS.LOGS);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('[StorageManager] Error reading logs:', err);
      return [];
    }
  },

  /**
   * Add a new access event log
   * @param {Object} entry 
   */
  addLog(entry) {
    try {
      const logs = this.getLogs();
      const logItem = {
        id: 'LOG-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
        timestamp: new Date().toISOString(),
        userName: entry.userName || 'Unknown Visitor',
        userId: entry.userId || 'UNKNOWN',
        role: entry.role || 'Unregistered',
        status: entry.status, // 'GRANTED' | 'DENIED' | 'UNRECOGNIZED'
        distance: entry.distance !== undefined ? Number(entry.distance).toFixed(3) : 'N/A',
        confidence: entry.confidence !== undefined ? Math.round(entry.confidence * 100) : 0,
        avatarSnapshot: entry.avatarSnapshot || null,
        method: 'Client Biometric'
      };
      logs.unshift(logItem);

      // Keep max 200 logs to preserve localStorage quota
      if (logs.length > 200) {
        logs.length = 200;
      }

      localStorage.setItem(SDLS_KEYS.LOGS, JSON.stringify(logs));
      return logItem;
    } catch (err) {
      console.error('[StorageManager] Error writing log:', err);
      return null;
    }
  },

  /**
   * Clear all access logs
   */
  clearLogs() {
    try {
      localStorage.removeItem(SDLS_KEYS.LOGS);
      return true;
    } catch (err) {
      console.error('[StorageManager] Error clearing logs:', err);
      return false;
    }
  },

  /**
   * Get dynamic, real statistics computed directly from LocalStorage
   */
  getStats() {
    const users = this.getUsers();
    const logs = this.getLogs();

    const todayStr = new Date().toISOString().slice(0, 10);
    const todayLogs = logs.filter(log => log.timestamp && log.timestamp.startsWith(todayStr));

    const grantedToday = todayLogs.filter(l => l.status === 'GRANTED').length;
    const deniedToday = todayLogs.filter(l => l.status === 'DENIED' || l.status === 'UNRECOGNIZED').length;
    const totalGrantedAllTime = logs.filter(l => l.status === 'GRANTED').length;

    return {
      totalUsers: users.length,
      totalEvents: logs.length,
      todayEvents: todayLogs.length,
      grantedToday,
      deniedToday,
      totalGrantedAllTime
    };
  },

  /**
   * Get system configuration
   */
  getSettings() {
    try {
      const raw = localStorage.getItem(SDLS_KEYS.SETTINGS);
      return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_SETTINGS };
    } catch (err) {
      return { ...DEFAULT_SETTINGS };
    }
  },

  /**
   * Update system configuration
   * @param {Object} newSettings 
   */
  saveSettings(newSettings) {
    try {
      const current = this.getSettings();
      const merged = { ...current, ...newSettings };
      localStorage.setItem(SDLS_KEYS.SETTINGS, JSON.stringify(merged));
      return merged;
    } catch (err) {
      console.error('[StorageManager] Error saving settings:', err);
      return null;
    }
  },

  /**
   * Export logs as CSV format string
   */
  exportLogsCSV() {
    const logs = this.getLogs();
    if (!logs.length) return '';

    const headers = ['Log ID', 'Timestamp', 'Subject Name', 'User ID', 'Role', 'Status', 'Confidence %', 'Metric Distance'];
    const rows = logs.map(l => [
      `"${l.id}"`,
      `"${new Date(l.timestamp).toLocaleString()}"`,
      `"${l.userName.replace(/"/g, '""')}"`,
      `"${l.userId}"`,
      `"${l.role}"`,
      `"${l.status}"`,
      `"${l.confidence}%"`,
      `"${l.distance}"`
    ]);

    return [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
  }
};
