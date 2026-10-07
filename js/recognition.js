/**
 * Face Recognition Smart Door Lock - Live Recognition Controller
 * Continuous camera frame scanning, real-time bounding box rendering,
 * Euclidean distance verification, simulated door unlock trigger, and audit logging.
 */

let cameraManager = null;
let faceEngine = null;
let isScanning = false;
let scanIntervalId = null;
let lastLogTimestamp = 0;
let lastSubjectIdentified = null;

document.addEventListener('DOMContentLoaded', async () => {
  const videoEl = document.getElementById('recognitionVideo');
  cameraManager = new CameraManager(videoEl);
  faceEngine = new FaceEngine();
  await faceEngine.init();

  setupRecognitionEvents();
});

function setupRecognitionEvents() {
  const btnStartCamera = document.getElementById('btnStartCamera');
  const btnStopCamera = document.getElementById('btnStopCamera');
  const btnRetryCamera = document.getElementById('btnRetryCamera');
  const btnDismissError = document.getElementById('btnDismissError');
  const sensitivitySlider = document.getElementById('sensitivitySlider');
  const sensitivityVal = document.getElementById('sensitivityVal');

  // Load current sensitivity setting
  const settings = StorageManager.getSettings();
  if (sensitivitySlider) {
    sensitivitySlider.value = settings.sensitivityThreshold;
    if (sensitivityVal) sensitivityVal.textContent = settings.sensitivityThreshold;
    
    sensitivitySlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      if (sensitivityVal) sensitivityVal.textContent = val.toFixed(2);
      StorageManager.saveSettings({ sensitivityThreshold: val });
    });
  }

  // Start Camera Button
  if (btnStartCamera) {
    btnStartCamera.addEventListener('click', startCamera);
  }

  // Stop Camera Button
  if (btnStopCamera) {
    btnStopCamera.addEventListener('click', stopCamera);
  }

  // Retry Connection Button in Error Banner
  if (btnRetryCamera) {
    btnRetryCamera.addEventListener('click', () => {
      const banner = document.getElementById('cameraErrorBanner');
      if (banner) banner.style.display = 'none';
      startCamera();
    });
  }

  // Dismiss Error Banner
  if (btnDismissError) {
    btnDismissError.addEventListener('click', () => {
      const banner = document.getElementById('cameraErrorBanner');
      if (banner) banner.style.display = 'none';
      document.getElementById('cameraPlaceholder').style.display = 'flex';
    });
  }
}

/**
 * Start camera feed and live face detection
 */
async function startCamera() {
  const btnStart = document.getElementById('btnStartCamera');
  const btnStop = document.getElementById('btnStopCamera');
  const errorBanner = document.getElementById('cameraErrorBanner');

  if (errorBanner) errorBanner.style.display = 'none';

  btnStart.disabled = true;
  btnStart.innerHTML = '🔄 Requesting Permission...';

  // Request webcam access
  const res = await cameraManager.start();

  if (res.success) {
    document.getElementById('cameraPlaceholder').style.display = 'none';
    document.querySelector('.camera-card').classList.add('scanning-active');

    // Update Camera Status to ONLINE
    updateCameraStatus(true);

    isScanning = true;
    btnStart.disabled = true;
    btnStart.innerHTML = '📹 Camera Active';
    btnStop.disabled = false;
    btnStop.className = 'btn btn-danger';

    startRecognitionLoop();
    App.showToast('Camera Online', 'Live video feed started. Facial detection is active.', 'success');
  } else {
    // Permission or device error
    btnStart.disabled = false;
    btnStart.innerHTML = '📹 Start Camera';
    btnStop.disabled = true;
    btnStop.className = 'btn btn-secondary';

    updateCameraStatus(false);
    showCameraError(res);
  }
}

/**
 * Stop camera feed and clear recognition loop
 */
function stopCamera() {
  const btnStart = document.getElementById('btnStartCamera');
  const btnStop = document.getElementById('btnStopCamera');

  stopRecognitionLoop();
  cameraManager.stop();

  isScanning = false;

  document.getElementById('cameraPlaceholder').style.display = 'flex';
  document.querySelector('.camera-card').classList.remove('scanning-active');

  // Update Camera Status to OFFLINE
  updateCameraStatus(false);

  btnStart.disabled = false;
  btnStart.innerHTML = '📹 Start Camera';
  btnStop.disabled = true;
  btnStop.className = 'btn btn-secondary';

  resetDecisionUI();
  App.showToast('Camera Offline', 'Webcam stream stopped.', 'info');
}

