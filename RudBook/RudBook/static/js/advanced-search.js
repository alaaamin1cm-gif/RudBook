// Advanced Search JavaScript
let searchTimeout;
let isSearching = false;

// Initialize advanced search
document.addEventListener('DOMContentLoaded', function() {
    initializeAdvancedSearch();
    
    // Get query from URL if present
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q');
    if (query) {
        document.getElementById('searchQuery').value = query;
        performAdvancedSearch();
    }
});

function initializeAdvancedSearch() {
    const searchForm = document.getElementById('advancedSearchForm');
    const searchQuery = document.getElementById('searchQuery');
    
    // Form submission
    searchForm.addEventListener('submit', function(e) {
        e.preventDefault();
        performAdvancedSearch();
    });
    
    // Real-time search
    searchQuery.addEventListener('input', function() {
        clearTimeout(searchTimeout);
        const query = this.value.trim();
        
        if (query.length > 2) {
            searchTimeout = setTimeout(() => {
                performAdvancedSearch();
            }, 500);
        } else if (query.length === 0) {
            clearResults();
        }
    });
    
    // Filter changes
    document.querySelectorAll('input[name="searchType"], #sortBy, #dateRange, #postType').forEach(element => {
        element.addEventListener('change', function() {
            if (document.getElementById('searchQuery').value.trim().length > 0) {
                performAdvancedSearch();
            }
        });
    });
    
    // Voice search
    initializeVoiceSearch();
}

function performAdvancedSearch() {
    if (isSearching) return;
    
    const query = document.getElementById('searchQuery').value.trim();
    if (!query) {
        clearResults();
        return;
    }
    
    isSearching = true;
    showLoading();
    
    const searchParams = {
        q: query,
        type: document.querySelector('input[name="searchType"]:checked').value,
        sort: document.getElementById('sortBy').value,
        date_range: document.getElementById('dateRange').value,
        post_type: document.getElementById('postType').value,
        location: document.getElementById('location').value.trim(),
        verified_only: document.getElementById('verifiedOnly').checked,
        with_media: document.getElementById('withMedia').checked,
        following_only: document.getElementById('followingOnly').checked
    };
    
    // Build query string
    const queryString = Object.keys(searchParams)
        .filter(key => searchParams[key])
        .map(key => `${key}=${encodeURIComponent(searchParams[key])}`)
        .join('&');
    
    fetch(`/search?${queryString}`)
        .then(response => response.json())
        .then(data => {
            displayResults(data, query);
        })
        .catch(error => {
            console.error('Search error:', error);
            showError('حدث خطأ أثناء البحث. يرجى المحاولة مرة أخرى.');
        })
        .finally(() => {
            isSearching = false;
            hideLoading();
        });
}

function displayResults(results, query) {
    const totalResults = (results.users?.length || 0) + (results.posts?.length || 0) + (results.hashtags?.length || 0);
    
    if (totalResults === 0) {
        showEmptyResults(query);
        return;
    }
    
    // Show results header
    document.getElementById('searchResultsHeader').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';
    document.getElementById('resultsTitle').textContent = `نتائج البحث عن "${query}"`;
    document.getElementById('resultsCount').textContent = `${totalResults} نتيجة`;
    
    // Display all results
    displayAllResults(results);
    displayUserResults(results.users || []);
    displayPostResults(results.posts || []);
    displayHashtagResults(results.hashtags || []);
    
    // Update tab badges
    updateTabBadges(results);
}

function displayAllResults(results) {
    const container = document.getElementById('allResultsContainer');
    container.innerHTML = '';
    
    // Show top users
    if (results.users && results.users.length > 0) {
        const usersSection = createSection('المستخدمون', 'fas fa-users');
        results.users.slice(0, 3).forEach(user => {
            usersSection.appendChild(createUserResultCard(user));
        });
        container.appendChild(usersSection);
    }
    
    // Show top posts
    if (results.posts && results.posts.length > 0) {
        const postsSection = createSection('المنشورات', 'fas fa-edit');
        results.posts.slice(0, 5).forEach(post => {
            postsSection.appendChild(createPostResultCard(post));
        });
        container.appendChild(postsSection);
    }
    
    // Show hashtags
    if (results.hashtags && results.hashtags.length > 0) {
        const hashtagsSection = createSection('الهاشتاج', 'fas fa-hashtag');
        results.hashtags.forEach(hashtag => {
            hashtagsSection.appendChild(createHashtagResultCard(hashtag));
        });
        container.appendChild(hashtagsSection);
    }
}

