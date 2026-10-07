/**
 * Face Recognition Smart Door Lock - Core App Controller
 * Provides global navigation handling, live system clock, toast notifications,
 * Web Audio sound effects, and shared door lock status synchronization.
 */

const App = {
  audioCtx: null,

  init() {
    this.setupNavigation();
    this.setupClock();
    this.setupDoorLockSync();
  },

  /**
   * Initialize audio context on first user interaction
   */
  initAudio() {
    if (!this.audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        this.audioCtx = new AudioContext();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  },

  /**
   * Synthesize audio chime or buzzer using Web Audio API
   * No external audio files or servers required!
   * @param {'granted'|'denied'|'shutter'|'beep'} type 
   */
  playSound(type) {
    const settings = StorageManager.getSettings();
    if (!settings.soundEnabled) return;

    try {
      this.initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      if (type === 'granted') {
        // High pitched pleasant double chime (Access Granted)
        const osc1 = this.audioCtx.createOscillator();
        const osc2 = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc1.type = 'sine';
        osc2.type = 'triangle';

        osc1.frequency.setValueAtTime(587.33, now); // D5
        osc1.frequency.setValueAtTime(880.00, now + 0.12); // A5

        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

        osc1.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.5);

      } else if (type === 'denied') {
        // Low pitched warning buzz (Access Denied)
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.setValueAtTime(110, now + 0.15);

        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.45);

      } else if (type === 'shutter') {
        // Camera snapshot click
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'square';
        osc.frequency.setValueAtTime(1200, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now);
        osc.stop(now + 0.08);
      }
    } catch (err) {
      console.warn('[App] Audio playback error:', err);
    }
  },

  /**
   * Setup active navigation highlights and mobile sidebar toggle
   */
  setupNavigation() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-item a');

    navLinks.forEach(link => {
      const href = link.getAttribute('href');
      const parentItem = link.closest('.nav-item');
      if (href === currentPage || (currentPage === '' && href === 'index.html')) {
        parentItem.classList.add('active');
      } else {
        parentItem.classList.remove('active');
      }
    });

    // Mobile sidebar toggle
    const toggleBtn = document.getElementById('sidebarToggleBtn');
    const sidebar = document.querySelector('.sidebar');
    const backdrop = document.getElementById('sidebarBackdrop');

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('mobile-open');
        if (backdrop) backdrop.classList.toggle('active');
      });
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => {
        if (sidebar) sidebar.classList.remove('mobile-open');
        backdrop.classList.remove('active');
      });
    }
  },

  /**
   * Setup real-time digital clock in header
   */
  setupClock() {
    const clockEl = document.getElementById('systemLiveClock');
    if (!clockEl) return;

    const updateTime = () => {
      const now = new Date();
      const options = {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      clockEl.textContent = now.toLocaleDateString('en-US', options);
    };

    updateTime();
    setInterval(updateTime, 1000);
  },

  /**
   * Software Prototype Door Lock State Manager
   * Handles unlock countdown and persistent state
   */
  setupDoorLockSync() {
    this.refreshDoorLockUI();
    // Check lock expiry every 1s
    setInterval(() => {
      const lockState = this.getDoorLockState();
      if (!lockState.isLocked && Date.now() > lockState.expiresAt) {
        this.relockDoor();
      }
    }, 1000);
  },

  getDoorLockState() {
    try {
      const raw = sessionStorage.getItem(SDLS_KEYS.LOCK_STATE);
      return raw ? JSON.parse(raw) : { isLocked: true, user: null, expiresAt: 0 };
    } catch {
      return { isLocked: true, user: null, expiresAt: 0 };
    }
  },

  unlockDoor(user, durationSeconds = 5) {
    const state = {
      isLocked: false,
      user: user ? user.name : 'Authorized User',
      userId: user ? user.id : 'N/A',
      unlockedAt: Date.now(),
      expiresAt: Date.now() + (durationSeconds * 1000)
    };
    sessionStorage.setItem(SDLS_KEYS.LOCK_STATE, JSON.stringify(state));
    this.refreshDoorLockUI();
    this.playSound('granted');
  },

  relockDoor() {
    const state = { isLocked: true, user: null, expiresAt: 0 };
    sessionStorage.setItem(SDLS_KEYS.LOCK_STATE, JSON.stringify(state));
    this.refreshDoorLockUI();
  },

  refreshDoorLockUI() {
    const state = this.getDoorLockState();
    const lockOrb = document.getElementById('lockIconOrb');
    const lockStatusBadge = document.getElementById('lockStatusBadge');
    const lockStatusText = document.getElementById('lockStatusText');
    const lockUserSubtext = document.getElementById('lockUserSubtext');

    if (lockOrb) {
      if (state.isLocked) {
        lockOrb.className = 'lock-icon-orb locked';
        lockOrb.innerHTML = '<span class="icon">🔒</span>';
      } else {
        lockOrb.className = 'lock-icon-orb unlocked';
        lockOrb.innerHTML = '<span class="icon">🔓</span>';
      }
    }

    if (lockStatusBadge) {
      if (state.isLocked) {
        lockStatusBadge.className = 'lock-badge-state state-locked';
        lockStatusBadge.textContent = 'LOCKED';
      } else {
        lockStatusBadge.className = 'lock-badge-state state-unlocked';
        lockStatusBadge.textContent = 'UNLOCKED';
      }
    }

    if (lockStatusText) {
      lockStatusText.textContent = state.isLocked ? 'Door Secured (Access Locked)' : `Unlocked for: ${state.user}`;
    }

    if (lockUserSubtext) {
      if (state.isLocked) {
        lockUserSubtext.textContent = 'Standby mode: Authorized face authentication required to unlock.';
      } else {
        const remainingSeconds = Math.max(0, Math.ceil((state.expiresAt - Date.now()) / 1000));
        lockUserSubtext.textContent = `Auto-relocking in ${remainingSeconds}s (Simulated Electronic Lock Relay).`;
      }
    }
  },

  /**
   * Display dynamic toast notification on screen
   * @param {string} title 
   * @param {string} message 
   * @param {'success'|'danger'|'warning'|'info'} type 
   */
  showToast(title, message, type = 'info') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    const icons = {
      success: '✅',
      danger: '🚫',
      warning: '⚠️',
      info: 'ℹ️'
    };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || '🔔'}</div>
      <div class="toast-content">
        <h4>${title}</h4>
        <p>${message}</p>
      </div>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
};

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