/**
 * Update Camera Status indicator badge (ONLINE or OFFLINE)
 */
function updateCameraStatus(isOnline) {
  const badge = document.getElementById('cameraStatusBadge');
  const dot = document.getElementById('cameraStatusDot');
  const text = document.getElementById('cameraStatusText');
  const faceBadge = document.getElementById('facePresenceBadge');
  const faceText = document.getElementById('facePresenceText');

  if (isOnline) {
    if (badge) badge.className = 'badge badge-success';
    if (dot) {
      dot.className = 'status-dot active';
      dot.style.backgroundColor = '#10b981';
    }
    if (text) text.textContent = 'ONLINE';
    if (faceBadge) {
      faceBadge.className = 'badge badge-warning';
      faceBadge.style.display = 'inline-flex';
    }
    if (faceText) faceText.textContent = 'Searching...';
  } else {
    if (badge) badge.className = 'badge badge-danger';
    if (dot) {
      dot.className = 'status-dot';
      dot.style.backgroundColor = '#ef4444';
    }
    if (text) text.textContent = 'OFFLINE';
    if (faceBadge) {
      faceBadge.className = 'badge badge-neutral';
    }
    if (faceText) faceText.textContent = 'No Face';
  }
}

/**
 * Display clear, actionable camera permission or device error
 */
function showCameraError(res) {
  const banner = document.getElementById('cameraErrorBanner');
  const title = document.getElementById('cameraErrorTitle');
  const msg = document.getElementById('cameraErrorMessage');
  const placeholder = document.getElementById('cameraPlaceholder');

  if (placeholder) placeholder.style.display = 'none';

  if (banner) {
    banner.style.display = 'flex';
    if (title) title.textContent = res.errorTitle || 'Camera Access Error';
    if (msg) msg.textContent = res.error || 'Unable to access webcam. Please check permissions.';
  }

  App.showToast(res.errorTitle || 'Camera Error', res.error || 'Permission denied.', 'danger');
}

/**
 * Start high-efficiency periodic scanning loop (~350ms cadence)
 */
function startRecognitionLoop() {
  const video = document.getElementById('recognitionVideo');
  const canvas = document.getElementById('hudOverlayCanvas');
  const ctx = canvas.getContext('2d');

  scanIntervalId = setInterval(async () => {
    if (!isScanning || !cameraManager.isStreaming || video.paused || video.ended) {
      return;
    }

    // Synchronize canvas coordinate resolution with video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    // Process frame with client-side face detection
    const detection = await faceEngine.detectAndExtract(video);

    // Clear previous bounding box
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const alignmentOval = document.getElementById('alignmentOval');
    const faceBadge = document.getElementById('facePresenceBadge');
    const faceText = document.getElementById('facePresenceText');

    if (!detection.detected) {
      if (alignmentOval) alignmentOval.classList.remove('target-detected');
      if (faceBadge) faceBadge.className = 'badge badge-warning';
      if (faceText) faceText.textContent = 'Searching...';
      updateDecisionUI({ state: 'SEARCHING' });
      return;
    }

    // Face is present in camera frame
    if (alignmentOval) alignmentOval.classList.add('target-detected');
    if (faceBadge) faceBadge.className = 'badge badge-success';
    if (faceText) faceText.textContent = 'Face Detected';

    // Match extracted 128D descriptor against registered faces
    const registeredUsers = StorageManager.getUsers();
    const settings = StorageManager.getSettings();
    const threshold = settings.sensitivityThreshold || 0.55;

    const matchResult = faceEngine.matchFace(detection.descriptor, registeredUsers, threshold);

    // Draw visual bounding box with dynamic status & label on canvas
    if (detection.box) {
      let boxStatus = 'DETECTED';
      let boxLabel = 'FACE DETECTED';

      if (matchResult.matched && matchResult.user) {
        boxStatus = 'GRANTED';
        boxLabel = `✓ ${matchResult.user.name.toUpperCase()} (${Math.round(matchResult.confidence * 100)}%)`;
      } else if (matchResult.distance > threshold && registeredUsers.length > 0) {
        boxStatus = 'DENIED';
        boxLabel = '⚠️ UNRECOGNIZED IDENTITY';
      }

      drawBoundingBox(ctx, detection.box, boxStatus, boxLabel);
    }

    // Capture snapshot for audit trail
    const snapshot = cameraManager.captureSnapshot(200, 150);
    const avatarSnapshot = snapshot ? snapshot.dataUrl : null;

    handleRecognitionDecision(matchResult, avatarSnapshot, settings);

  }, 350);
}