function displayUserResults(users) {
    const container = document.getElementById('usersResultsContainer');
    container.innerHTML = '';
    
    if (users.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-muted">لا توجد مستخدمون مطابقون</div>';
        return;
    }
    
    users.forEach(user => {
        container.appendChild(createUserResultCard(user));
    });
}

function displayPostResults(posts) {
    const container = document.getElementById('postsResultsContainer');
    container.innerHTML = '';
    
    if (posts.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-muted">لا توجد منشورات مطابقة</div>';
        return;
    }
    
    posts.forEach(post => {
        container.appendChild(createPostResultCard(post));
    });
}

function displayHashtagResults(hashtags) {
    const container = document.getElementById('hashtagsResultsContainer');
    container.innerHTML = '';
    
    if (hashtags.length === 0) {
        container.innerHTML = '<div class="text-center py-4 text-muted">لا توجد هاشتاج مطابقة</div>';
        return;
    }
    
    hashtags.forEach(hashtag => {
        container.appendChild(createHashtagResultCard(hashtag));
    });
}

function createSection(title, icon) {
    const section = document.createElement('div');
    section.className = 'mb-4';
    section.innerHTML = `
        <h6 class="border-bottom pb-2 mb-3">
            <i class="${icon}"></i> ${title}
        </h6>
    `;
    return section;
}

function createUserResultCard(user) {
    const card = document.createElement('div');
    card.className = 'user-result-card';
    card.innerHTML = `
        <div class="d-flex align-items-center">
            <div class="me-3">
                <img src="/uploads/avatars/${user.avatar || 'default-avatar.png'}" 
                     alt="${user.full_name}" class="search-result-avatar">
            </div>
            <div class="flex-grow-1">
                <h6 class="mb-1">
                    <a href="/profile/${user.username}" class="text-decoration-none">
                        ${user.full_name}
                        ${user.is_verified ? '<i class="fas fa-check-circle verified-badge"></i>' : ''}
                    </a>
                </h6>
                <small class="text-muted">@${user.username}</small>
                ${user.bio ? `<p class="mb-1 mt-2 text-muted">${user.bio}</p>` : ''}
                <small class="text-muted">
                    <i class="fas fa-users"></i> ${user.follower_count} متابع
                </small>
            </div>
            <div>
                <button class="btn btn-outline-primary btn-sm" onclick="followUser(${user.id}, this)">
                    <i class="fas fa-user-plus"></i> متابعة
                </button>
            </div>
        </div>
    `;
    return card;
}

function createPostResultCard(post) {
    const card = document.createElement('div');
    card.className = 'post-result-card';
    
    const createdAt = new Date(post.created_at);
    const timeAgo = getTimeAgo(createdAt);
    
    card.innerHTML = `
        <div class="d-flex align-items-start">
            <div class="me-3">
                <img src="/uploads/avatars/${post.author.avatar || 'default-avatar.png'}" 
                     alt="${post.author.full_name}" class="search-result-avatar" style="width: 40px; height: 40px;">
            </div>
            <div class="flex-grow-1">
                <div class="d-flex align-items-center mb-2">
                    <h6 class="mb-0 me-2">
                        <a href="/profile/${post.author.username}" class="text-decoration-none">
                            ${post.author.full_name}
                        </a>
                    </h6>
                    <small class="text-muted">@${post.author.username} • ${timeAgo}</small>
                </div>
                
                ${post.content ? `<div class="search-result-content">${post.content}</div>` : ''}
                
                ${post.image_url ? `
                    <div class="mt-2">
                        <img src="/uploads/posts/${post.image_url}" class="img-fluid rounded" style="max-height: 200px;">
                    </div>
                ` : ''}
                
                ${post.location_name ? `
                    <div class="mt-2 text-muted">
                        <i class="fas fa-map-marker-alt"></i> ${post.location_name}
                    </div>
                ` : ''}
                
                <div class="mt-3 text-muted small">
                    <span class="me-3">
                        <i class="fas fa-heart"></i> ${post.like_count} إعجاب
                    </span>
                    <span>
                        <i class="fas fa-comment"></i> ${post.comment_count} تعليق
                    </span>
                </div>
            </div>
        </div>
    `;
    
    card.addEventListener('click', () => {
        window.location.href = `/post/${post.id}`;
    });
    
    return card;
}

