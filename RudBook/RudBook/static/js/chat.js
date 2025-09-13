// Real-time Chat functionality with Socket.IO
class ChatManager {
    constructor() {
        this.socket = null;
        this.currentRoom = null;
        this.currentUserId = null;
        this.currentUsername = null;
        this.messageContainer = null;
        this.messageInput = null;
        this.isTyping = false;
        this.typingTimeout = null;
        this.messageQueue = [];
        this.isConnected = false;
        
        this.initializeSocket();
    }
    
    initializeSocket() {
        if (typeof io === 'undefined') {
            console.error('Socket.IO not loaded');
            return;
        }
        
        this.socket = io();
        this.setupSocketListeners();
    }
    
    setupSocketListeners() {
        this.socket.on('connect', () => {
            console.log('Connected to chat server');
            this.isConnected = true;
            this.processMessageQueue();
        });
        
        this.socket.on('disconnect', () => {
            console.log('Disconnected from chat server');
            this.isConnected = false;
            this.showConnectionStatus('منقطع', 'error');
        });
        
        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.showConnectionStatus('خطأ في الاتصال', 'error');
        });
        
        this.socket.on('receive_message', (data) => {
            this.displayIncomingMessage(data);
        });
        
        this.socket.on('user_typing', (data) => {
            this.showTypingIndicator(data);
        });
        
        this.socket.on('user_stop_typing', (data) => {
            this.hideTypingIndicator(data);
        });
        
        this.socket.on('message_delivered', (data) => {
            this.markMessageAsDelivered(data.messageId);
        });
        
        this.socket.on('message_read', (data) => {
            this.markMessageAsRead(data.messageId);
        });
        
        this.socket.on('user_online', (data) => {
            this.updateUserStatus(data.userId, 'online');
        });
        
        this.socket.on('user_offline', (data) => {
            this.updateUserStatus(data.userId, 'offline');
        });
        
        this.socket.on('status', (data) => {
            console.log('Status:', data.msg);
        });
    }
    
    initializeChat(userId, username) {
        this.currentUserId = userId;
        this.currentUsername = username;
        this.currentRoom = `chat_${Math.min(this.getCurrentUserId(), userId)}_${Math.max(this.getCurrentUserId(), userId)}`;
        
        this.messageContainer = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        
        if (this.messageInput) {
            this.setupMessageInput();
        }
        
        // Join chat room
        this.joinRoom();
        
        // Mark messages as read
        this.markChatAsRead();
    }
    
    getCurrentUserId() {
        // Get current user ID from page context or user profile
        const userProfile = document.querySelector('.user-profile');
        if (userProfile) {
            // Extract user ID from profile link or data attribute
            return parseInt(document.body.dataset.currentUserId) || 1;
        }
        return 1; // Fallback
    }
    
    setupMessageInput() {
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.messageInput.addEventListener('input', () => {
            this.handleTyping();
        });
        
        this.messageInput.addEventListener('blur', () => {
            this.stopTyping();
        });
    }
    
    joinRoom() {
        if (this.socket && this.currentRoom) {
            this.socket.emit('join', {
                room: this.currentRoom,
                username: this.currentUsername
            });
        }
    }
    
    leaveRoom() {
        if (this.socket && this.currentRoom) {
            this.socket.emit('leave', {
                room: this.currentRoom,
                username: this.currentUsername
            });
        }
    }
    
    sendMessage() {
        const content = this.messageInput.value.trim();
        if (!content) return;
        
        const messageData = {
            message: content,
            recipient_id: this.currentUserId,
            room: this.currentRoom,
            timestamp: new Date().toISOString()
        };
        
        if (this.isConnected) {
            this.socket.emit('send_message', messageData);
        } else {
            this.messageQueue.push(messageData);
            this.showConnectionStatus('في انتظار الاتصال...', 'warning');
        }
        
        // Display message immediately (optimistic UI)
        this.displayOutgoingMessage(content);
        
        // Clear input
        this.messageInput.value = '';
        this.stopTyping();
    }
    
    displayIncomingMessage(data) {
        const messageElement = this.createMessageElement({
            content: data.message,
            senderName: data.sender_name,
            senderAvatar: data.sender_avatar,
            timestamp: data.timestamp,
            type: 'received'
        });
        
        this.appendMessage(messageElement);
        this.playNotificationSound();
        
        // Update unread count
        this.updateUnreadCount();
    }
    
    displayOutgoingMessage(content) {
        const messageElement = this.createMessageElement({
            content: content,
            senderName: 'أنت',
            senderAvatar: this.getCurrentUserAvatar(),
            timestamp: new Date().toLocaleTimeString('ar-SA', {
                hour: '2-digit',
                minute: '2-digit'
            }),
            type: 'sent'
        });
        
        this.appendMessage(messageElement);
    }
    
    createMessageElement(data) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${data.type}`;
        
        const avatarHTML = data.type === 'received' ? `
            <div class="message-avatar">
                <img src="/uploads/avatars/${data.senderAvatar || 'default-avatar.png'}" alt="صورة المرسل">
            </div>
        ` : '';
        
        messageDiv.innerHTML = `
            ${avatarHTML}
            <div class="message-content">
                <div class="message-text">${this.escapeHtml(data.content)}</div>
                <div class="message-time">
                    ${data.timestamp}
                    ${data.type === 'sent' ? '<i class="fas fa-check-double delivered"></i>' : ''}
                </div>
            </div>
        `;
        
        return messageDiv;
    }
    
    appendMessage(messageElement) {
        if (this.messageContainer) {
            this.messageContainer.appendChild(messageElement);
            
            // Add animation
            messageElement.classList.add('fade-in');
            
            // Scroll to bottom
            this.scrollToBottom();
        }
    }
    
    scrollToBottom() {
        if (this.messageContainer) {
            this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
        }
    }
    
    handleTyping() {
        if (!this.isTyping) {
            this.isTyping = true;
            this.socket.emit('user_typing', {
                room: this.currentRoom,
                username: this.currentUsername
            });
        }
        
        // Clear existing timeout
        clearTimeout(this.typingTimeout);
        
        // Set new timeout
        this.typingTimeout = setTimeout(() => {
            this.stopTyping();
        }, 3000);
    }
    
    stopTyping() {
        if (this.isTyping) {
            this.isTyping = false;
            clearTimeout(this.typingTimeout);
            
            this.socket.emit('user_stop_typing', {
                room: this.currentRoom,
                username: this.currentUsername
            });
        }
    }
    
    showTypingIndicator(data) {
        if (data.username === this.currentUsername) return;
        
        let typingIndicator = document.getElementById('typingIndicator');
        if (!typingIndicator) {
            typingIndicator = document.createElement('div');
            typingIndicator.id = 'typingIndicator';
            typingIndicator.className = 'typing-indicator';
            typingIndicator.innerHTML = `
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
                <span class="typing-text">${data.username} يكتب...</span>
            `;
            
            this.messageContainer.appendChild(typingIndicator);
        }
        
        this.scrollToBottom();
    }
    
    hideTypingIndicator(data) {
        const typingIndicator = document.getElementById('typingIndicator');
        if (typingIndicator) {
            typingIndicator.remove();
        }
    }
    
    markMessageAsDelivered(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const checkmark = messageElement.querySelector('.fa-check-double');
            if (checkmark) {
                checkmark.classList.remove('sent');
                checkmark.classList.add('delivered');
            }
        }
    }
    
    markMessageAsRead(messageId) {
        const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
        if (messageElement) {
            const checkmark = messageElement.querySelector('.fa-check-double');
            if (checkmark) {
                checkmark.classList.remove('delivered');
                checkmark.classList.add('read');
            }
        }
    }
    
    markChatAsRead() {
        // Send read receipt for all messages in this chat
        fetch(`/api/chat/${this.currentUserId}/mark_read`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            }
        }).catch(error => {
            console.error('Error marking chat as read:', error);
        });
    }
    
    updateUserStatus(userId, status) {
        if (userId === this.currentUserId) {
            const statusElement = document.querySelector('.user-status');
            if (statusElement) {
                statusElement.textContent = status === 'online' ? 'متصل الآن' : 'غير متصل';
                statusElement.className = `user-status ${status}`;
            }
            
            const onlineIndicator = document.querySelector('.online-indicator');
            if (onlineIndicator) {
                onlineIndicator.style.display = status === 'online' ? 'block' : 'none';
            }
        }
    }
    
    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.socket.emit('send_message', message);
        }
    }
    
    showConnectionStatus(message, type) {
        // Create or update connection status indicator
        let statusElement = document.getElementById('connectionStatus');
        if (!statusElement) {
            statusElement = document.createElement('div');
            statusElement.id = 'connectionStatus';
            statusElement.className = 'connection-status';
            document.body.appendChild(statusElement);
        }
        
        statusElement.textContent = message;
        statusElement.className = `connection-status ${type}`;
        statusElement.style.display = 'block';
        
        // Hide after 3 seconds for non-error messages
        if (type !== 'error') {
            setTimeout(() => {
                statusElement.style.display = 'none';
            }, 3000);
        }
    }
    
    playNotificationSound() {
        // Create and play notification sound
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeCMFl4HT8Nd/Nwg=');
            audio.volume = 0.3;
            audio.play().catch(e => {
                // Ignore audio play errors (browser policy)
            });
        } catch (error) {
            // Ignore audio errors
        }
    }
    
    updateUnreadCount() {
        // Update unread message count in navigation
        const messagesBadge = document.getElementById('messageCount');
        if (messagesBadge) {
            let count = parseInt(messagesBadge.textContent) || 0;
            count++;
            messagesBadge.textContent = count;
            messagesBadge.style.display = 'flex';
        }
    }
    
    getCurrentUserAvatar() {
        const userAvatar = document.querySelector('.user-profile .user-avatar img');
        return userAvatar ? userAvatar.src.split('/').pop() : 'default-avatar.png';
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // File upload methods
    sendImage(file) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('recipient_id', this.currentUserId);
        
        fetch('/api/chat/send_image', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Image will be sent via socket automatically
            } else {
                this.showError('فشل في إرسال الصورة');
            }
        })
        .catch(error => {
            console.error('Error sending image:', error);
            this.showError('حدث خطأ أثناء إرسال الصورة');
        });
    }
    
    sendLocation(latitude, longitude) {
        const locationMessage = `📍 الموقع: https://maps.google.com/maps?q=${latitude},${longitude}`;
        
        const messageData = {
            message: locationMessage,
            recipient_id: this.currentUserId,
            room: this.currentRoom,
            type: 'location'
        };
        
        this.socket.emit('send_message', messageData);
        this.displayOutgoingMessage(locationMessage);
    }
    
    showError(message) {
        if (typeof showToast === 'function') {
            showToast(message, 'error');
        } else {
            alert(message);
        }
    }
    
    destroy() {
        this.leaveRoom();
        
        if (this.socket) {
            this.socket.disconnect();
        }
        
        if (this.typingTimeout) {
            clearTimeout(this.typingTimeout);
        }
    }
}

