// Global variables
let socket;
let currentUser;
let notifications = [];

// Initialize the app
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    
    // Initialize Socket.IO if user is authenticated
    if (document.querySelector('.user-profile')) {
        initializeSocket();
    }
});

function initializeApp() {
    // Set current user info
    const userProfile = document.querySelector('.user-profile .user-name');
    if (userProfile) {
        currentUser = {
            name: userProfile.textContent.trim()
        };
    }
    
    // Load notifications
    loadNotifications();
    
    // Setup search functionality
    setupSearch();
    
    // Setup story preview
    setupStoryPreview();
}

function setupEventListeners() {
    // Create post modal
    const createPostBtns = document.querySelectorAll('[onclick*="showCreatePost"]');
    createPostBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            showCreatePost(this.getAttribute('onclick').match(/'([^']*)'/)?.[1] || 'text');
        });
    });
    
    // Create story modal
    const createStoryBtns = document.querySelectorAll('[onclick*="showCreateStory"]');
    createStoryBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            showCreateStory();
        });
    });
    
    // Follow/Unfollow buttons
    document.addEventListener('click', function(e) {
        if (e.target.matches('[onclick*="followUser"]')) {
            e.preventDefault();
            const userId = e.target.getAttribute('onclick').match(/\d+/)[0];
            followUser(userId, e.target);
        }
    });
    
    // Like buttons
    document.addEventListener('click', function(e) {
        if (e.target.matches('[onclick*="toggleLike"]') || e.target.closest('[onclick*="toggleLike"]')) {
            e.preventDefault();
            const btn = e.target.closest('[onclick*="toggleLike"]');
            const postId = btn.getAttribute('onclick').match(/\d+/)[0];
            toggleLike(postId, btn);
        }
    });
    
    // Comment toggles
    document.addEventListener('click', function(e) {
        if (e.target.matches('[onclick*="toggleComments"]')) {
            e.preventDefault();
            const postId = e.target.getAttribute('onclick').match(/\d+/)[0];
            toggleComments(postId);
        }
    });
    
    // Story views
    document.addEventListener('click', function(e) {
        if (e.target.matches('[onclick*="viewStory"]') || e.target.closest('[onclick*="viewStory"]')) {
            e.preventDefault();
            const element = e.target.matches('[onclick*="viewStory"]') ? e.target : e.target.closest('[onclick*="viewStory"]');
            const storyId = element.getAttribute('onclick').match(/\d+/)[0];
            viewStory(storyId);
        }
    });
}

function initializeSocket() {
    socket = io();
    
    socket.on('connect', function() {
        console.log('Connected to server');
    });
    
    socket.on('receive_message', function(data) {
        displayMessage(data);
        updateMessageNotification();
    });
    
    socket.on('notification', function(data) {
        addNotification(data);
        updateNotificationBadge();
    });
}

// Post Functions
function showCreatePost(type = 'text') {
    const modal = new bootstrap.Modal(document.getElementById('createPostModal'));
    setPostType(type);
    modal.show();
}

function setPostType(type) {
    document.getElementById('postType').value = type;
    
    // Hide all upload sections
    document.getElementById('imageUpload').style.display = 'none';
    document.getElementById('videoUpload').style.display = 'none';
    document.getElementById('pollOptions').style.display = 'none';
    document.getElementById('locationInput').style.display = 'none';
    
    // Show relevant section
    switch(type) {
        case 'image':
            document.getElementById('imageUpload').style.display = 'block';
            break;
        case 'video':
            document.getElementById('videoUpload').style.display = 'block';
            break;
        case 'poll':
            document.getElementById('pollOptions').style.display = 'block';
            break;
        case 'location':
            document.getElementById('locationInput').style.display = 'block';
            break;
    }
    
    // Update button states
    document.querySelectorAll('.post-type-selector .btn').forEach(btn => {
        btn.classList.remove('btn-primary');
        btn.classList.add('btn-outline-secondary');
    });
    
    const activeBtn = document.querySelector(`[onclick*="setPostType('${type}')"]`);
    if (activeBtn) {
        activeBtn.classList.remove('btn-outline-secondary');
        activeBtn.classList.add('btn-primary');
    }
}

function addPollOption() {
    const pollInputs = document.getElementById('pollInputs');
    const newInput = document.createElement('input');
    newInput.type = 'text';
    newInput.className = 'form-control mb-2';
    newInput.name = 'poll_options[]';
    newInput.placeholder = `الخيار ${pollInputs.children.length + 1}`;
    pollInputs.appendChild(newInput);
}

