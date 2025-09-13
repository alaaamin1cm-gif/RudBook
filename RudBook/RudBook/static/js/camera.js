// Camera and Media Capture functionality
class CameraManager {
    constructor() {
        this.stream = null;
        this.video = null;
        this.canvas = null;
        this.context = null;
        this.isRecording = false;
        this.mediaRecorder = null;
        this.recordedChunks = [];
        this.currentFilter = null;
        this.faceDetector = null;
        
        this.initializeFaceDetection();
    }
    
    async initializeFaceDetection() {
        try {
            // Check if face detection is supported
            if ('FaceDetector' in window) {
                this.faceDetector = new FaceDetector({
                    fastMode: true,
                    maxDetectedFaces: 1
                });
            }
        } catch (error) {
            console.log('Face detection not supported:', error);
        }
    }
    
    async startCamera(videoElement, canvasElement) {
        try {
            this.video = videoElement;
            this.canvas = canvasElement;
            this.context = canvasElement.getContext('2d');
            
            // Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    facingMode: 'user'
                },
                audio: true
            });
            
            this.video.srcObject = this.stream;
            
            // Start face detection when video loads
            this.video.addEventListener('loadedmetadata', () => {
                this.video.play();
                this.startFaceDetection();
            });
            
            return true;
        } catch (error) {
            console.error('Error accessing camera:', error);
            this.showCameraError(error);
            return false;
        }
    }
    
    stopCamera() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.video) {
            this.video.srcObject = null;
        }
        
        this.stopFaceDetection();
    }
    
    async switchCamera() {
        if (!this.stream) return;
        
        const videoTrack = this.stream.getVideoTracks()[0];
        const constraints = videoTrack.getSettings();
        
        // Toggle between front and back camera
        const newFacingMode = constraints.facingMode === 'user' ? 'environment' : 'user';
        
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { 
                    ...constraints,
                    facingMode: newFacingMode
                },
                audio: true
            });
            
            this.stopCamera();
            this.stream = newStream;
            this.video.srcObject = newStream;
            this.video.play();
            this.startFaceDetection();
        } catch (error) {
            console.error('Error switching camera:', error);
        }
    }
    
    capturePhoto() {
        if (!this.video || !this.canvas) return null;
        
        // Set canvas size to match video
        this.canvas.width = this.video.videoWidth;
        this.canvas.height = this.video.videoHeight;
        
        // Draw video frame to canvas
        this.context.drawImage(this.video, 0, 0);
        
        // Apply filters if any
        if (this.currentFilter) {
            this.applyFilter(this.currentFilter);
        }
        
        // Convert to blob
        return new Promise((resolve) => {
            this.canvas.toBlob((blob) => {
                resolve(blob);
            }, 'image/jpeg', 0.8);
        });
    }
    
    async startVideoRecording() {
        if (!this.stream || this.isRecording) return false;
        
        try {
            this.recordedChunks = [];
            
            const options = {
                mimeType: 'video/webm;codecs=vp9',
                videoBitsPerSecond: 2500000
            };
            
            this.mediaRecorder = new MediaRecorder(this.stream, options);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data && event.data.size > 0) {
                    this.recordedChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordedChunks, { type: 'video/webm' });
                this.onVideoRecorded(blob);
            };
            
            this.mediaRecorder.start(1000); // Collect data every second
            this.isRecording = true;
            
            return true;
        } catch (error) {
            console.error('Error starting video recording:', error);
            return false;
        }
    }
    
    stopVideoRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            return true;
        }
        return false;
    }
    
    onVideoRecorded(blob) {
        // Override this method to handle recorded video
        console.log('Video recorded:', blob);
    }
    
    applyFilter(filterName) {
        if (!this.context || !this.canvas) return;
        
        const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        const data = imageData.data;
        
        switch (filterName) {
            case 'vintage':
                this.applyVintageFilter(data);
                break;
            case 'sepia':
                this.applySepiaFilter(data);
                break;
            case 'blackwhite':
                this.applyBlackWhiteFilter(data);
                break;
            case 'warm':
                this.applyWarmFilter(data);
                break;
            case 'cool':
                this.applyCoolFilter(data);
                break;
            case 'blur':
                this.applyBlurFilter();
                return; // Blur is handled differently
        }
        
        this.context.putImageData(imageData, 0, 0);
    }
    
    applyVintageFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            data[i] = Math.min(255, r * 1.2 + 30);     // Red
            data[i + 1] = Math.min(255, g * 1.1 + 20); // Green
            data[i + 2] = Math.min(255, b * 0.8 + 10); // Blue
        }
    }
    
    applySepiaFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            data[i] = Math.min(255, (r * 0.393) + (g * 0.769) + (b * 0.189));
            data[i + 1] = Math.min(255, (r * 0.349) + (g * 0.686) + (b * 0.168));
            data[i + 2] = Math.min(255, (r * 0.272) + (g * 0.534) + (b * 0.131));
        }
    }
    
    applyBlackWhiteFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
            data[i] = gray;
            data[i + 1] = gray;
            data[i + 2] = gray;
        }
    }
    
    applyWarmFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * 1.1 + 15);     // More red
            data[i + 1] = Math.min(255, data[i + 1] * 1.05); // Slightly more green
            data[i + 2] = Math.min(255, data[i + 2] * 0.9);  // Less blue
        }
    }
    
    applyCoolFilter(data) {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.min(255, data[i] * 0.9);          // Less red
            data[i + 1] = Math.min(255, data[i + 1] * 1.05); // Slightly more green
            data[i + 2] = Math.min(255, data[i + 2] * 1.1);  // More blue
        }
    }
    
    applyBlurFilter() {
        this.context.filter = 'blur(3px)';
        const imageData = this.context.getImageData(0, 0, this.canvas.width, this.canvas.height);
        this.context.putImageData(imageData, 0, 0);
        this.context.filter = 'none';
    }
    
    async startFaceDetection() {
        if (!this.faceDetector || !this.video) return;
        
        const detectFaces = async () => {
            if (this.video.readyState === this.video.HAVE_ENOUGH_DATA) {
                try {
                    const faces = await this.faceDetector.detect(this.video);
                    this.onFacesDetected(faces);
                } catch (error) {
                    console.error('Face detection error:', error);
                }
            }
            
            if (this.video.srcObject) {
                requestAnimationFrame(detectFaces);
            }
        };
        
        detectFaces();
    }
    
    stopFaceDetection() {
        // Face detection stops automatically when video stops
    }
    
    onFacesDetected(faces) {
        // Override this method to handle detected faces
        // This can be used to apply face-specific filters
        console.log('Faces detected:', faces.length);
    }
    
    setFilter(filterName) {
        this.currentFilter = filterName;
    }
    
    clearFilter() {
        this.currentFilter = null;
    }
    
    showCameraError(error) {
        let message = 'حدث خطأ في الوصول إلى الكاميرا';
        
        if (error.name === 'NotAllowedError') {
            message = 'يرجى السماح بالوصول إلى الكاميرا لالتقاط الصور';
        } else if (error.name === 'NotFoundError') {
            message = 'لم يتم العثور على كاميرا في هذا الجهاز';
        } else if (error.name === 'NotSupportedError') {
            message = 'المتصفح لا يدعم الوصول إلى الكاميرا';
        }
        
        // Show error message to user
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            alert(message);
        }
    }
    
    // Utility methods
    dataURLtoBlob(dataURL) {
        const arr = dataURL.split(',');
        const mime = arr[0].match(/:(.*?);/)[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        
        while (n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        
        return new Blob([u8arr], { type: mime });
    }
    
    async compressImage(file, quality = 0.8, maxWidth = 1024, maxHeight = 1024) {
        return new Promise((resolve) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // Calculate new dimensions
                let { width, height } = img;
                
                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Draw and compress
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob(resolve, 'image/jpeg', quality);
            };
            
            img.src = URL.createObjectURL(file);
        });
    }
}

