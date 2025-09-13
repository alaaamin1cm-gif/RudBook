// Advanced Face Filters and AR Effects
class FaceFiltersManager {
    constructor() {
        this.canvas = null;
        this.context = null;
        this.video = null;
        this.isActive = false;
        this.currentFilter = null;
        this.detectedFaces = [];
        this.filterAssets = {};
        
        this.initializeFilters();
    }
    
    initializeFilters() {
        // Define available filters with their properties
        this.filters = {
            'dog_ears': {
                name: 'آذان الكلب',
                type: 'overlay',
                asset: 'dog_ears.png',
                position: 'top'
            },
            'cat_ears': {
                name: 'آذان القطة',
                type: 'overlay', 
                asset: 'cat_ears.png',
                position: 'top'
            },
            'crown': {
                name: 'تاج',
                type: 'overlay',
                asset: 'crown.png',
                position: 'top'
            },
            'glasses': {
                name: 'نظارات',
                type: 'overlay',
                asset: 'glasses.png',
                position: 'eyes'
            },
            'mustache': {
                name: 'شارب',
                type: 'overlay',
                asset: 'mustache.png',
                position: 'mouth'
            },
            'heart_eyes': {
                name: 'عيون قلوب',
                type: 'overlay',
                asset: 'heart_eyes.png',
                position: 'eyes'
            },
            'rainbow': {
                name: 'قوس قزح',
                type: 'background',
                effect: 'rainbow_background'
            },
            'sparkles': {
                name: 'تألق',
                type: 'particles',
                effect: 'sparkle_particles'
            },
            'beauty': {
                name: 'تجميل',
                type: 'enhancement',
                effect: 'skin_smoothing'
            },
            'vintage_frame': {
                name: 'إطار عتيق',
                type: 'frame',
                asset: 'vintage_frame.png'
            }
        };
        
        this.loadFilterAssets();
    }
    
    loadFilterAssets() {
        // Load filter assets (SVG icons as placeholders for actual images)
        this.filterAssets = {
            'dog_ears': this.createSVGAsset('dog_ears'),
            'cat_ears': this.createSVGAsset('cat_ears'),
            'crown': this.createSVGAsset('crown'),
            'glasses': this.createSVGAsset('glasses'),
            'mustache': this.createSVGAsset('mustache'),
            'heart_eyes': this.createSVGAsset('heart_eyes'),
            'vintage_frame': this.createSVGAsset('vintage_frame')
        };
    }
    
    createSVGAsset(type) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 200;
        canvas.height = 100;
        
        ctx.fillStyle = '#FF6B6B';
        ctx.strokeStyle = '#4ECDC4';
        ctx.lineWidth = 3;
        