function toggleLike(postId, button) {
    fetch(`/like_post/${postId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            const icon = button.querySelector('i');
            const text = button.querySelector('span') || button.childNodes[button.childNodes.length - 1];
            
            if (data.action === 'liked') {
                button.classList.add('liked');
                icon.classList.remove('far');
                icon.classList.add('fas');
            } else {
                button.classList.remove('liked');
                icon.classList.remove('fas');
                icon.classList.add('far');
            }
            
            // Update like count
            const likeCount = button.closest('.post').querySelector('.like-count');
            if (likeCount) {
                likeCount.textContent = `${data.like_count} إعجاب`;
            }
            
            // Add animation
            button.style.transform = 'scale(0.8)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 150);
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('حدث خطأ أثناء تسجيل الإعجاب', 'error');
    });
}

function toggleComments(postId) {
    const commentsSection = document.getElementById(`comments-${postId}`);
    if (commentsSection) {
        if (commentsSection.style.display === 'none' || !commentsSection.style.display) {
            commentsSection.style.display = 'block';
            commentsSection.classList.add('fade-in');
        } else {
            commentsSection.style.display = 'none';
        }
    }
}

function addComment(event, postId) {
    event.preventDefault();
    
    const form = event.target;
    const formData = new FormData(form);
    formData.append('post_id', postId);
    
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalHTML = submitBtn.innerHTML;
    submitBtn.innerHTML = '<div class="loading-spinner"></div>';
    submitBtn.disabled = true;
    
    fetch('/add_comment', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Add new comment to the list
            const commentsList = document.querySelector(`#comments-${postId} .comments-list`);
            const newComment = createCommentElement(data.comment);
            commentsList.insertBefore(newComment, commentsList.firstChild);
            
            // Clear form
            form.reset();
            
            // Update comment count
            const commentCount = document.querySelector(`.post .comment-count`);
            if (commentCount) {
                const currentCount = parseInt(commentCount.textContent.match(/\d+/)[0]);
                commentCount.textContent = `${currentCount + 1} تعليق`;
            }
            
            showToast('تم إضافة التعليق بنجاح', 'success');
        } else {
            showToast(data.error || 'حدث خطأ أثناء إضافة التعليق', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('حدث خطأ أثناء إضافة التعليق', 'error');
    })
    .finally(() => {
        submitBtn.innerHTML = originalHTML;
        submitBtn.disabled = false;
    });
}

function createCommentElement(comment) {
    const commentDiv = document.createElement('div');
    commentDiv.className = 'comment fade-in';
    
    commentDiv.innerHTML = `
        <div class="comment-avatar">
            <img src="/uploads/avatars/${comment.author_avatar || 'default-avatar.png'}" alt="صورة المعلق">
        </div>
        <div class="comment-content">
            <div class="comment-header">
                <strong>${comment.author}</strong>
                <span class="comment-time">${comment.created_at}</span>
            </div>
            <p>${comment.content}</p>
        </div>
    `;
    
    return commentDiv;
}

// Story Functions
function showCreateStory() {
    const modal = new bootstrap.Modal(document.getElementById('createStoryModal'));
    modal.show();
}

function setupStoryPreview() {
    const storyMedia = document.getElementById('storyMedia');
    if (storyMedia) {
        storyMedia.addEventListener('change', function(e) {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                const preview = document.getElementById('storyPreview');
                const previewImage = document.getElementById('previewImage');
                const previewVideo = document.getElementById('previewVideo');
                
                reader.onload = function(e) {
                    preview.style.display = 'block';
                    
                    if (file.type.startsWith('image/')) {
                        previewImage.src = e.target.result;
                        previewImage.style.display = 'block';
                        previewVideo.style.display = 'none';
                    } else if (file.type.startsWith('video/')) {
                        previewVideo.src = e.target.result;
                        previewVideo.style.display = 'block';
                        previewImage.style.display = 'none';
                    }
                };
                
                reader.readAsDataURL(file);
            }
        });
    }
}

function viewStory(storyId) {
    window.location.href = `/story/${storyId}`;
}