function createHashtagResultCard(hashtag) {
    const card = document.createElement('div');
    card.className = 'post-result-card';
    card.innerHTML = `
        <div class="d-flex align-items-center justify-content-between">
            <div>
                <h6 class="mb-1">
                    <a href="#" class="text-decoration-none" onclick="searchHashtag('${hashtag.tag}')">
                        #${hashtag.tag}
                    </a>
                </h6>
                <small class="text-muted">${hashtag.post_count} منشور</small>
                
                ${hashtag.recent_posts && hashtag.recent_posts.length > 0 ? `
                    <div class="mt-2">
                        <small class="text-muted">منشورات حديثة:</small>
                        ${hashtag.recent_posts.map(post => `
                            <div class="mt-1">
                                <small><strong>${post.author_name}:</strong> ${post.content}</small>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            <div>
                <button class="btn btn-outline-primary btn-sm" onclick="followHashtag('${hashtag.tag}')">
                    <i class="fas fa-hashtag"></i> متابعة
                </button>
            </div>
        </div>
    `;
    return card;
}

function updateTabBadges(results) {
    // Update tab text with counts
    document.getElementById('users-tab').innerHTML = `
        <i class="fas fa-users"></i> المستخدمون ${results.users ? `(${results.users.length})` : '(0)'}
    `;
    document.getElementById('posts-tab').innerHTML = `
        <i class="fas fa-edit"></i> المنشورات ${results.posts ? `(${results.posts.length})` : '(0)'}
    `;
    document.getElementById('hashtags-tab').innerHTML = `
        <i class="fas fa-hashtag"></i> الهاشتاج ${results.hashtags ? `(${results.hashtags.length})` : '(0)'}
    `;
}

function showEmptyResults(query) {
    document.getElementById('searchResultsHeader').style.display = 'none';
    document.getElementById('emptyState').innerHTML = `
        <i class="fas fa-search text-muted" style="font-size: 4rem;"></i>
        <h4 class="mt-3 text-muted">لا توجد نتائج لـ "${query}"</h4>
        <p class="text-muted">جرب كلمات مختلفة أو تحقق من الإملاء</p>
    `;
    document.getElementById('emptyState').style.display = 'block';
}

function showLoading() {
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('emptyState').style.display = 'none';
}

function hideLoading() {
    document.getElementById('loadingState').style.display = 'none';
}

function showError(message) {
    document.getElementById('emptyState').innerHTML = `
        <i class="fas fa-exclamation-triangle text-warning" style="font-size: 4rem;"></i>
        <h4 class="mt-3 text-muted">حدث خطأ</h4>
        <p class="text-muted">${message}</p>
    `;
    document.getElementById('emptyState').style.display = 'block';
}

function clearResults() {
    document.getElementById('searchResultsHeader').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('emptyState').innerHTML = `
        <i class="fas fa-search text-muted" style="font-size: 4rem;"></i>
        <h4 class="mt-3 text-muted">ابحث في الكتاب الأحمر</h4>
        <p class="text-muted">ابحث عن الأصدقاء والمنشورات والهاشتاج والمزيد باستخدام البحث المتقدم.</p>
    `;
}

function clearFilters() {
    document.getElementById('advancedSearchForm').reset();
    document.getElementById('searchAll').checked = true;
    clearResults();
}

function searchHashtag(hashtag) {
    document.getElementById('searchQuery').value = `#${hashtag}`;
    document.getElementById('searchHashtags').checked = true;
    performAdvancedSearch();
}

// Voice Search
function initializeVoiceSearch() {
    const voiceBtn = document.getElementById('voiceSearchBtn');
    const voiceStatus = document.getElementById('voiceStatus');
    
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.lang = 'ar-SA';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        voiceBtn.addEventListener('click', function() {
            recognition.start();
            voiceStatus.style.display = 'block';
            voiceBtn.disabled = true;
        });
        
        recognition.onresult = function(event) {
            const transcript = event.results[0][0].transcript;
            document.getElementById('searchQuery').value = transcript;
            performAdvancedSearch();
        };
        
        recognition.onend = function() {
            voiceStatus.style.display = 'none';
            voiceBtn.disabled = false;
        };
        
        recognition.onerror = function(event) {
            console.error('Speech recognition error:', event.error);
            voiceStatus.style.display = 'none';
            voiceBtn.disabled = false;
        };
    } else {
        voiceBtn.style.display = 'none';
    }
}

// Utility functions
function getTimeAgo(date) {
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
    const diffMinutes = Math.ceil(diffTime / (1000 * 60));
    
    if (diffMinutes < 60) {
        return `منذ ${diffMinutes} دقيقة`;
    } else if (diffHours < 24) {
        return `منذ ${diffHours} ساعة`;
    } else if (diffDays < 7) {
        return `منذ ${diffDays} يوم`;
    } else {
        return date.toLocaleDateString('ar-SA');
    }
}

function followUser(userId, button) {
    // This function should be implemented in the main app.js
    if (typeof window.followUser === 'function') {
        window.followUser(userId, button);
    }
}

function followHashtag(hashtag) {
    // Future feature: follow hashtags
    console.log('Following hashtag:', hashtag);
}