        switch(type) {
            case 'dog_ears':
                // Draw dog ears
                ctx.beginPath();
                ctx.ellipse(50, 30, 25, 40, 0, 0, 2 * Math.PI);
                ctx.ellipse(150, 30, 25, 40, 0, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'cat_ears':
                // Draw cat ears (triangular)
                ctx.beginPath();
                ctx.moveTo(30, 60);
                ctx.lineTo(50, 10);
                ctx.lineTo(70, 60);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                
                ctx.beginPath();
                ctx.moveTo(130, 60);
                ctx.lineTo(150, 10);
                ctx.lineTo(170, 60);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'crown':
                // Draw crown
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.moveTo(20, 70);
                ctx.lineTo(40, 20);
                ctx.lineTo(60, 40);
                ctx.lineTo(80, 15);
                ctx.lineTo(100, 25);
                ctx.lineTo(120, 15);
                ctx.lineTo(140, 40);
                ctx.lineTo(160, 20);
                ctx.lineTo(180, 70);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                break;
                
            case 'glasses':
                // Draw glasses
                ctx.fillStyle = 'rgba(0,0,0,0.3)';
                ctx.strokeStyle = '#333';
                ctx.lineWidth = 4;
                
                // Left lens
                ctx.beginPath();
                ctx.arc(60, 50, 30, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                
                // Right lens  
                ctx.beginPath();
                ctx.arc(140, 50, 30, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
                
                // Bridge
                ctx.beginPath();
                ctx.moveTo(90, 45);
                ctx.lineTo(110, 45);
                ctx.stroke();
                break;
                
            case 'mustache':
                // Draw mustache
                ctx.fillStyle = '#654321';
                ctx.beginPath();
                ctx.ellipse(100, 50, 50, 15, 0, 0, 2 * Math.PI);
                ctx.fill();
                
                // Add curl details
                ctx.beginPath();
                ctx.ellipse(60, 45, 15, 8, -0.5, 0, 2 * Math.PI);
                ctx.ellipse(140, 45, 15, 8, 0.5, 0, 2 * Math.PI);
                ctx.fill();
                break;
                
            case 'heart_eyes':
                // Draw heart shapes
                ctx.fillStyle = '#FF1493';
                for (let x of [60, 140]) {
                    ctx.beginPath();
                    ctx.moveTo(x, 45);
                    ctx.bezierCurveTo(x - 15, 35, x - 25, 45, x, 60);
                    ctx.bezierCurveTo(x + 25, 45, x + 15, 35, x, 45);
                    ctx.fill();
                }
                break;
                
            case 'vintage_frame':
                // Draw vintage frame
                ctx.strokeStyle = '#8B4513';
                ctx.lineWidth = 15;
                ctx.setLineDash([10, 5]);
                ctx.strokeRect(10, 10, 180, 80);
                
                // Add decorative corners
                ctx.fillStyle = '#DAA520';
                ctx.setLineDash([]);
                for (let corner of [[10,10], [190,10], [10,90], [190,90]]) {
                    ctx.fillRect(corner[0]-5, corner[1]-5, 10, 10);
                }
                break;
        }
        
        return canvas;
    }
    
    initialize(video, canvas) {
        this.video = video;
        this.canvas = canvas;
        this.context = canvas.getContext('2d');
        this.isActive = true;
        
        this.startFilterLoop();
    }
    
    destroy() {
        this.isActive = false;
        this.video = null;
        this.canvas = null;
        this.context = null;
    }
    
    startFilterLoop() {
        const renderFilters = () => {
            if (!this.isActive || !this.video || !this.canvas) return;
            
            // Draw video frame
            this.context.drawImage(this.video, 0, 0, this.canvas.width, this.canvas.height);
            
            // Apply current filter
            if (this.currentFilter && this.detectedFaces.length > 0) {
                this.applyFaceFilter(this.currentFilter);
            }
            
            requestAnimationFrame(renderFilters);
        };
        
        renderFilters();
    }
    
    setFilter(filterName) {
        this.currentFilter = filterName;
    }
    
    clearFilter() {
        this.currentFilter = null;
    }
    
    updateFaces(faces) {
        this.detectedFaces = faces;
    }
    
    applyFaceFilter(filterName) {
        const filter = this.filters[filterName];
        if (!filter) return;
        
        for (const face of this.detectedFaces) {
            switch(filter.type) {
                case 'overlay':
                    this.applyOverlayFilter(filter, face);
                    break;
                case 'enhancement':
                    this.applyEnhancementFilter(filter, face);
                    break;
                case 'particles':
                    this.applyParticleFilter(filter, face);
                    break;
                case 'background':
                    this.applyBackgroundFilter(filter);
                    break;
                case 'frame':
                    this.applyFrameFilter(filter);
                    break;
            }
        }
    }
    
    applyOverlayFilter(filter, face) {
        const asset = this.filterAssets[filter.asset?.replace('.png', '')];
        if (!asset) return;
        
        const faceWidth = face.boundingBox.width;
        const faceHeight = face.boundingBox.height;
        const faceX = face.boundingBox.x;
        const faceY = face.boundingBox.y;
        
        let x, y, width, height;
        
        switch(filter.position) {
            case 'top':
                width = faceWidth * 1.2;
                height = faceHeight * 0.6;
                x = faceX - (width - faceWidth) / 2;
                y = faceY - height * 0.8;
                break;
                
            case 'eyes':
                width = faceWidth * 0.8;
                height = faceHeight * 0.3;
                x = faceX + (faceWidth - width) / 2;
                y = faceY + faceHeight * 0.25;
                break;
                
            case 'mouth':
                width = faceWidth * 0.5;
                height = faceHeight * 0.2;
                x = faceX + (faceWidth - width) / 2;
                y = faceY + faceHeight * 0.7;
                break;
                
            default:
                width = faceWidth;
                height = faceHeight;
                x = faceX;
                y = faceY;
        }
        
        this.context.drawImage(asset, x, y, width, height);
    }
    
    applyEnhancementFilter(filter, face) {
        if (filter.effect === 'skin_smoothing') {
            this.applySkinSmoothing(face);
        }
    }
    
    applySkinSmoothing(face) {
        const x = face.boundingBox.x;
        const y = face.boundingBox.y;
        const width = face.boundingBox.width;
        const height = face.boundingBox.height;
        
        // Get face region
        const imageData = this.context.getImageData(x, y, width, height);
        const data = imageData.data;
        
        // Apply simple smoothing filter
        for (let i = 0; i < data.length; i += 4) {
            // Slightly brighten skin tones
            data[i] = Math.min(255, data[i] * 1.05);     // Red
            data[i + 1] = Math.min(255, data[i + 1] * 1.03); // Green
            data[i + 2] = Math.min(255, data[i + 2] * 1.01); // Blue
        }
        
        this.context.putImageData(imageData, x, y);
    }
    
    applyParticleFilter(filter, face) {
        if (filter.effect === 'sparkle_particles') {
            this.drawSparkles(face);
        }
    }
    
    drawSparkles(face) {
        const centerX = face.boundingBox.x + face.boundingBox.width / 2;
        const centerY = face.boundingBox.y + face.boundingBox.height / 2;
        const radius = Math.max(face.boundingBox.width, face.boundingBox.height) / 2;
        
        // Draw animated sparkles
        const time = Date.now() * 0.005;
        
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + time;
            const distance = radius * (0.8 + 0.4 * Math.sin(time * 2 + i));
            const x = centerX + Math.cos(angle) * distance;
            const y = centerY + Math.sin(angle) * distance;
            
            this.drawStar(x, y, 8, 2, 5);
        }
    }
    
    drawStar(cx, cy, spikes, outerRadius, innerRadius) {
        let rot = Math.PI / 2 * 3;
        let x = cx;
        let y = cy;
        const step = Math.PI / spikes;
        
        this.context.beginPath();
        this.context.moveTo(cx, cy - outerRadius);
        
        for (let i = 0; i < spikes; i++) {
            x = cx + Math.cos(rot) * outerRadius;
            y = cy + Math.sin(rot) * outerRadius;
            this.context.lineTo(x, y);
            rot += step;
            
            x = cx + Math.cos(rot) * innerRadius;
            y = cy + Math.sin(rot) * innerRadius;
            this.context.lineTo(x, y);
            rot += step;
        }
        
        this.context.lineTo(cx, cy - outerRadius);
        this.context.closePath();
        
        this.context.fillStyle = '#FFD700';
        this.context.fill();
        this.context.strokeStyle = '#FFA500';
        this.context.lineWidth = 2;
        this.context.stroke();
    }
    
    applyBackgroundFilter(filter) {
        if (filter.effect === 'rainbow_background') {
            this.drawRainbowBackground();
        }
    }
    
    drawRainbowBackground() {
        const gradient = this.context.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#ff0000');
        gradient.addColorStop(0.17, '#ff8c00');
        gradient.addColorStop(0.33, '#ffd700');
        gradient.addColorStop(0.5, '#90ee90');
        gradient.addColorStop(0.67, '#87ceeb');
        gradient.addColorStop(0.83, '#4169e1');
        gradient.addColorStop(1, '#9932cc');
        
        this.context.globalCompositeOperation = 'multiply';
        this.context.fillStyle = gradient;
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.globalCompositeOperation = 'source-over';
    }
    
    applyFrameFilter(filter) {
        const asset = this.filterAssets[filter.asset?.replace('.png', '')];
        if (!asset) return;
        
        // Draw frame around entire canvas
        this.context.drawImage(asset, 0, 0, this.canvas.width, this.canvas.height);
    }
    
    getAvailableFilters() {
        return Object.keys(this.filters).map(key => ({
            id: key,
            name: this.filters[key].name,
            type: this.filters[key].type
        }));
    }
    
    // Utility function to create filter preview
    createFilterPreview(filterName, size = 60) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = size;
        canvas.height = size;
        
        // Draw a simple preview based on filter type
        const filter = this.filters[filterName];
        if (!filter) return canvas;
        
        ctx.fillStyle = '#f0f0f0';
        ctx.fillRect(0, 0, size, size);
        
        // Draw a simple face outline
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(size/2, size/2, size/3, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Add filter-specific preview
        const asset = this.filterAssets[filterName];
        if (asset) {
            const scale = size / 200; // Scale down from original asset size
            ctx.drawImage(asset, 0, 0, 200, 100, 0, 0, 200 * scale, 100 * scale);
        }
        
        return canvas;
    }
}

// Face Filter UI Component
class FaceFilterUI {
    constructor(filtersManager) {
        this.filtersManager = filtersManager;
        this.container = null;
        this.isVisible = false;
        
        this.createUI();
    }
    