// User Functions
function followUser(userId, button) {
    const originalText = button.textContent;
    button.textContent = 'جارٍ المتابعة...';
    button.disabled = true;
    
    fetch(`/follow/${userId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            if (data.action === 'follow') {
                button.textContent = 'إلغاء المتابعة';
                button.classList.remove('btn-primary');
                button.classList.add('btn-outline-primary');
                showToast('تم بدء المتابعة', 'success');
            } else {
                button.textContent = 'متابعة';
                button.classList.remove('btn-outline-primary');
                button.classList.add('btn-primary');
                showToast('تم إلغاء المتابعة', 'info');
            }
        } else {
            showToast(data.error || 'حدث خطأ', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('حدث خطأ أثناء المتابعة', 'error');
    })
    .finally(() => {
        button.disabled = false;
        if (button.textContent.includes('جارٍ')) {
            button.textContent = originalText;
        }
    });
}

function dismissSuggestions() {
    const suggestions = document.querySelector('.friend-suggestions').parentElement;
    suggestions.style.display = 'none';
    showToast('تم إخفاء اقتراحات الأصدقاء', 'info');
}

// Search Functions
function setupSearch() {
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        let searchTimeout;
        
        searchInput.addEventListener('input', function(e) {
            clearTimeout(searchTimeout);
            const query = e.target.value.trim();
            
            if (query.length > 2) {
                searchTimeout = setTimeout(() => {
                    performSearch(query);
                }, 300);
            } else {
                hideSearchResults();
            }
        });
        
        // Hide search results when clicking outside
        document.addEventListener('click', function(e) {
            if (!e.target.closest('.search-bar')) {
                hideSearchResults();
            }
        });
    }
}

function performSearch(query) {
    fetch(`/search?q=${encodeURIComponent(query)}`)
        .then(response => response.json())
        .then(data => {
            displaySearchResults(data);
        })
        .catch(error => {
            console.error('Search error:', error);
        });
}

function displaySearchResults(results) {
    let searchResultsDiv = document.getElementById('searchResults');
    
    if (!searchResultsDiv) {
        searchResultsDiv = document.createElement('div');
        searchResultsDiv.id = 'searchResults';
        searchResultsDiv.className = 'search-results';
        document.querySelector('.search-bar').appendChild(searchResultsDiv);
    }
    
    let searchResultsHtml = '';
    
    if (results.users && results.users.length > 0) {
        searchResultsHtml = results.users.map(user => `
            <div class="search-result-item" onclick="location.href='/profile/${user.username}'">
                <div class="search-result-avatar">
                    <img src="/uploads/avatars/${user.avatar || 'default-avatar.png'}" alt="${user.full_name}">
                </div>
                <div class="search-result-info">
                    <strong>${user.full_name}</strong>
                    <small>@${user.username}</small>
                    ${user.bio ? `<p class="search-bio">${user.bio.substring(0, 50)}...</p>` : ''}
                </div>
            </div>
        `).join('');
        
        // Add advanced search link
        searchResultsHtml += `
            <div class="search-advanced-link">
                <a href="/search/advanced?q=${encodeURIComponent(document.getElementById('searchInput').value)}" class="text-decoration-none">
                    <i class="fas fa-search-plus"></i> البحث المتقدم
                </a>
            </div>
        `;
        
        searchResultsDiv.innerHTML = searchResultsHtml;
        searchResultsDiv.style.display = 'block';
    } else {
        searchResultsDiv.innerHTML = `
            <div class="search-no-results">لا توجد نتائج</div>
            <div class="search-advanced-link">
                <a href="/search/advanced?q=${encodeURIComponent(document.getElementById('searchInput').value)}" class="text-decoration-none">
                    <i class="fas fa-search-plus"></i> جرب البحث المتقدم
                </a>
            </div>
        `;
        searchResultsDiv.style.display = 'block';
    }
}

function hideSearchResults() {
    const searchResults = document.getElementById('searchResults');
    if (searchResults) {
        searchResults.style.display = 'none';
    }
}

// Notification Functions
function loadNotifications() {
    fetch('/api/notifications')
        .then(response => response.json())
        .then(data => {
            notifications = data.notifications || [];
            updateNotificationBadge();
        })
        .catch(error => {
            console.error('Error loading notifications:', error);
        });
}

function toggleNotifications() {
    const dropdown = document.getElementById('notificationsDropdown');
    if (dropdown.style.display === 'none' || !dropdown.style.display) {
        displayNotifications();
        dropdown.style.display = 'block';
    } else {
        dropdown.style.display = 'none';
    }
}

function displayNotifications() {
    const notificationsList = document.getElementById('notificationsList');
    
    if (notifications.length === 0) {
        notificationsList.innerHTML = '<div class="notification-empty">لا توجد إشعارات جديدة</div>';
        return;
    }
    
    notificationsList.innerHTML = notifications.map(notification => `
        <div class="notification-item ${notification.is_read ? '' : 'unread'}" onclick="markAsRead(${notification.id})">
            <div class="notification-avatar">
                <img src="/uploads/avatars/${notification.from_user_avatar || 'default-avatar.png'}" alt="صورة المرسل">
            </div>
            <div class="notification-content">
                <strong>${notification.title}</strong>
                <p>${notification.message}</p>
            </div>
            <div class="notification-time">
                ${timeAgo(notification.created_at)}
            </div>
        </div>
    `).join('');
}

function updateNotificationBadge() {
    const badge = document.getElementById('notificationCount');
    const unreadCount = notifications.filter(n => !n.is_read).length;
    
    if (unreadCount > 0) {
        badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }
}

function markAsRead(notificationId) {
    fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            const notification = notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.is_read = true;
                updateNotificationBadge();
                displayNotifications();
            }
        }
    })
    .catch(error => {
        console.error('Error marking notification as read:', error);
    });
}

function markAllAsRead() {
    fetch('/api/notifications/mark_all_read', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            notifications.forEach(n => n.is_read = true);
            updateNotificationBadge();
            displayNotifications();
            showToast('تم تحديد جميع الإشعارات كمقروءة', 'success');
        }
    })
    .catch(error => {
        console.error('Error marking all notifications as read:', error);
    });
}

function addNotification(notification) {
    notifications.unshift(notification);
    updateNotificationBadge();
    
    // Show toast for new notification
    showToast(notification.title, 'info');
}

// Utility Functions
function showToast(message, type = 'info') {
    const toastContainer = getOrCreateToastContainer();
    
    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white bg-${type === 'error' ? 'danger' : type === 'success' ? 'success' : 'primary'} border-0 fade-in`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
        <div class="d-flex">
            <div class="toast-body">
                ${message}
            </div>
            <button type="button" class="btn-close btn-close-white me-2 m-auto" onclick="this.parentElement.parentElement.remove()"></button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.remove();
        }
    }, 5000);
}