// Voice recording functionality
class VoiceRecorder {
    constructor(chatManager) {
        this.chatManager = chatManager;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.isRecording = false;
        this.stream = null;
    }
    
    async startRecording() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                this.audioChunks.push(event.data);
            };
            
            this.mediaRecorder.onstop = () => {
                const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
                this.sendVoiceMessage(audioBlob);
            };
            
            this.mediaRecorder.start();
            this.isRecording = true;
            
            this.showRecordingModal();
            
            return true;
        } catch (error) {
            console.error('Error starting voice recording:', error);
            this.chatManager.showError('لا يمكن الوصول إلى الميكروفون');
            return false;
        }
    }
    
    stopRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            
            this.hideRecordingModal();
        }
    }
    
    cancelRecording() {
        if (this.mediaRecorder && this.isRecording) {
            this.mediaRecorder.stop();
            this.isRecording = false;
            this.audioChunks = [];
            
            if (this.stream) {
                this.stream.getTracks().forEach(track => track.stop());
            }
            
            this.hideRecordingModal();
        }
    }
    
    sendVoiceMessage(audioBlob) {
        const formData = new FormData();
        formData.append('voice', audioBlob, 'voice_message.wav');
        formData.append('recipient_id', this.chatManager.currentUserId);
        
        fetch('/api/chat/send_voice', {
            method: 'POST',
            body: formData
        })
        .then(response => response.json())
        .then(data => {
            if (data.status === 'success') {
                // Voice message will be sent via socket automatically
            } else {
                this.chatManager.showError('فشل في إرسال الرسالة الصوتية');
            }
        })
        .catch(error => {
            console.error('Error sending voice message:', error);
            this.chatManager.showError('حدث خطأ أثناء إرسال الرسالة الصوتية');
        });
    }
    
    showRecordingModal() {
        const modal = document.getElementById('voiceRecordingModal');
        if (modal) {
            const modalInstance = new bootstrap.Modal(modal);
            modalInstance.show();
            
            this.startRecordingTimer();
        }
    }
    
    hideRecordingModal() {
        const modal = document.getElementById('voiceRecordingModal');
        if (modal) {
            const modalInstance = bootstrap.Modal.getInstance(modal);
            if (modalInstance) {
                modalInstance.hide();
            }
        }
        
        this.stopRecordingTimer();
    }
    
    startRecordingTimer() {
        const timerElement = document.querySelector('.recording-timer');
        if (!timerElement) return;
        
        let seconds = 0;
        this.recordingTimer = setInterval(() => {
            seconds++;
            const minutes = Math.floor(seconds / 60);
            const remainingSeconds = seconds % 60;
            
            timerElement.textContent = 
                `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
            
            // Auto-stop after 5 minutes
            if (seconds >= 300) {
                this.stopRecording();
            }
        }, 1000);
    }
    
    stopRecordingTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
    }
}

// Global chat manager instance
let chatManager;
let voiceRecorder;

// Initialize chat when DOM is loaded
function initializeChat(userId, username) {
    if (!chatManager) {
        chatManager = new ChatManager();
    }
    
    chatManager.initializeChat(userId, username);
    
    if (!voiceRecorder) {
        voiceRecorder = new VoiceRecorder(chatManager);
    }
}

// Global functions for UI interaction
function sendMessage() {
    if (chatManager) {
        chatManager.sendMessage();
    }
}

function toggleAttachments() {
    const menu = document.getElementById('attachmentsMenu');
    if (menu) {
        menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    }
}

function openImagePicker() {
    document.getElementById('imageInput').click();
    toggleAttachments();
}

function openCameraPicker() {
    document.getElementById('cameraInput').click();
    toggleAttachments();
}

function handleImageUpload(input) {
    const file = input.files[0];
    if (file && chatManager) {
        chatManager.sendImage(file);
    }
    input.value = ''; // Reset input
}

function openLocationPicker() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (chatManager) {
                    chatManager.sendLocation(
                        position.coords.latitude,
                        position.coords.longitude
                    );
                }
            },
            (error) => {
                console.error('Error getting location:', error);
                if (chatManager) {
                    chatManager.showError('لا يمكن الحصول على الموقع');
                }
            }
        );
    } else {
        if (chatManager) {
            chatManager.showError('المتصفح لا يدعم تحديد الموقع');
        }
    }
    
    toggleAttachments();
}

function openEmojiPicker() {
    const picker = document.getElementById('emojiPicker');
    if (picker) {
        picker.style.display = picker.style.display === 'none' ? 'block' : 'none';
    }
}

function insertEmoji(emoji) {
    const input = document.getElementById('messageInput');
    if (input) {
        input.value += emoji;
        input.focus();
    }
    
    // Hide emoji picker
    const picker = document.getElementById('emojiPicker');
    if (picker) {
        picker.style.display = 'none';
    }
}

function startVoiceRecording() {
    if (voiceRecorder) {
        voiceRecorder.startRecording();
    }
}

function stopRecording() {
    if (voiceRecorder) {
        voiceRecorder.stopRecording();
    }
}

function cancelRecording() {
    if (voiceRecorder) {
        voiceRecorder.cancelRecording();
    }
}

function startVoiceCall() {
    // Placeholder for voice call functionality
    if (typeof showToast === 'function') {
        showToast('المكالمات الصوتية غير متوفرة حالياً', 'info');
    }
}

function startVideoCall() {
    // Placeholder for video call functionality
    if (typeof showToast === 'function') {
        showToast('مكالمات الفيديو غير متوفرة حالياً', 'info');
    }
}

function showChatInfo() {
    // Placeholder for chat info functionality
    if (typeof showToast === 'function') {
        showToast('معلومات المحادثة غير متوفرة حالياً', 'info');
    }
}

// Cleanup when page unloads
window.addEventListener('beforeunload', () => {
    if (chatManager) {
        chatManager.destroy();
    }
});

// Export for use in other files
window.ChatManager = ChatManager;
window.VoiceRecorder = VoiceRecorder;