    createUI() {
        const filtersHTML = `
            <div class="face-filters-container" id="faceFiltersContainer" style="display: none;">
                <div class="filters-header">
                    <h4>فلاتر الوجه</h4>
                    <button class="close-filters-btn" onclick="faceFilterUI.hide()">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="filters-grid">
                    <div class="filter-option" data-filter="" onclick="faceFilterUI.selectFilter('')">
                        <div class="filter-preview no-filter">
                            <i class="fas fa-user"></i>
                        </div>
                        <span>بدون فلتر</span>
                    </div>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', filtersHTML);
        this.container = document.getElementById('faceFiltersContainer');
        
        this.populateFilters();
        this.addStyles();
    }
    
    populateFilters() {
        const filtersGrid = this.container.querySelector('.filters-grid');
        const filters = this.filtersManager.getAvailableFilters();
        
        filters.forEach(filter => {
            const filterElement = document.createElement('div');
            filterElement.className = 'filter-option';
            filterElement.dataset.filter = filter.id;
            filterElement.onclick = () => this.selectFilter(filter.id);
            
            const preview = this.filtersManager.createFilterPreview(filter.id);
            
            filterElement.innerHTML = `
                <div class="filter-preview">
                    ${preview.outerHTML}
                </div>
                <span>${filter.name}</span>
            `;
            
            filtersGrid.appendChild(filterElement);
        });
    }
    
    addStyles() {
        const styles = `
            <style id="face-filters-styles">
                .face-filters-container {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background: white;
                    border-top-left-radius: 20px;
                    border-top-right-radius: 20px;
                    box-shadow: 0 -5px 20px rgba(0,0,0,0.3);
                    z-index: 1000;
                    max-height: 50vh;
                    overflow-y: auto;
                    direction: rtl;
                }
                
                .filters-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 20px;
                    border-bottom: 1px solid #eee;
                }
                