function stopRecognitionLoop() {
  if (scanIntervalId) {
    clearInterval(scanIntervalId);
    scanIntervalId = null;
  }
  const canvas = document.getElementById('hudOverlayCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  const alignmentOval = document.getElementById('alignmentOval');
  if (alignmentOval) alignmentOval.classList.remove('target-detected');
}

/**
 * Draw sleek bounding box and label on overlay canvas
 */
function drawBoundingBox(ctx, box, status = 'DETECTED', label = 'FACE DETECTED') {
  ctx.save();
  
  let strokeColor = '#f59e0b'; // default yellow
  let fillColor = 'rgba(245, 158, 11, 0.12)';
  let tagBg = '#f59e0b';
  let tagText = '#0f172a';

  if (status === 'GRANTED') {
    strokeColor = '#10b981'; // green
    fillColor = 'rgba(16, 185, 129, 0.15)';
    tagBg = '#10b981';
    tagText = '#ffffff';
  } else if (status === 'DENIED') {
    strokeColor = '#ef4444'; // red
    fillColor = 'rgba(239, 68, 68, 0.15)';
    tagBg = '#ef4444';
    tagText = '#ffffff';
  }

  const { x, y, width: w, height: h } = box;

  // Fill subtle tint inside face box
  ctx.fillStyle = fillColor;
  ctx.fillRect(x, y, w, h);

  // Outer border
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2.5;
  ctx.strokeRect(x, y, w, h);

  // Corner brackets style for tech HUD aesthetic
  ctx.lineWidth = 4;
  const cornerLen = Math.min(24, Math.max(12, w * 0.22));

  // Top-left
  ctx.beginPath();
  ctx.moveTo(x, y + cornerLen);
  ctx.lineTo(x, y);
  ctx.lineTo(x + cornerLen, y);
  ctx.stroke();

  // Top-right
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y);
  ctx.lineTo(x + w, y);
  ctx.lineTo(x + w, y + cornerLen);
  ctx.stroke();

  // Bottom-left
  ctx.beginPath();
  ctx.moveTo(x, y + h - cornerLen);
  ctx.lineTo(x, y + h);
  ctx.lineTo(x + cornerLen, y + h);
  ctx.stroke();

  // Bottom-right
  ctx.beginPath();
  ctx.moveTo(x + w - cornerLen, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + w, y + h - cornerLen);
  ctx.stroke();

  // Draw Header Badge Tag
  ctx.font = 'bold 12px Inter, system-ui, sans-serif';
  const textWidth = ctx.measureText(label).width;
  const tagH = 22;
  const tagW = textWidth + 16;
  const tagY = y > 26 ? y - tagH - 4 : y + 4;

  ctx.fillStyle = tagBg;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, tagY, tagW, tagH, 4);
    ctx.fill();
  } else {
    ctx.fillRect(x, tagY, tagW, tagH);
  }

  ctx.fillStyle = tagText;
  ctx.fillText(label, x + 8, tagY + 15);

  ctx.restore();
}

/**
 * Evaluate match result, trigger simulated lock, update UI, and auto-log
 */
