/**
 * Face Recognition Smart Door Lock - Camera API Wrapper
 * Interacts with Browser Webcam API (navigator.mediaDevices.getUserMedia)
 * Provides clean lifecycle control, frame capture, and camera device selection.
 */

class CameraManager {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.isStreaming = false;
    this.selectedDeviceId = null;
    this.availableDevices = [];
  }

  /**
   * Check if the browser supports Webcam API
   */
  static isSupported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  }

  /**
   * Enumerate available video input devices
   */
  async getCameraDevices() {
    if (!CameraManager.isSupported()) return [];
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.availableDevices = devices.filter(d => d.kind === 'videoinput');
      return this.availableDevices;
    } catch (err) {
      console.warn('[CameraManager] Could not enumerate devices:', err);
      return [];
    }
  }

  /**
   * Start camera video stream
   * @param {string|null} deviceId Optional specific device ID
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async start(deviceId = null) {
    if (!CameraManager.isSupported()) {
      return { success: false, error: 'Webcam API not supported in this browser. Please use Chrome, Edge, or Firefox.' };
    }

    // Stop any existing stream first
    this.stop();

    const constraints = {
      video: {
        width: { ideal: 1280, max: 1920 },
        height: { ideal: 720, max: 1080 },
        facingMode: 'user'
      },
      audio: false
    };

    if (deviceId) {
      constraints.video.deviceId = { exact: deviceId };
      this.selectedDeviceId = deviceId;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (this.video) {
        this.video.srcObject = this.stream;
        await new Promise((resolve) => {
          let resolved = false;
          const doPlay = () => {
            if (resolved) return;
            resolved = true;
            this.video.play().then(resolve).catch(resolve);
          };

          if (this.video.readyState >= 1) {
            doPlay();
            return;
          }

          this.video.onloadedmetadata = doPlay;
          // Fallback timeout in case onloadedmetadata event is delayed
          setTimeout(doPlay, 300);
        });
      }
      this.isStreaming = true;
      return { success: true };
    } catch (err) {
      console.error('[CameraManager] Webcam access error:', err);
      let errorType = 'UNKNOWN';
      let errorTitle = 'Camera Connection Failed';
      let message = 'Unable to access camera device.';

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        errorType = 'PERMISSION_DENIED';
        errorTitle = 'Camera Permission Blocked';
        message = 'Camera access was blocked by the browser. Click the camera/lock icon in your browser address bar, select "Always allow", and click "Retry Connection".';
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        errorType = 'NOT_FOUND';
        errorTitle = 'No Webcam Detected';
        message = 'No video capture device was found on this computer. Please connect an external USB camera or ensure your webcam is enabled in Windows Device Manager.';
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        errorType = 'BUSY';
        errorTitle = 'Camera In Use';
        message = 'The webcam is currently being used by another application (e.g., Zoom, Microsoft Teams, or another browser tab). Please close those programs and retry.';
      } else if (err.name === 'OverconstrainedError') {
        errorType = 'CONSTRAINTS';
        errorTitle = 'Unsupported Camera Resolution';
        message = 'The requested video stream resolution is not supported by your camera hardware.';
      } else if (window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        errorType = 'INSECURE_ORIGIN';
        errorTitle = 'HTTPS Required';
        message = 'Browsers only allow camera access on HTTPS or localhost. Please open this page via localhost or HTTPS.';
      }

      return {
        success: false,
        errorType,
        errorTitle,
        error: message,
        rawError: err
      };
    }
  }

  /**
   * Stop camera video tracks
   */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.isStreaming = false;
  }

  /**
   * Capture a still snapshot frame from the live video
   * @param {number} targetWidth 
   * @param {number} targetHeight 
   * @returns {{ dataUrl: string, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D } | null}
   */
  captureSnapshot(targetWidth = 320, targetHeight = 240) {
    if (!this.video || !this.isStreaming || this.video.videoWidth === 0) {
      return null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Draw video frame to canvas
    ctx.drawImage(this.video, 0, 0, targetWidth, targetHeight);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    return { dataUrl, canvas, ctx };
  }

  /**
   * Extract cropped face region snapshot from coordinate bounding box
   */
  captureCroppedFace(box, padding = 0.2) {
    if (!this.video || !this.isStreaming) return null;

    const canvas = document.createElement('canvas');
    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;

    const padX = box.width * padding;
    const padY = box.height * padding;

    const sx = Math.max(0, box.x - padX);
    const sy = Math.max(0, box.y - padY);
    const sw = Math.min(vw - sx, box.width + padX * 2);
    const sh = Math.min(vh - sy, box.height + padY * 2);

    canvas.width = 160;
    canvas.height = 160;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, 160, 160);

    return canvas.toDataURL('image/jpeg', 0.85);
  }
}