                .filters-header h4 {
                    margin: 0;
                    font-size: 1.2rem;
                    font-weight: 600;
                    color: #333;
                }
                
                .close-filters-btn {
                    background: none;
                    border: none;
                    color: #666;
                    font-size: 1.2rem;
                    cursor: pointer;
                    padding: 5px;
                    border-radius: 50%;
                    width: 35px;
                    height: 35px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }
                
                .close-filters-btn:hover {
                    background: #f0f0f0;
                }
                
                .filters-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
                    gap: 15px;
                    padding: 20px;
                }
                
                .filter-option {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    padding: 10px;
                    border-radius: 12px;
                    transition: all 0.3s ease;
                }
                
                .filter-option:hover {
                    background: #f8f9fa;
                    transform: translateY(-2px);
                }
                
                .filter-option.active {
                    background: rgba(211,47,47,0.1);
                    color: #d32f2f;
                }
                
                .filter-preview {
                    width: 60px;
                    height: 60px;
                    border-radius: 50%;
                    overflow: hidden;
                    border: 3px solid #eee;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f8f9fa;
                    transition: all 0.3s ease;
                }
                
                .filter-option.active .filter-preview {
                    border-color: #d32f2f;
                    box-shadow: 0 0 0 2px rgba(211,47,47,0.2);
                }
                