// Story Camera Modal Manager
class StoryCameraModal {
    constructor() {
        this.cameraManager = new CameraManager();
        this.modal = null;
        this.isVisible = false;
        this.currentMode = 'photo'; // 'photo' or 'video'
        this.recordingTimer = null;
        this.recordingStartTime = null;
        
        this.createModal();
        this.setupEventListeners();
    }
    
    createModal() {
        const modalHTML = `
            <div class="modal fade" id="storyCameraModal" tabindex="-1" aria-hidden="true">
                <div class="modal-dialog modal-fullscreen">
                    <div class="modal-content camera-modal-content">
                        <div class="camera-header">
                            <button class="camera-btn camera-close" onclick="storyCameraModal.close()">
                                <i class="fas fa-times"></i>
                            </button>
                            
                            <div class="camera-title">إنشاء قصة</div>
                            
                            <button class="camera-btn camera-switch" onclick="storyCameraModal.switchCamera()">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        </div>
                        
                        <div class="camera-container">
                            <video id="storyCameraVideo" autoplay muted playsinline></video>
                            <canvas id="storyCameraCanvas" style="display: none;"></canvas>
                            
                            <div class="camera-overlay">
                                <div class="recording-indicator" id="recordingIndicator" style="display: none;">
                                    <div class="recording-dot"></div>
                                    <span class="recording-time">00:00</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="camera-filters">
                            <div class="filters-scroll">
                                <button class="filter-btn active" data-filter="" onclick="storyCameraModal.setFilter('')">
                                    <span>بلا فلتر</span>
                                </button>
                                <button class="filter-btn" data-filter="vintage" onclick="storyCameraModal.setFilter('vintage')">
                                    <span>عتيق</span>
                                </button>
                                <button class="filter-btn" data-filter="sepia" onclick="storyCameraModal.setFilter('sepia')">
                                    <span>سيبيا</span>
                                </button>
                                <button class="filter-btn" data-filter="blackwhite" onclick="storyCameraModal.setFilter('blackwhite')">
                                    <span>أبيض وأسود</span>
                                </button>
                                <button class="filter-btn" data-filter="warm" onclick="storyCameraModal.setFilter('warm')">
                                    <span>دافئ</span>
                                </button>
                                <button class="filter-btn" data-filter="cool" onclick="storyCameraModal.setFilter('cool')">
                                    <span>بارد</span>
                                </button>
                            </div>
                        </div>
                        
                        <div class="camera-controls">
                            <button class="camera-mode-btn ${this.currentMode === 'photo' ? 'active' : ''}" 
                                    onclick="storyCameraModal.setMode('photo')">
                                <i class="fas fa-camera"></i>
                                <span>صورة</span>
                            </button>
                            
                            <div class="capture-button-container">
                                <button class="capture-btn" id="captureBtn" onclick="storyCameraModal.capture()">
                                    <div class="capture-inner"></div>
                                </button>
                            </div>
                            
                            <button class="camera-mode-btn ${this.currentMode === 'video' ? 'active' : ''}" 
                                    onclick="storyCameraModal.setMode('video')">
                                <i class="fas fa-video"></i>
                                <span>فيديو</span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        this.modal = new bootstrap.Modal(document.getElementById('storyCameraModal'));
        
        // Add custom styles
        this.addStyles();
    }
    
    addStyles() {
        const styles = `
            <style id="camera-modal-styles">
                .camera-modal-content {
                    background: #000;
                    border: none;
                    border-radius: 0;
                }
                
                .camera-header {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    z-index: 20;
                    background: linear-gradient(to bottom, rgba(0,0,0,0.7), transparent);
                    padding: 20px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                
                .camera-title {
                    color: white;
                    font-size: 1.2rem;
                    font-weight: 600;
                }
                
                .camera-btn {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    width: 45px;
                    height: 45px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    font-size: 1.2rem;
                }
                
                .camera-btn:hover {
                    background: rgba(255,255,255,0.3);
                    transform: scale(1.05);
                }
                
                .camera-container {
                    position: relative;
                    width: 100%;
                    height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }
                
                #storyCameraVideo {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .camera-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    pointer-events: none;
                }
                
                .recording-indicator {
                    position: absolute;
                    top: 80px;
                    left: 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    background: rgba(0,0,0,0.7);
                    padding: 8px 15px;
                    border-radius: 20px;
                    color: white;
                }
                
                .recording-dot {
                    width: 12px;
                    height: 12px;
                    background: #ff3333;
                    border-radius: 50%;
                    animation: pulse 1s infinite;
                }
                
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
                
                .camera-filters {
                    position: absolute;
                    bottom: 120px;
                    left: 0;
                    right: 0;
                    z-index: 15;
                }
                
                .filters-scroll {
                    display: flex;
                    gap: 10px;
                    overflow-x: auto;
                    padding: 0 20px;
                    scrollbar-width: none;
                }
                
                .filters-scroll::-webkit-scrollbar {
                    display: none;
                }
                
                .filter-btn {
                    background: rgba(255,255,255,0.2);
                    border: 2px solid transparent;
                    color: white;
                    padding: 8px 15px;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    white-space: nowrap;
                    font-size: 0.9rem;
                }
                
                .filter-btn.active {
                    background: rgba(211,47,47,0.8);
                    border-color: #d32f2f;
                }
                
                .filter-btn:hover {
                    background: rgba(255,255,255,0.3);
                }
                
                .camera-controls {
                    position: absolute;
                    bottom: 30px;
                    left: 0;
                    right: 0;
                    z-index: 15;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 0 40px;
                }
                
                .camera-mode-btn {
                    background: rgba(255,255,255,0.2);
                    border: 2px solid transparent;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 25px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 5px;
                    font-size: 0.8rem;
                }
                
                .camera-mode-btn.active {
                    background: rgba(211,47,47,0.8);
                    border-color: #d32f2f;
                }
                
                .camera-mode-btn i {
                    font-size: 1.2rem;
                }
                
                .capture-button-container {
                    position: relative;
                }
                
                .capture-btn {
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    border: 4px solid white;
                    background: rgba(255,255,255,0.3);
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .capture-btn:hover {
                    transform: scale(1.05);
                    box-shadow: 0 0 20px rgba(255,255,255,0.5);
                }
                
                .capture-btn.recording {
                    border-color: #ff3333;
                    background: rgba(255,51,51,0.3);
                    animation: pulse 1s infinite;
                }
                
                .capture-inner {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    background: white;
                    transition: all 0.3s ease;
                }
                
                .capture-btn.recording .capture-inner {
                    border-radius: 8px;
                    background: #ff3333;
                    width: 30px;
                    height: 30px;
                }
                
                @media (max-width: 768px) {
                    .camera-header {
                        padding: 15px;
                    }
                    
                    .camera-controls {
                        bottom: 20px;
                        padding: 0 20px;
                    }
                    
                    .camera-mode-btn {
                        padding: 10px 15px;
                        font-size: 0.7rem;
                    }
                    
                    .capture-btn {
                        width: 70px;
                        height: 70px;
                    }
                    
                    .capture-inner {
                        width: 50px;
                        height: 50px;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    setupEventListeners() {
        // Override camera manager events
        this.cameraManager.onVideoRecorded = (blob) => {
            this.handleCapturedMedia(blob, 'video');
        };
    }
    
    async show() {
        if (this.isVisible) return;
        
        this.modal.show();
        this.isVisible = true;
        
        // Start camera when modal is shown
        const video = document.getElementById('storyCameraVideo');
        const canvas = document.getElementById('storyCameraCanvas');
        
        const success = await this.cameraManager.startCamera(video, canvas);
        if (!success) {
            this.close();
        }
    }
    
    close() {
        if (!this.isVisible) return;
        
        this.cameraManager.stopCamera();
        this.stopRecording();
        this.modal.hide();
        this.isVisible = false;
    }
    
    async switchCamera() {
        await this.cameraManager.switchCamera();
    }
    
    setFilter(filterName) {
        this.cameraManager.setFilter(filterName);
        
        // Update UI
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-filter="${filterName}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
    }
    
    setMode(mode) {
        this.currentMode = mode;
        
        // Update UI
        document.querySelectorAll('.camera-mode-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        document.querySelector(`[onclick*="setMode('${mode}')"]`).classList.add('active');
        
        // Update capture button
        const captureBtn = document.getElementById('captureBtn');
        const captureInner = captureBtn.querySelector('.capture-inner');
        
        if (mode === 'video') {
            captureInner.style.borderRadius = '8px';
        } else {
            captureInner.style.borderRadius = '50%';
        }
    }
    
    async capture() {
        if (this.currentMode === 'photo') {
            const blob = await this.cameraManager.capturePhoto();
            if (blob) {
                this.handleCapturedMedia(blob, 'photo');
            }
        } else {
            if (this.cameraManager.isRecording) {
                this.stopRecording();
            } else {
                this.startRecording();
            }
        }
    }
    
    async startRecording() {
        const success = await this.cameraManager.startVideoRecording();
        if (success) {
            // Update UI
            const captureBtn = document.getElementById('captureBtn');
            const recordingIndicator = document.getElementById('recordingIndicator');
            
            captureBtn.classList.add('recording');
            recordingIndicator.style.display = 'flex';
            
            // Start timer
            this.recordingStartTime = Date.now();
            this.recordingTimer = setInterval(() => {
                this.updateRecordingTime();
            }, 1000);
        }
    }
    
    stopRecording() {
        this.cameraManager.stopVideoRecording();
        
        // Update UI
        const captureBtn = document.getElementById('captureBtn');
        const recordingIndicator = document.getElementById('recordingIndicator');
        
        captureBtn.classList.remove('recording');
        recordingIndicator.style.display = 'none';
        
        // Stop timer
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }
    
    updateRecordingTime() {
        if (!this.recordingStartTime) return;
        
        const elapsed = Math.floor((Date.now() - this.recordingStartTime) / 1000);
        const minutes = Math.floor(elapsed / 60);
        const seconds = elapsed % 60;
        
        const timeText = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        document.querySelector('.recording-time').textContent = timeText;
    }
    
    async handleCapturedMedia(blob, type) {
        // Close camera modal
        this.close();
        
        // Create form data
        const formData = new FormData();
        const filename = `story_${Date.now()}.${type === 'video' ? 'webm' : 'jpg'}`;
        formData.append('story_media', blob, filename);
        
        if (this.cameraManager.currentFilter) {
            formData.append('filter_name', this.cameraManager.currentFilter);
        }
        
        // Show processing message
        if (typeof showToast === 'function') {
            showToast('جارٍ رفع القصة...', 'info');
        }
        
        try {
            // Upload story
            const response = await fetch('/create_story', {
                method: 'POST',
                body: formData
            });
            
            if (response.ok) {
                if (typeof showToast === 'function') {
                    showToast('تم إضافة القصة بنجاح!', 'success');
                }
                
                // Reload page to show new story
                setTimeout(() => {
                    window.location.reload();
                }, 1000);
            } else {
                throw new Error('فشل في رفع القصة');
            }
        } catch (error) {
            console.error('Error uploading story:', error);
            if (typeof showToast === 'function') {
                showToast('حدث خطأ أثناء رفع القصة', 'error');
            }
        }
    }
}

// Initialize story camera modal
let storyCameraModal;

document.addEventListener('DOMContentLoaded', function() {
    storyCameraModal = new StoryCameraModal();
});

// Global functions
function openStoryCamera() {
    if (storyCameraModal) {
        storyCameraModal.show();
    }
}

function closeStoryCamera() {
    if (storyCameraModal) {
        storyCameraModal.close();
    }
}

// Export for use in other files
window.CameraManager = CameraManager;
window.StoryCameraModal = StoryCameraModal;