function getOrCreateToastContainer() {
    let container = document.getElementById('toastContainer');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'toast-container position-fixed top-0 end-0 p-3';
        container.style.zIndex = '9999';
        document.body.appendChild(container);
    }
    return container;
}

function timeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) return 'منذ يوم واحد';
    if (diffDays < 7) return `منذ ${diffDays} أيام`;
    if (diffDays < 30) return `منذ ${Math.ceil(diffDays/7)} أسبوع`;
    return `منذ ${Math.ceil(diffDays/30)} شهر`;
}

function formatTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Message notification update
function updateMessageNotification() {
    const badge = document.getElementById('messageCount');
    // This would typically fetch unread message count from server
    // For now, just show a simple notification
    badge.style.display = 'flex';
    badge.textContent = '1';
}

// Poll voting function
function voteOnPoll(optionId) {
    fetch(`/vote_poll/${optionId}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        }
    })
    .then(response => response.json())
    .then(data => {
        if (data.status === 'success') {
            // Update poll results
            location.reload(); // Simple approach - reload to show updated results
        } else {
            showToast(data.error || 'حدث خطأ أثناء التصويت', 'error');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showToast('حدث خطأ أثناء التصويت', 'error');
    });
}

// Delete post function
function deletePost(postId) {
    if (confirm('هل أنت متأكد من حذف هذا المنشور؟')) {
        fetch(`/delete_post/${postId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            }
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                document.querySelector(`[data-post-id="${postId}"]`).remove();
                showToast('تم حذف المنشور بنجاح', 'success');
            } else {
                showToast(data.error || 'حدث خطأ أثناء حذف المنشور', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('حدث خطأ أثناء حذف المنشور', 'error');
        });
    }
}

// Report post function
function reportPost(postId) {
    const reason = prompt('يرجى ذكر سبب الإبلاغ:');
    if (reason && reason.trim()) {
        fetch(`/report_post/${postId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({reason: reason.trim()})
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                showToast('تم إرسال البلاغ بنجاح', 'success');
            } else {
                showToast(data.error || 'حدث خطأ أثناء إرسال البلاغ', 'error');
            }
        })
        .catch(error => {
            console.error('Error:', error);
            showToast('حدث خطأ أثناء إرسال البلاغ', 'error');
        });
    }
}