                .filter-preview canvas {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                }
                
                .filter-preview.no-filter {
                    color: #666;
                    font-size: 1.5rem;
                }
                
                .filter-option span {
                    font-size: 0.8rem;
                    text-align: center;
                    font-weight: 500;
                }
                
                @media (max-width: 768px) {
                    .filters-grid {
                        grid-template-columns: repeat(auto-fill, minmax(70px, 1fr));
                        gap: 10px;
                        padding: 15px;
                    }
                    
                    .filter-preview {
                        width: 50px;
                        height: 50px;
                    }
                    
                    .filter-option span {
                        font-size: 0.7rem;
                    }
                }
            </style>
        `;
        
        document.head.insertAdjacentHTML('beforeend', styles);
    }
    
    show() {
        if (this.container) {
            this.container.style.display = 'block';
            this.isVisible = true;
            
            // Animate in
            this.container.style.transform = 'translateY(100%)';
            requestAnimationFrame(() => {
                this.container.style.transition = 'transform 0.3s ease';
                this.container.style.transform = 'translateY(0)';
            });
        }
    }
    
    hide() {
        if (this.container) {
            this.container.style.transform = 'translateY(100%)';
            setTimeout(() => {
                this.container.style.display = 'none';
                this.isVisible = false;
            }, 300);
        }
    }
    
    selectFilter(filterId) {
        // Update active state
        this.container.querySelectorAll('.filter-option').forEach(option => {
            option.classList.remove('active');
        });
        
        const selectedOption = this.container.querySelector(`[data-filter="${filterId}"]`);
        if (selectedOption) {
            selectedOption.classList.add('active');
        }
        
        // Apply filter
        this.filtersManager.setFilter(filterId);
        
        // Hide UI after selection
        setTimeout(() => {
            this.hide();
        }, 500);
    }
    
    toggle() {
        if (this.isVisible) {
            this.hide();
        } else {
            this.show();
        }
    }
}

// Initialize face filters
let faceFiltersManager;
let faceFilterUI;

document.addEventListener('DOMContentLoaded', function() {
    faceFiltersManager = new FaceFiltersManager();
    faceFilterUI = new FaceFilterUI(faceFiltersManager);
});

// Global functions
function showFaceFilters() {
    if (faceFilterUI) {
        faceFilterUI.show();
    }
}

function hideFaceFilters() {
    if (faceFilterUI) {
        faceFilterUI.hide();
    }
}

function toggleFaceFilters() {
    if (faceFilterUI) {
        faceFilterUI.toggle();
    }
}

// Export for use in other files
window.FaceFiltersManager = FaceFiltersManager;
window.FaceFilterUI = FaceFilterUI;
