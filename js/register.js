/**
 * Face Recognition Smart Door Lock - Registration Controller
 * Handles camera lifecycle, real-time live face detection feedback,
 * 128-dimensional biometric descriptor extraction, and LocalStorage persistence.
 * Zero fake users. Real biometric enrollment.
 */

let cameraManager = null;
let faceEngine = null;
let capturedDescriptor = null;
let capturedAvatar = null;
let liveDetectInterval = null;

document.addEventListener('DOMContentLoaded', async () => {
  const videoEl = document.getElementById('registerVideo');
  cameraManager = new CameraManager(videoEl);
  faceEngine = new FaceEngine();
  await faceEngine.init();

  setupRegistrationEvents();
  renderRegisteredUsers();
});

function setupRegistrationEvents() {
  const btnStartCam = document.getElementById('btnStartCamera');
  const btnStopCam = document.getElementById('btnStopCamera');
  const btnCapture = document.getElementById('btnCaptureFace');
  const btnRetake = document.getElementById('btnRetake');
  const btnRetryCamera = document.getElementById('btnRetryCamera');
  const btnDismissError = document.getElementById('btnDismissError');
  const registrationForm = document.getElementById('registrationForm');
  const userSearchInput = document.getElementById('userSearchInput');

  // Start Camera Button
  if (btnStartCam) {
    btnStartCam.addEventListener('click', startRegistrationCamera);
  }

  // Stop Camera Button
  if (btnStopCam) {
    btnStopCam.addEventListener('click', stopRegistrationCamera);
  }

  // Retry Connection Button in Error Banner
  if (btnRetryCamera) {
    btnRetryCamera.addEventListener('click', () => {
      const banner = document.getElementById('cameraErrorBanner');
      if (banner) banner.style.display = 'none';
      startRegistrationCamera();
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

  // Retake / Restart Live Capture
  if (btnRetake) {
    btnRetake.addEventListener('click', () => {
      capturedDescriptor = null;
      capturedAvatar = null;
      document.getElementById('capturePreviewArea').style.display = 'none';
      document.getElementById('registerVideo').style.display = 'block';
      document.getElementById('registerCanvas').style.display = 'block';
      document.getElementById('alignmentOval').style.display = 'block';
      btnCapture.disabled = false;
      btnCapture.textContent = '📸 Capture Face';
      btnRetake.style.display = 'none';

      document.getElementById('biometricStatusBadge').innerHTML = `
        <span class="badge badge-warning">Align Face in Oval</span>
      `;
      startLiveDetectionLoop();
    });
  }

  // Capture & Extract Biometrics
  if (btnCapture) {
    btnCapture.addEventListener('click', handleCaptureFace);
  }

  // Handle User Enrollment Form Submission
  if (registrationForm) {
    registrationForm.addEventListener('submit', handleFormSubmit);
  }

  // Search Registered Users
  if (userSearchInput) {
    userSearchInput.addEventListener('input', (e) => {
      renderRegisteredUsers(e.target.value.toLowerCase());
    });
  }
}

/**
 * Start webcam stream and live detection loop
 */
async function startRegistrationCamera() {
  const btnStartCam = document.getElementById('btnStartCamera');
  const btnStopCam = document.getElementById('btnStopCamera');
  const btnCapture = document.getElementById('btnCaptureFace');
  const errorBanner = document.getElementById('cameraErrorBanner');

  if (errorBanner) errorBanner.style.display = 'none';

  btnStartCam.disabled = true;
  btnStartCam.textContent = '🔄 Connecting...';

  const res = await cameraManager.start();

  if (res.success) {
    document.getElementById('cameraPlaceholder').style.display = 'none';
    btnStartCam.disabled = true;
    btnStartCam.textContent = '📹 Camera Active';
    btnStopCam.disabled = false;
    btnStopCam.className = 'btn btn-danger btn-sm';
    btnCapture.disabled = false;

    updateCameraStatusBadge(true);
    startLiveDetectionLoop();
    App.showToast('Camera Connected', 'Webcam is active. Align your face inside the guide oval and click Capture.', 'info');
  } else {
    btnStartCam.disabled = false;
    btnStartCam.textContent = '📹 Start Camera';
    btnStopCam.disabled = true;
    btnStopCam.className = 'btn btn-secondary btn-sm';
    btnCapture.disabled = true;

    updateCameraStatusBadge(false);
    showRegistrationCameraError(res);
  }
}

/**
 * Stop webcam stream and reset UI
 */
function stopRegistrationCamera() {
  const btnStartCam = document.getElementById('btnStartCamera');
  const btnStopCam = document.getElementById('btnStopCamera');
  const btnCapture = document.getElementById('btnCaptureFace');
  const btnRetake = document.getElementById('btnRetake');

  stopLiveDetectionLoop();
  cameraManager.stop();

  document.getElementById('cameraPlaceholder').style.display = 'flex';
  document.getElementById('capturePreviewArea').style.display = 'none';
  document.getElementById('registerVideo').style.display = 'block';
  document.getElementById('registerCanvas').style.display = 'block';
  document.getElementById('alignmentOval').style.display = 'block';
  document.getElementById('alignmentOval').classList.remove('target-detected');

  btnStartCam.disabled = false;
  btnStartCam.textContent = '📹 Start Camera';
  btnStopCam.disabled = true;
  btnStopCam.className = 'btn btn-secondary btn-sm';
  btnCapture.disabled = true;
  btnRetake.style.display = 'none';

  updateCameraStatusBadge(false);
  document.getElementById('biometricStatusBadge').innerHTML = `
    <span class="badge badge-neutral">No Face</span>
  `;

  App.showToast('Camera Offline', 'Webcam stream stopped.', 'info');
}

/**
 * Live Face Detection Loop in Enrollment Viewport
 * Provides real-time visual feedback that a real face is recognized in the frame
 */
function startLiveDetectionLoop() {
  const video = document.getElementById('registerVideo');
  const canvas = document.getElementById('registerCanvas');
  if (!canvas || !video) return;
  const ctx = canvas.getContext('2d');

  stopLiveDetectionLoop();

  liveDetectInterval = setInterval(async () => {
    if (!cameraManager.isStreaming || video.paused || video.ended || capturedDescriptor) {
      return;
    }

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
    }

    const detection = await faceEngine.detectAndExtract(video);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const oval = document.getElementById('alignmentOval');
    const badge = document.getElementById('biometricStatusBadge');

    if (detection.detected) {
      if (oval) oval.classList.add('target-detected');
      if (badge && !capturedDescriptor) {
        badge.innerHTML = `<span class="badge badge-success">✓ Real Face Detected</span>`;
      }

      // Draw subtle alignment box on canvas
      if (detection.box) {
        ctx.save();
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 2.5;
        ctx.strokeRect(detection.box.x, detection.box.y, detection.box.width, detection.box.height);
        ctx.restore();
      }
    } else {
      if (oval) oval.classList.remove('target-detected');
      if (badge && !capturedDescriptor) {
        badge.innerHTML = `<span class="badge badge-warning">Align Face in Oval</span>`;
      }
    }
  }, 350);
}

function stopLiveDetectionLoop() {
  if (liveDetectInterval) {
    clearInterval(liveDetectInterval);
    liveDetectInterval = null;
  }
  const canvas = document.getElementById('registerCanvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

/**
 * Capture face, perform genuine detection, and extract 128D descriptor
 */
async function handleCaptureFace() {
  const btnCapture = document.getElementById('btnCaptureFace');
  const btnRetake = document.getElementById('btnRetake');
  const video = document.getElementById('registerVideo');

  if (!cameraManager.isStreaming) {
    App.showToast('Camera Inactive', 'Please start the camera first.', 'warning');
    return;
  }

  btnCapture.disabled = true;
  btnCapture.textContent = '⏳ Extracting Biometrics...';

  App.playSound('shutter');

  // Perform genuine face detection and 128-D descriptor extraction
  const detection = await faceEngine.detectAndExtract(video);

  if (!detection.detected) {
    btnCapture.disabled = false;
    btnCapture.textContent = '📸 Capture Face';
    App.showToast('No Face Detected', detection.reason || 'Please position your face directly inside the guide oval.', 'warning');
    document.getElementById('biometricStatusBadge').innerHTML = `
      <span class="badge badge-danger">⚠️ No Face Detected</span>
    `;
    return;
  }

  // Real face confirmed & genuine 128-D descriptor extracted
  capturedDescriptor = detection.descriptor;

  // Extract snapshot thumbnail image
  const snapshot = cameraManager.captureSnapshot(320, 240);
  capturedAvatar = snapshot ? snapshot.dataUrl : null;

  // Stop live detection drawing while previewing captured face
  stopLiveDetectionLoop();

  // Show captured face preview
  const previewArea = document.getElementById('capturePreviewArea');
  const previewImg = document.getElementById('capturedFacePreview');
  if (previewImg && capturedAvatar) previewImg.src = capturedAvatar;
  if (previewArea) previewArea.style.display = 'flex';
  video.style.display = 'none';
  document.getElementById('registerCanvas').style.display = 'none';
  document.getElementById('alignmentOval').style.display = 'none';

  document.getElementById('biometricStatusBadge').innerHTML = `
    <span class="badge badge-success">✓ 128-D Biometric Vector Extracted</span>
  `;

  btnCapture.textContent = '✓ Face Captured';
  btnRetake.style.display = 'inline-flex';

  App.showToast('Face Captured', '128-dimensional facial descriptor computed successfully. Enter your details to complete registration.', 'success');
}

/**
 * Handle form submission and LocalStorage persistence
 */
function handleFormSubmit(e) {
  e.preventDefault();

  const nameInput = document.getElementById('regName');
  const name = nameInput.value.trim();

  // Requirement 1: User enters their name
  if (!name || name.length === 0) {
    App.showToast('Validation Error', 'Full Name is required to register.', 'warning');
    nameInput.focus();
    return;
  }

  // Requirement 7: Do not allow registration if no face is detected
  if (!capturedDescriptor || !capturedAvatar) {
    App.showToast('Missing Face Capture', 'Registration blocked: No face has been captured. Please start the camera, align your face, and click "Capture Face" first.', 'danger');
    return;
  }

  const role = document.getElementById('regRole').value;
  const dept = document.getElementById('regDept').value.trim() || 'General';
  const regNumber = document.getElementById('regIdNumber').value.trim() || 'N/A';
  const privilege = document.getElementById('regPrivilege').value;

  // Requirement 6: Store user name and facial descriptor in LocalStorage
  const user = StorageManager.saveUser({
    name,
    role,
    dept,
    regNumber,
    privilege,
    faceDescriptor: capturedDescriptor,
    avatar: capturedAvatar
  });

  if (user) {
    // Requirement 10: Show clear success message
    App.showToast('Registration Successful', `✓ User "${user.name}" has been enrolled. Facial descriptor saved to LocalStorage.`, 'success');

    // Reset form and capture state
    document.getElementById('registrationForm').reset();
    capturedDescriptor = null;
    capturedAvatar = null;

    document.getElementById('capturePreviewArea').style.display = 'none';
    document.getElementById('registerVideo').style.display = 'block';
    document.getElementById('registerCanvas').style.display = 'block';
    document.getElementById('alignmentOval').style.display = 'block';

    const btnCapture = document.getElementById('btnCaptureFace');
    const btnRetake = document.getElementById('btnRetake');
    btnCapture.disabled = false;
    btnCapture.textContent = '📸 Capture Face';
    btnRetake.style.display = 'none';

    document.getElementById('biometricStatusBadge').innerHTML = `
      <span class="badge badge-success">Enrollment Saved</span>
    `;

    // Refresh directory of enrolled personnel
    renderRegisteredUsers();
    startLiveDetectionLoop();
  } else {
    App.showToast('Storage Error', 'Could not save user data to LocalStorage. Browser quota may be exceeded.', 'danger');
  }
}

/**
 * Display Camera Status indicator badge (ONLINE or OFFLINE)
 */
function updateCameraStatusBadge(isOnline) {
  const badge = document.getElementById('cameraStatusBadge');
  const dot = document.getElementById('cameraStatusDot');
  const text = document.getElementById('cameraStatusText');

  if (isOnline) {
    if (badge) badge.className = 'badge badge-success';
    if (dot) {
      dot.className = 'status-dot active';
      dot.style.backgroundColor = '#10b981';
    }
    if (text) text.textContent = 'ONLINE';
  } else {
    if (badge) badge.className = 'badge badge-danger';
    if (dot) {
      dot.className = 'status-dot';
      dot.style.backgroundColor = '#ef4444';
    }
    if (text) text.textContent = 'OFFLINE';
  }
}

/**
 * Display clear, actionable camera permission error banner
 */
function showRegistrationCameraError(res) {
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
 * Requirement 8: Display all currently registered users from LocalStorage
 */
function renderRegisteredUsers(searchQuery = '') {
  const container = document.getElementById('registeredUsersList');
  const countBadge = document.getElementById('userCountBadge');
  if (!container) return;

  let users = StorageManager.getUsers();

  if (countBadge) countBadge.textContent = `${users.length} Users`;

  if (searchQuery) {
    users = users.filter(u =>
      u.name.toLowerCase().includes(searchQuery) ||
      (u.dept && u.dept.toLowerCase().includes(searchQuery)) ||
      (u.regNumber && u.regNumber.toLowerCase().includes(searchQuery))
    );
  }

  // Requirement 11: Clean empty state when no users are enrolled
  if (users.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">👤</div>
        <h3>No Registered Faces Found</h3>
        <p>Use the enrollment camera panel on the left to capture and register authorized personnel.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = users.map(user => {
    const enrollDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : 'Enrolled';
    return `
      <div class="user-card">
        <img src="${user.avatar || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="58" height="58" fill="%2394a3b8"><circle cx="29" cy="29" r="29"/></svg>'}" alt="${escapeHTML(user.name)}" class="user-card-avatar" />
        <div class="user-card-info">
          <div class="user-card-name">${escapeHTML(user.name)}</div>
          <div class="user-card-meta">${escapeHTML(user.role)} &bull; ${escapeHTML(user.dept)}</div>
          <div class="user-card-meta" style="font-family: var(--font-mono); font-size: 11px;">ID: ${escapeHTML(user.regNumber || user.id)}</div>
          <div style="font-size: 10px; color: #10b981; margin-top: 4px; font-weight: 600;">✓ 128-D Vector Stored &bull; ${enrollDate}</div>
        </div>
        <div class="user-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="deleteUserPrompt('${user.id}', '${escapeHTML(user.name)}')" title="Delete User">
            🗑️
          </button>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Requirement 9: Allow a registered user to be deleted from LocalStorage
 */
window.deleteUserPrompt = function(userId, userName) {
  if (confirm(`Are you sure you want to remove "${userName}" from the authorized face database?`)) {
    const success = StorageManager.deleteUser(userId);
    if (success) {
      App.showToast('User Deleted', `User "${userName}" was removed from LocalStorage.`, 'info');
      renderRegisteredUsers();
    } else {
      App.showToast('Error', `Could not delete "${userName}".`, 'danger');
    }
  }
};

function escapeHTML(str) {
  if (!str) return '';
  return String(str).replace(/[&<>'"]/g, 
    tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
  );
}