function handleRecognitionDecision(result, avatarSnapshot, settings) {
  const now = Date.now();
  const cooldown = settings.autoLogCooldownMs || 4000;

  if (result.matched && result.user) {
    // ACCESS GRANTED
    updateDecisionUI({
      state: 'GRANTED',
      user: result.user,
      confidence: result.confidence,
      distance: result.distance
    });

    // Trigger door unlock simulation
    App.unlockDoor(result.user, settings.unlockDurationSeconds || 5);

    // Auto log with cooldown
    if (now - lastLogTimestamp > cooldown || lastSubjectIdentified !== result.user.id) {
      StorageManager.addLog({
        userName: result.user.name,
        userId: result.user.id,
        role: result.user.role,
        status: 'GRANTED',
        confidence: result.confidence,
        distance: result.distance,
        avatarSnapshot
      });
      lastLogTimestamp = now;
      lastSubjectIdentified = result.user.id;
    }

  } else {
    // ACCESS DENIED / UNRECOGNIZED
    updateDecisionUI({
      state: 'DENIED',
      distance: result.distance,
      reason: result.reason || 'Biometric features not enrolled.'
    });

    App.playSound('denied');

    // Auto log denied attempt with cooldown
    if (now - lastLogTimestamp > cooldown || lastSubjectIdentified !== 'UNKNOWN') {
      StorageManager.addLog({
        userName: 'Unknown Person',
        userId: 'UNRECOGNIZED',
        role: 'Visitor',
        status: 'DENIED',
        confidence: 0,
        distance: result.distance,
        avatarSnapshot
      });
      lastLogTimestamp = now;
      lastSubjectIdentified = 'UNKNOWN';
    }
  }
}

/**
 * Update real-time decision panel UI
 */
function updateDecisionUI({ state, user, confidence, distance, reason }) {
  const panel = document.getElementById('decisionPanel');
  const title = document.getElementById('decisionTitle');
  const badge = document.getElementById('decisionBadge');
  const profile = document.getElementById('decisionUserProfile');
  const avatar = document.getElementById('decisionAvatar');
  const userName = document.getElementById('decisionUserName');
  const userMeta = document.getElementById('decisionUserMeta');
  const meterFill = document.getElementById('decisionMeterFill');
  const meterScore = document.getElementById('decisionConfidenceScore');
  const distanceValue = document.getElementById('decisionDistanceValue');

  if (!panel) return;

  if (state === 'GRANTED' && user) {
    panel.className = 'decision-panel status-granted';
    title.innerHTML = '<span>✅</span> Access Granted';
    title.style.color = '#065f46';
    badge.className = 'badge badge-success';
    badge.textContent = 'Identity Verified';

    profile.style.display = 'flex';
    if (avatar) avatar.src = user.avatar || '';
    if (userName) userName.textContent = user.name;
    if (userMeta) userMeta.textContent = `${user.role} &bull; Dept: ${user.dept} &bull; ID: ${user.regNumber || user.id}`;

    const confPct = Math.round((confidence || 0.95) * 100);
    if (meterFill) meterFill.style.width = `${confPct}%`;
    if (meterScore) meterScore.textContent = `${confPct}%`;
    if (distanceValue) distanceValue.textContent = Number(distance).toFixed(3);

  } else if (state === 'DENIED') {
    panel.className = 'decision-panel status-denied';
    title.innerHTML = '<span>🚫</span> Access Denied';
    title.style.color = '#991b1b';
    badge.className = 'badge badge-danger';
    badge.textContent = 'Unrecognized Face';

    profile.style.display = 'flex';
    if (avatar) avatar.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" fill="%23ef4444"><circle cx="32" cy="32" r="32"/></svg>';
    if (userName) userName.textContent = 'Unknown Subject';
    if (userMeta) userMeta.textContent = reason || 'No biometric match found in local database.';

    if (meterFill) meterFill.style.width = '12%';
    if (meterScore) meterScore.textContent = '0% Match';
    if (distanceValue) distanceValue.textContent = distance !== undefined ? Number(distance).toFixed(3) : '> 0.70';

  } else {
    // SEARCHING / STANDBY
    panel.className = 'decision-panel status-scanning';
    title.innerHTML = '<span>🔍</span> Scanning Viewport...';
    title.style.color = '#92400e';
    badge.className = 'badge badge-warning';
    badge.textContent = 'Searching Face';

    profile.style.display = 'none';
    if (meterFill) meterFill.style.width = '0%';
    if (meterScore) meterScore.textContent = '0%';
    if (distanceValue) distanceValue.textContent = '--';
  }
}

function resetDecisionUI() {
  updateDecisionUI({ state: 'SEARCHING' });
  const title = document.getElementById('decisionTitle');
  if (title) title.innerHTML = '<span>💤</span> Scanner Offline';
  const badge = document.getElementById('decisionBadge');
  if (badge) {
    badge.className = 'badge badge-neutral';
    badge.textContent = 'Offline';
  }
}
