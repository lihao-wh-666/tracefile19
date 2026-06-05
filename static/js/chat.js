class ChatClient {
    constructor() {
        this.socket = null;
        this.connected = false;
        this.currentRoomId = null;
        this.typingTimeout = null;
        this.typingUsers = new Map();
        this.notificationSettings = null;
        this.unreadCount = 0;
        this.onMessageCallback = null;
        this.onNotificationCallback = null;
        this.onUnreadChangeCallback = null;
    }

    connect() {
        if (!auth.isLoggedIn()) return;

        const token = localStorage.getItem('token');
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host;
        
        this.socket = io({
            path: '/socket.io/',
            auth: {
                token: token
            },
            transports: ['polling', 'websocket'],
            transportOptions: {
                polling: {
                    extraHeaders: {
                        'Authorization': `Bearer ${token}`
                    }
                },
                websocket: {
                    extraHeaders: {
                        'Authorization': `Bearer ${token}`
                    }
                }
            },
            reconnection: true,
            reconnectionAttempts: Infinity,
            reconnectionDelay: 1000,
            reconnectionDelayMax: 5000,
            timeout: 20000
        });

        this.socket.on('connect', () => {
            this.connected = true;
            console.log('Connected to chat server');
        });

        this.socket.on('disconnect', () => {
            this.connected = false;
            console.log('Disconnected from chat server');
        });

        this.socket.on('new_message', (message) => {
            if (this.onMessageCallback) {
                this.onMessageCallback(message);
            }
            if (message.room_id !== this.currentRoomId) {
                this.updateUnreadCount();
            }
        });

        this.socket.on('notification', (data) => {
            if (this.onNotificationCallback) {
                this.onNotificationCallback(data);
            }
            this.showBrowserNotification(data);
        });

        this.socket.on('user_typing', (data) => {
            if (data.room_id === this.currentRoomId) {
                this.typingUsers.set(data.user_id, {
                    username: data.username,
                    is_typing: data.is_typing,
                    timeout: setTimeout(() => {
                        this.typingUsers.delete(data.user_id);
                        this.updateTypingIndicator();
                    }, 3000)
                });
                this.updateTypingIndicator();
            }
        });

        this.socket.on('user_connected', (data) => {
            console.log('User connected:', data);
        });

        this.socket.on('user_disconnected', (data) => {
            console.log('User disconnected:', data);
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }
        this.connected = false;
        this.currentRoomId = null;
        this.typingUsers.clear();
        this.notificationSettings = null;
        this.unreadCount = 0;
        this.onMessageCallback = null;
        this.onNotificationCallback = null;
        this.onUnreadChangeCallback = null;
    }

    joinRoom(roomId) {
        if (this.connected && roomId) {
            this.currentRoomId = roomId;
            this.socket.emit('join_room', { room_id: roomId });
        }
    }

    leaveRoom(roomId) {
        if (this.connected && roomId) {
            this.socket.emit('leave_room', { room_id: roomId });
            if (this.currentRoomId === roomId) {
                this.currentRoomId = null;
            }
        }
    }

    sendMessage(roomId, content, messageType = 'text') {
        if (this.connected && roomId && content) {
            this.socket.emit('send_message', {
                room_id: roomId,
                content: content,
                message_type: messageType
            });
        }
    }

    sendTyping(roomId, isTyping) {
        if (this.connected && roomId) {
            clearTimeout(this.typingTimeout);
            
            if (isTyping) {
                this.socket.emit('typing', {
                    room_id: roomId,
                    is_typing: true
                });
                
                this.typingTimeout = setTimeout(() => {
                    this.socket.emit('typing', {
                        room_id: roomId,
                        is_typing: false
                    });
                }, 2000);
            }
        }
    }

    markAsRead(roomId) {
        if (this.connected && roomId) {
            this.socket.emit('mark_read', { room_id: roomId });
        }
    }

    updateTypingIndicator() {
        const typingEl = document.getElementById('typing-indicator');
        if (!typingEl) return;

        const typingUsers = Array.from(this.typingUsers.values())
            .filter(u => u.is_typing)
            .map(u => u.username);

        if (typingUsers.length > 0) {
            const names = typingUsers.join(', ');
            typingEl.textContent = `${names} 正在输入...`;
            typingEl.style.display = 'block';
        } else {
            typingEl.textContent = '';
            typingEl.style.display = 'none';
        }
    }

    async getRooms() {
        try {
            const result = await api.get('/chat/rooms');
            return result.rooms;
        } catch (error) {
            console.error('Failed to get rooms:', error);
            return [];
        }
    }

    async getMessages(roomId, page = 1) {
        try {
            const result = await api.get(`/chat/rooms/${roomId}/messages?page=${page}`);
            return result;
        } catch (error) {
            console.error('Failed to get messages:', error);
            return { messages: [] };
        }
    }

    async createPrivateRoom(userId) {
        try {
            const result = await api.post(`/chat/rooms/private/${userId}`, {});
            return result.room;
        } catch (error) {
            console.error('Failed to create private room:', error);
            return null;
        }
    }

    async createGroupRoom(name, memberIds = []) {
        try {
            const result = await api.post('/chat/rooms/group', {
                name,
                member_ids: memberIds
            });
            return result.room;
        } catch (error) {
            console.error('Failed to create group room:', error);
            return null;
        }
    }

    async leaveRoom(roomId) {
        try {
            await api.post(`/chat/rooms/${roomId}/leave`, {});
            return true;
        } catch (error) {
            console.error('Failed to leave room:', error);
            throw error;
        }
    }

    async deleteRoom(roomId) {
        try {
            await api.delete(`/chat/rooms/${roomId}`);
            return true;
        } catch (error) {
            console.error('Failed to delete room:', error);
            throw error;
        }
    }

    async getNotificationSettings() {
        try {
            const result = await api.get('/chat/notifications');
            this.notificationSettings = result.settings;
            return result.settings;
        } catch (error) {
            console.error('Failed to get notification settings:', error);
            return null;
        }
    }

    async updateNotificationSettings(settings) {
        try {
            const result = await api.put('/chat/notifications', settings);
            this.notificationSettings = result.settings;
            return result.settings;
        } catch (error) {
            console.error('Failed to update notification settings:', error);
            return null;
        }
    }

    async updateUnreadCount() {
        try {
            const result = await api.get('/chat/unread');
            this.unreadCount = result.total_unread;
            if (this.onUnreadChangeCallback) {
                this.onUnreadChangeCallback(result.total_unread, result.rooms);
            }
            this.updateNavBadge();
            return result;
        } catch (error) {
            console.error('Failed to get unread count:', error);
            return { total_unread: 0, rooms: [] };
        }
    }

    updateNavBadge() {
        const badge = document.getElementById('chat-unread-badge');
        if (badge) {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'inline-flex';
            } else {
                badge.style.display = 'none';
            }
        }
    }

    showBrowserNotification(data) {
        if (!('Notification' in window)) return;
        
        if (Notification.permission === 'granted') {
            const notification = new Notification(data.room_name || '新消息', {
                body: `${data.from_user}: ${data.message}`,
                icon: '/static/favicon.ico'
            });
            
            notification.onclick = () => {
                window.focus();
                navigate(`chat/${data.room_id}`);
                notification.close();
            };
        }
    }

    requestNotificationPermission() {
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
    }

    setOnMessageCallback(callback) {
        this.onMessageCallback = callback;
    }

    setOnNotificationCallback(callback) {
        this.onNotificationCallback = callback;
    }

    setOnUnreadChangeCallback(callback) {
        this.onUnreadChangeCallback = callback;
    }
}

const chatClient = new ChatClient();
