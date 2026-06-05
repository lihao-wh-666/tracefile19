class App {
    constructor() {
        this.currentPage = 'home';
        this.currentParams = {};
        this.init();
    }

    async init() {
        if (auth.isLoggedIn()) {
            await auth.getCurrentUser();
            this.initChat();
        }
        this.updateNav();
        this.handleRoute();
    }

    initChat() {
        if (auth.isLoggedIn()) {
            if (chatClient.connected) {
                chatClient.disconnect();
            }
            chatClient.connect();
            chatClient.requestNotificationPermission();
            chatClient.updateUnreadCount();
            
            chatClient.setOnMessageCallback((message) => {
                if (this.currentPage === 'chat' && this.currentRoomId === message.room_id) {
                    this.appendMessage(message);
                }
                if (this.currentPage === 'project' && this.currentChannelId === message.room_id) {
                    this.appendProjectChatMessage(message);
                }
            });
            
            chatClient.setOnNotificationCallback((data) => {
                if (this.currentPage !== 'chat' || this.currentRoomId !== data.room_id) {
                    showToast(`新消息来自 ${data.from_user}`, 'info');
                }
            });
            
            if (!this._unreadInterval) {
                this._unreadInterval = setInterval(() => {
                    if (auth.isLoggedIn()) {
                        chatClient.updateUnreadCount();
                    }
                }, 30000);
            }
        }
    }

    updateNav() {
        const navAuth = document.getElementById('nav-auth');
        const navUser = document.getElementById('nav-user');
        const navCreate = document.getElementById('nav-create');
        const navAdmin = document.getElementById('nav-admin');
        const navProjects = document.getElementById('nav-projects');
        const navChat = document.getElementById('nav-chat');
        const userGreeting = document.getElementById('user-greeting');
        const avatarImg = document.getElementById('avatar-img');

        const mobileUserInfo = document.getElementById('mobile-user-info');
        const mobileAvatarImg = document.getElementById('mobile-avatar-img');
        const mobileUserName = document.getElementById('mobile-user-name');
        const mobileUserEmail = document.getElementById('mobile-user-email');
        const mobileNavProfile = document.getElementById('mobile-nav-profile');
        const mobileNavMyIdeas = document.getElementById('mobile-nav-my-ideas');
        const mobileNavLogout = document.getElementById('mobile-nav-logout');
        const mobileNavActions = document.getElementById('mobile-nav-actions');

        if (auth.isLoggedIn()) {
            navAuth.style.display = 'none';
            navUser.style.display = 'flex';
            navCreate.style.display = 'block';
            navProjects.style.display = 'block';
            navChat.style.display = 'block';
            userGreeting.textContent = `你好, ${auth.currentUser.username}`;
            avatarImg.src = auth.currentUser.avatar && auth.currentUser.avatar !== 'default.png'
                ? auth.currentUser.avatar
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(auth.currentUser.username)}&background=6366f1&color=fff`;

            if (mobileUserInfo) {
                mobileUserInfo.classList.add('visible');
                mobileAvatarImg.src = auth.currentUser.avatar && auth.currentUser.avatar !== 'default.png'
                    ? auth.currentUser.avatar
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(auth.currentUser.username)}&background=6366f1&color=fff`;
                mobileUserName.textContent = auth.currentUser.username;
                mobileUserEmail.textContent = auth.currentUser.email;
            }
            if (mobileNavProfile) mobileNavProfile.classList.add('visible');
            if (mobileNavMyIdeas) mobileNavMyIdeas.classList.add('visible');
            if (mobileNavLogout) mobileNavLogout.classList.add('visible');
            if (mobileNavActions) mobileNavActions.classList.add('hidden');

            if (auth.isAdmin()) {
                navAdmin.style.display = 'block';
            } else {
                navAdmin.style.display = 'none';
            }
        } else {
            navAuth.style.display = 'flex';
            navUser.style.display = 'none';
            navCreate.style.display = 'none';
            navProjects.style.display = 'none';
            navAdmin.style.display = 'none';
            navChat.style.display = 'none';

            if (mobileUserInfo) mobileUserInfo.classList.remove('visible');
            if (mobileNavProfile) mobileNavProfile.classList.remove('visible');
            if (mobileNavMyIdeas) mobileNavMyIdeas.classList.remove('visible');
            if (mobileNavLogout) mobileNavLogout.classList.remove('visible');
            if (mobileNavActions) mobileNavActions.classList.remove('hidden');
        }
    }

    toggleMobileMenu() {
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('nav-menu');
        const navOverlay = document.getElementById('nav-overlay');

        hamburger.classList.toggle('active');
        navMenu.classList.toggle('active');
        navOverlay.classList.toggle('active');

        document.body.style.overflow = navMenu.classList.contains('active') ? 'hidden' : '';
    }

    closeMobileMenu() {
        const hamburger = document.getElementById('hamburger');
        const navMenu = document.getElementById('nav-menu');
        const navOverlay = document.getElementById('nav-overlay');

        hamburger.classList.remove('active');
        navMenu.classList.remove('active');
        navOverlay.classList.remove('active');

        document.body.style.overflow = '';
    }

    handleRoute() {
        let path = window.location.pathname;
        if (path === '/' || path === '') {
            path = '/home';
        }
        if (path.startsWith('/')) {
            path = path.slice(1);
        }
        const [page, ...params] = path.split('/');
        this.currentPage = page || 'home';
        this.currentParams = { id: params[0] };
        this.render();
    }

    render() {
        const main = document.getElementById('main-content');
        
        document.querySelectorAll('.nav-menu a').forEach(a => {
            a.classList.remove('active');
            if (a.getAttribute('onclick')?.includes(this.currentPage)) {
                a.classList.add('active');
            }
        });

        switch (this.currentPage) {
            case 'home':
                this.renderHome(main);
                break;
            case 'login':
                this.renderLogin(main);
                break;
            case 'register':
                this.renderRegister(main);
                break;
            case 'ideas':
                this.renderIdeas(main);
                break;
            case 'idea':
                this.renderIdeaDetail(main, this.currentParams.id);
                break;
            case 'create-idea':
                this.renderCreateIdea(main);
                break;
            case 'edit-idea':
                this.renderEditIdea(main, this.currentParams.id);
                break;
            case 'my-ideas':
                this.renderMyIdeas(main);
                break;
            case 'profile':
                this.renderProfile(main);
                break;
            case 'user':
                this.renderUserProfile(main, this.currentParams.id);
                break;
            case 'users':
                this.renderUsers(main);
                break;
            case 'projects':
                this.renderProjects(main);
                break;
            case 'project':
                this.renderProjectDetail(main, this.currentParams.id);
                break;
            case 'chat':
                this.renderChat(main, this.currentParams.id);
                break;
            case 'admin':
                this.renderAdmin(main);
                break;
            default:
                this.renderHome(main);
        }
    }

    renderHome(container) {
        container.innerHTML = `
            <div class="hero">
                <h1>激发创意，连接开发者</h1>
                <p>GameDev Hub 是一个专为游戏开发者打造的协作平台。在这里，你可以分享灵感、寻找伙伴、共同创造令人惊叹的游戏体验。</p>
                <div class="hero-buttons">
                    ${auth.isLoggedIn() 
                        ? `<button class="btn btn-primary" onclick="navigate('create-idea')">✨ 分享你的灵感</button>`
                        : `<button class="btn btn-primary" onclick="navigate('register')">🚀 立即加入</button>`
                    }
                    <button class="btn btn-outline" onclick="navigate('ideas')">探索想法广场</button>
                </div>
            </div>
            <div class="features">
                <div class="feature-card">
                    <div class="feature-icon">💡</div>
                    <h3>灵感记录</h3>
                    <p>随时记录你的游戏创意，支持富文本编辑和标签分类，让灵感永不丢失。</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">👥</div>
                    <h3>开发者社区</h3>
                    <p>连接志同道合的游戏开发者，组建团队，共同实现梦想中的游戏项目。</p>
                </div>
                <div class="feature-card">
                    <div class="feature-icon">🎯</div>
                    <h3>协作开发</h3>
                    <p>通过评论、点赞功能，获得社区反馈，不断完善你的游戏设计。</p>
                </div>
            </div>
            <div id="latest-ideas">
                <div class="page-header">
                    <h2>最新灵感</h2>
                    <button class="btn btn-outline btn-sm" onclick="navigate('ideas')">查看全部 →</button>
                </div>
                <div id="ideas-grid" class="ideas-grid">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>
        `;
        this.loadLatestIdeas();
    }

    async loadLatestIdeas() {
        try {
            const result = await api.get('/ideas?per_page=6&sort_by=created_at');
            const grid = document.getElementById('ideas-grid');
            if (result.ideas.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <div class="empty-state-icon">💭</div>
                        <h3>还没有任何想法</h3>
                        <p>成为第一个分享灵感的人吧！</p>
                    </div>
                `;
            } else {
                grid.innerHTML = result.ideas.map(idea => this.renderIdeaCard(idea)).join('');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    renderLogin(container) {
        if (auth.isLoggedIn()) {
            navigate('home');
            return;
        }

        container.innerHTML = `
            <div class="auth-container">
                <div class="auth-header">
                    <h1>欢迎回来</h1>
                    <p>登录你的账号继续探索</p>
                </div>
                <form id="login-form">
                    <div class="form-group">
                        <label>邮箱</label>
                        <input type="email" name="email" required placeholder="your@email.com">
                    </div>
                    <div class="form-group">
                        <label>密码</label>
                        <input type="password" name="password" required placeholder="••••••••">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">登录</button>
                </form>
                <div class="form-footer">
                    还没有账号？<a href="javascript:void(0)" onclick="navigate('register')">立即注册</a>
                </div>
            </div>
        `;

        document.getElementById('login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                await auth.login({
                    email: formData.get('email'),
                    password: formData.get('password')
                });
                showToast('登录成功！', 'success');
                this.updateNav();
                this.initChat();
                navigate('home');
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }

    renderRegister(container) {
        if (auth.isLoggedIn()) {
            navigate('home');
            return;
        }

        container.innerHTML = `
            <div class="auth-container">
                <div class="auth-header">
                    <h1>加入 GameDev Hub</h1>
                    <p>创建你的账号，开始分享灵感</p>
                </div>
                <form id="register-form">
                    <div class="form-group">
                        <label>用户名</label>
                        <input type="text" name="username" required minlength="3" placeholder="你的用户名">
                    </div>
                    <div class="form-group">
                        <label>邮箱</label>
                        <input type="email" name="email" required placeholder="your@email.com">
                    </div>
                    <div class="form-group">
                        <label>密码</label>
                        <input type="password" name="password" required minlength="6" placeholder="至少6个字符">
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">注册</button>
                </form>
                <div class="form-footer">
                    已有账号？<a href="javascript:void(0)" onclick="navigate('login')">立即登录</a>
                </div>
            </div>
        `;

        document.getElementById('register-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                await auth.register({
                    username: formData.get('username'),
                    email: formData.get('email'),
                    password: formData.get('password')
                });
                showToast('注册成功！', 'success');
                this.updateNav();
                this.initChat();
                navigate('home');
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }

    async renderIdeas(container) {
        container.innerHTML = `
            <div class="page-header">
                <h1>想法广场</h1>
                ${auth.isLoggedIn() ? '<button class="btn btn-primary" onclick="navigate(\'create-idea\')">+ 发布灵感</button>' : ''}
            </div>
            <div class="filters">
                <div class="filter-group">
                    <label>搜索</label>
                    <input type="text" id="search-input" placeholder="搜索想法...">
                </div>
                <div class="filter-group">
                    <label>分类</label>
                    <select id="category-select">
                        <option value="">全部分类</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>排序</label>
                    <select id="sort-select">
                        <option value="created_at">最新发布</option>
                        <option value="likes">最多点赞</option>
                        <option value="comments">最多评论</option>
                    </select>
                </div>
            </div>
            <div id="ideas-grid" class="ideas-grid">
                <div class="loading"><div class="spinner"></div></div>
            </div>
            <div id="pagination" class="pagination"></div>
        `;

        this.loadCategories();
        this.loadIdeasList(1);

        document.getElementById('search-input').addEventListener('input', debounce(() => this.loadIdeasList(1), 300));
        document.getElementById('category-select').addEventListener('change', () => this.loadIdeasList(1));
        document.getElementById('sort-select').addEventListener('change', () => this.loadIdeasList(1));
    }

    async loadCategories() {
        try {
            const result = await api.get('/ideas/categories');
            const select = document.getElementById('category-select');
            result.categories.forEach(cat => {
                const option = document.createElement('option');
                option.value = cat.name;
                option.textContent = `${cat.name} (${cat.count})`;
                select.appendChild(option);
            });
        } catch (error) {
            console.error('加载分类失败:', error);
        }
    }

    async loadIdeasList(page = 1) {
        const search = document.getElementById('search-input')?.value || '';
        const category = document.getElementById('category-select')?.value || '';
        const sort_by = document.getElementById('sort-select')?.value || 'created_at';
        
        try {
            const result = await api.get(`/ideas?page=${page}&per_page=12&search=${encodeURIComponent(search)}&category=${category}&sort_by=${sort_by}`);
            const grid = document.getElementById('ideas-grid');
            
            if (result.ideas.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <div class="empty-state-icon">🔍</div>
                        <h3>没有找到相关想法</h3>
                        <p>试试其他搜索词或分类吧</p>
                    </div>
                `;
            } else {
                grid.innerHTML = result.ideas.map(idea => this.renderIdeaCard(idea)).join('');
            }
            
            this.renderPagination('pagination', result.page, result.pages, (p) => this.loadIdeasList(p));
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    renderIdeaCard(idea) {
        const authorAvatar = idea.author?.avatar && idea.author.avatar !== 'default.png'
            ? idea.author.avatar
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(idea.author?.username || 'User')}&background=6366f1&color=fff`;
        
        const emojis = ['🎮', '🎲', '🎯', '🎪', '🎨', '🎭', '🏰', '🚀', '⚔️', '🔮'];
        const emoji = idea.image_url || emojis[idea.id % emojis.length];
        
        const tags = idea.tags ? idea.tags.split(',').filter(t => t.trim()).slice(0, 3) : [];

        return `
            <div class="idea-card" onclick="navigate('idea/${idea.id}')">
                <div class="idea-image">${emoji}</div>
                <div class="idea-content">
                    <div class="idea-header">
                        <h3 class="idea-title">${escapeHtml(idea.title)}</h3>
                        ${idea.category ? `<span class="category-badge">${escapeHtml(idea.category)}</span>` : ''}
                    </div>
                    <p class="idea-description">${escapeHtml(idea.content)}</p>
                    <div class="tags">
                        ${tags.map(tag => `<span class="tag">#${escapeHtml(tag.trim())}</span>`).join('')}
                    </div>
                    <div class="idea-footer">
                        <div class="author-info">
                            <div class="author-avatar">
                                <img src="${authorAvatar}" alt="${escapeHtml(idea.author?.username || '')}">
                            </div>
                            <span class="author-name">${escapeHtml(idea.author?.username || '未知作者')}</span>
                        </div>
                        <div class="idea-stats">
                            <span class="stat">❤️ ${idea.likes_count || 0}</span>
                            <span class="stat">💬 ${idea.comments_count || 0}</span>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async renderIdeaDetail(container, id) {
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;
        
        try {
            const [ideaResult, likesResult, commentsResult] = await Promise.all([
                api.get(`/ideas/${id}`),
                api.get(`/ideas/${id}/likes`),
                api.get(`/ideas/${id}/comments`)
            ]);

            const idea = ideaResult.idea;
            const isOwner = auth.currentUser && auth.currentUser.id === idea.user_id;
            const isLiked = likesResult.users.some(u => u.id === auth.currentUser?.id);
            
            const authorAvatar = idea.author?.avatar && idea.author.avatar !== 'default.png'
                ? idea.author.avatar
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(idea.author?.username || 'User')}&background=6366f1&color=fff`;
            
            const emojis = ['🎮', '🎲', '🎯', '🎪', '🎨', '🎭', '🏰', '🚀', '⚔️', '🔮'];
            const emoji = idea.image_url || emojis[idea.id % emojis.length];
            
            const tags = idea.tags ? idea.tags.split(',').filter(t => t.trim()) : [];

            container.innerHTML = `
                <button class="btn btn-outline btn-sm" onclick="navigate('ideas')" style="margin-bottom: 1rem;">← 返回列表</button>
                <div class="idea-detail">
                    <div class="idea-detail-header">
                        <div class="idea-header" style="margin-bottom: 1rem;">
                            <h1 class="idea-title" style="font-size: 2rem;">${escapeHtml(idea.title)}</h1>
                            ${idea.category ? `<span class="category-badge">${escapeHtml(idea.category)}</span>` : ''}
                        </div>
                        <div class="author-info" style="margin-bottom: 1rem;">
                            <div class="author-avatar" style="width: 48px; height: 48px;">
                                <img src="${authorAvatar}" alt="${escapeHtml(idea.author?.username || '')}">
                            </div>
                            <div>
                                <div class="author-name" style="color: var(--text-primary); font-weight: 600;">${escapeHtml(idea.author?.username || '未知作者')}</div>
                                <div style="font-size: 0.85rem; color: var(--text-muted);">发布于 ${formatDate(idea.created_at)}</div>
                            </div>
                        </div>
                        <div class="tags">
                            ${tags.map(tag => `<span class="tag">#${escapeHtml(tag.trim())}</span>`).join('')}
                        </div>
                    </div>
                    <div class="idea-image" style="height: 300px; font-size: 6rem;">${emoji}</div>
                    <div class="idea-detail-content">
                        ${escapeHtml(idea.content).replace(/\n/g, '<br>')}
                    </div>
                    <div class="idea-detail-actions">
                        <button class="btn ${isLiked ? 'btn-danger' : 'btn-outline'}" id="like-btn" onclick="toggleLike(${idea.id})">
                            ${isLiked ? '❤️' : '🤍'} ${likesResult.likes} 点赞
                        </button>
                        <button class="btn btn-outline">💬 ${commentsResult.comments.length} 评论</button>
                        ${isOwner ? `
                            <button class="btn btn-outline" onclick="navigate('edit-idea/${idea.id}')">✏️ 编辑</button>
                            <button class="btn btn-danger" onclick="deleteIdea(${idea.id})">🗑️ 删除</button>
                        ` : ''}
                    </div>
                </div>
                <div class="comments-section">
                    <h2 style="margin-bottom: 1.5rem;">评论 (${commentsResult.comments.length})</h2>
                    ${auth.isLoggedIn() ? `
                        <div class="comment-form">
                            <div class="form-group">
                                <label>发表评论</label>
                                <textarea id="comment-input" placeholder="分享你的想法..."></textarea>
                            </div>
                            <button class="btn btn-primary" onclick="addComment(${idea.id})">发表评论</button>
                        </div>
                    ` : `
                        <div class="comment-form" style="text-align: center;">
                            <p>请 <a href="javascript:void(0)" onclick="navigate('login')">登录</a> 后发表评论</p>
                        </div>
                    `}
                    <div id="comments-list">
                        ${commentsResult.comments.length === 0 ? `
                            <div class="empty-state">
                                <div class="empty-state-icon">💬</div>
                                <h3>还没有评论</h3>
                                <p>成为第一个发表评论的人吧！</p>
                            </div>
                        ` : commentsResult.comments.map(c => this.renderComment(c, idea.id)).join('')}
                    </div>
                </div>
            `;
        } catch (error) {
            showToast(error.message, 'error');
            navigate('ideas');
        }
    }

    renderComment(comment, ideaId) {
        const avatar = comment.author?.avatar && comment.author.avatar !== 'default.png'
            ? comment.author.avatar
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(comment.author?.username || 'User')}&background=6366f1&color=fff`;
        
        const isOwner = auth.currentUser && auth.currentUser.id === comment.user_id;
        const canReply = auth.isLoggedIn();
        const replyToUser = comment.reply_to_user?.username;

        return `
            <div class="comment" id="comment-${comment.id}" data-author="${escapeHtml(comment.author?.username || '')}" data-author-id="${comment.user_id}">
                <div class="comment-header">
                    <div class="author-info">
                        <div class="author-avatar">
                            <img src="${avatar}" alt="${escapeHtml(comment.author?.username || '')}">
                        </div>
                        <div>
                            <div style="font-weight: 600;">${escapeHtml(comment.author?.username || '未知用户')}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">${formatDate(comment.created_at)}</div>
                        </div>
                    </div>
                    <div class="comment-actions">
                        ${canReply ? `<button class="btn btn-outline btn-sm" onclick="showReplyForm(${comment.id}, ${ideaId}, ${comment.user_id}, '${escapeHtml(comment.author?.username || '')}')">回复</button>` : ''}
                        ${isOwner ? `<button class="btn btn-danger btn-sm" onclick="deleteComment(${comment.id})">删除</button>` : ''}
                    </div>
                </div>
                <div style="color: var(--text-secondary);">
                    ${replyToUser ? `<span class="reply-mention">@${escapeHtml(replyToUser)}</span> ` : ''}
                    ${escapeHtml(comment.content).replace(/\n/g, '<br>')}
                </div>
                <div id="reply-form-${comment.id}" style="display: none; margin-top: 1rem;"></div>
                ${comment.replies && comment.replies.length > 0 ? `
                    <div class="comment-replies">
                        ${comment.replies.map(r => this.renderComment(r, ideaId)).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderCreateIdea(container) {
        if (!auth.isLoggedIn()) {
            navigate('login');
            return;
        }

        container.innerHTML = `
            <div class="page-header">
                <h1>发布新灵感</h1>
                <button class="btn btn-outline btn-sm" onclick="navigate('ideas')">取消</button>
            </div>
            <div class="auth-container" style="max-width: 800px;">
                <form id="idea-form">
                    <div class="form-group">
                        <label>标题 *</label>
                        <input type="text" name="title" required maxlength="200" placeholder="给你的灵感起个名字">
                    </div>
                    <div class="form-group">
                        <label>分类</label>
                        <select name="category">
                            <option value="general">综合</option>
                            <option value="gameplay">玩法设计</option>
                            <option value="story">剧情设定</option>
                            <option value="art">美术风格</option>
                            <option value="music">音乐音效</option>
                            <option value="tech">技术实现</option>
                            <option value="other">其他</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>标签（用逗号分隔）</label>
                        <input type="text" name="tags" placeholder="例如：RPG, 像素风, 多人">
                    </div>
                    <div class="form-group">
                        <label>内容 *</label>
                        <textarea name="content" required placeholder="详细描述你的灵感..."></textarea>
                    </div>
                    <div class="form-group">
                        <label>图标表情</label>
                        <select name="image_url">
                            <option value="">🎮 游戏</option>
                            <option value="🎲">🎲 骰子</option>
                            <option value="🎯">🎯 目标</option>
                            <option value="🎪">🎪 嘉年华</option>
                            <option value="🎨">🎨 美术</option>
                            <option value="🎭">🎭 剧情</option>
                            <option value="🏰">🏰 城堡</option>
                            <option value="🚀">🚀 太空</option>
                            <option value="⚔️">⚔️ 战斗</option>
                            <option value="🔮">🔮 魔法</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label>
                            <input type="checkbox" name="is_public" checked style="width: auto; margin-right: 0.5rem;">
                            公开可见
                        </label>
                    </div>
                    <button type="submit" class="btn btn-primary btn-block">发布灵感</button>
                </form>
            </div>
        `;

        document.getElementById('idea-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                const result = await api.post('/ideas', {
                    title: formData.get('title'),
                    category: formData.get('category'),
                    tags: formData.get('tags'),
                    content: formData.get('content'),
                    image_url: formData.get('image_url'),
                    is_public: formData.get('is_public') === 'on',
                    status: 'published'
                });
                showToast('灵感发布成功！', 'success');
                navigate(`idea/${result.idea.id}`);
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }

    async renderEditIdea(container, id) {
        if (!auth.isLoggedIn()) {
            navigate('login');
            return;
        }

        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const result = await api.get(`/ideas/${id}`);
            const idea = result.idea;

            if (idea.user_id !== auth.currentUser.id) {
                showToast('没有权限编辑此想法', 'error');
                navigate(`idea/${id}`);
                return;
            }

            container.innerHTML = `
                <div class="page-header">
                    <h1>编辑灵感</h1>
                    <button class="btn btn-outline btn-sm" onclick="navigate('idea/${id}')">取消</button>
                </div>
                <div class="auth-container" style="max-width: 800px;">
                    <form id="edit-idea-form">
                        <div class="form-group">
                            <label>标题 *</label>
                            <input type="text" name="title" required maxlength="200" value="${escapeHtml(idea.title)}">
                        </div>
                        <div class="form-group">
                            <label>分类</label>
                            <select name="category">
                                <option value="general" ${idea.category === 'general' ? 'selected' : ''}>综合</option>
                                <option value="gameplay" ${idea.category === 'gameplay' ? 'selected' : ''}>玩法设计</option>
                                <option value="story" ${idea.category === 'story' ? 'selected' : ''}>剧情设定</option>
                                <option value="art" ${idea.category === 'art' ? 'selected' : ''}>美术风格</option>
                                <option value="music" ${idea.category === 'music' ? 'selected' : ''}>音乐音效</option>
                                <option value="tech" ${idea.category === 'tech' ? 'selected' : ''}>技术实现</option>
                                <option value="other" ${idea.category === 'other' ? 'selected' : ''}>其他</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>标签（用逗号分隔）</label>
                            <input type="text" name="tags" value="${escapeHtml(idea.tags || '')}">
                        </div>
                        <div class="form-group">
                            <label>内容 *</label>
                            <textarea name="content" required>${escapeHtml(idea.content)}</textarea>
                        </div>
                        <div class="form-group">
                            <label>图标表情</label>
                            <select name="image_url">
                                <option value="" ${!idea.image_url ? 'selected' : ''}>🎮 游戏</option>
                                <option value="🎲" ${idea.image_url === '🎲' ? 'selected' : ''}>🎲 骰子</option>
                                <option value="🎯" ${idea.image_url === '🎯' ? 'selected' : ''}>🎯 目标</option>
                                <option value="🎪" ${idea.image_url === '🎪' ? 'selected' : ''}>🎪 嘉年华</option>
                                <option value="🎨" ${idea.image_url === '🎨' ? 'selected' : ''}>🎨 美术</option>
                                <option value="🎭" ${idea.image_url === '🎭' ? 'selected' : ''}>🎭 剧情</option>
                                <option value="🏰" ${idea.image_url === '🏰' ? 'selected' : ''}>🏰 城堡</option>
                                <option value="🚀" ${idea.image_url === '🚀' ? 'selected' : ''}>🚀 太空</option>
                                <option value="⚔️" ${idea.image_url === '⚔️' ? 'selected' : ''}>⚔️ 战斗</option>
                                <option value="🔮" ${idea.image_url === '🔮' ? 'selected' : ''}>🔮 魔法</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>状态</label>
                            <select name="status">
                                <option value="draft" ${idea.status === 'draft' ? 'selected' : ''}>草稿</option>
                                <option value="published" ${idea.status === 'published' ? 'selected' : ''}>已发布</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="checkbox" name="is_public" ${idea.is_public ? 'checked' : ''} style="width: auto; margin-right: 0.5rem;">
                                公开可见
                            </label>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">保存修改</button>
                    </form>
                </div>
            `;

            document.getElementById('edit-idea-form').addEventListener('submit', async (e) => {
                e.preventDefault();
                const formData = new FormData(e.target);
                try {
                    await api.put(`/ideas/${id}`, {
                        title: formData.get('title'),
                        category: formData.get('category'),
                        tags: formData.get('tags'),
                        content: formData.get('content'),
                        image_url: formData.get('image_url'),
                        status: formData.get('status'),
                        is_public: formData.get('is_public') === 'on'
                    });
                    showToast('灵感更新成功！', 'success');
                    navigate(`idea/${id}`);
                } catch (error) {
                    showToast(error.message, 'error');
                }
            });
        } catch (error) {
            showToast(error.message, 'error');
            navigate('ideas');
        }
    }

    async renderMyIdeas(container) {
        if (!auth.isLoggedIn()) {
            navigate('login');
            return;
        }

        container.innerHTML = `
            <div class="page-header">
                <h1>我的灵感</h1>
                <button class="btn btn-primary" onclick="navigate('create-idea')">+ 发布灵感</button>
            </div>
            <div class="filters">
                <div class="filter-group">
                    <label>状态</label>
                    <select id="status-select">
                        <option value="">全部</option>
                        <option value="published">已发布</option>
                        <option value="draft">草稿</option>
                    </select>
                </div>
            </div>
            <div id="my-ideas-grid" class="ideas-grid">
                <div class="loading"><div class="spinner"></div></div>
            </div>
            <div id="my-ideas-pagination" class="pagination"></div>
        `;

        document.getElementById('status-select').addEventListener('change', () => this.loadMyIdeas(1));
        this.loadMyIdeas(1);
    }

    async loadMyIdeas(page = 1) {
        const status = document.getElementById('status-select')?.value || '';
        try {
            const result = await api.get(`/ideas/my?page=${page}&per_page=12&status=${status}`);
            const grid = document.getElementById('my-ideas-grid');
            
            if (result.ideas.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <div class="empty-state-icon">💭</div>
                        <h3>还没有发布任何灵感</h3>
                        <p>点击上方按钮分享你的第一个灵感吧！</p>
                    </div>
                `;
            } else {
                grid.innerHTML = result.ideas.map(idea => this.renderIdeaCard(idea)).join('');
            }
            
            this.renderPagination('my-ideas-pagination', result.page, result.pages, (p) => this.loadMyIdeas(p));
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async renderProfile(container) {
        if (!auth.isLoggedIn()) {
            navigate('login');
            return;
        }

        const user = auth.currentUser;
        const avatar = user.avatar && user.avatar !== 'default.png'
            ? user.avatar
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=6366f1&color=fff`;

        container.innerHTML = `
            <div class="page-header">
                <h1>个人中心</h1>
            </div>
            <div class="profile-container">
                <div class="profile-sidebar">
                    <div class="profile-avatar">
                        <img src="${avatar}" alt="${escapeHtml(user.username)}" id="profile-avatar-img">
                        <label class="avatar-upload">
                            更换头像
                            <input type="file" id="avatar-input" accept="image/*" style="display: none;">
                        </label>
                    </div>
                    <h2 class="profile-name">${escapeHtml(user.username)}</h2>
                    <p class="profile-email">${escapeHtml(user.email)}</p>
                    <span class="status-badge ${user.role === 'admin' ? 'role-admin' : 'role-user'}">${user.role === 'admin' ? '管理员' : '普通用户'}</span>
                    <div class="profile-stats">
                        <div class="profile-stat">
                            <div class="profile-stat-value" id="stat-ideas">0</div>
                            <div class="profile-stat-label">灵感</div>
                        </div>
                        <div class="profile-stat">
                            <div class="profile-stat-value" id="stat-likes">0</div>
                            <div class="profile-stat-label">获赞</div>
                        </div>
                    </div>
                    <p style="margin-top: 1rem; color: var(--text-muted); font-size: 0.85rem;">
                        加入于 ${formatDate(user.created_at)}
                    </p>
                </div>
                <div class="profile-content">
                    <div class="tabs">
                        <button class="tab active" data-tab="edit">编辑资料</button>
                        <button class="tab" data-tab="password">修改密码</button>
                    </div>
                    <div id="tab-content">
                        <div id="tab-edit">
                            <form id="profile-form">
                                <div class="form-group">
                                    <label>用户名</label>
                                    <input type="text" name="username" value="${escapeHtml(user.username)}" minlength="3">
                                </div>
                                <div class="form-group">
                                    <label>个人简介</label>
                                    <textarea name="bio" placeholder="介绍一下你自己...">${escapeHtml(user.bio || '')}</textarea>
                                </div>
                                <div class="form-group">
                                    <label>技能标签（用逗号分隔）</label>
                                    <input type="text" name="skills" value="${escapeHtml(user.skills || '')}" placeholder="例如：Unity, 2D美术, 音效设计">
                                </div>
                                <button type="submit" class="btn btn-primary">保存修改</button>
                            </form>
                        </div>
                        <div id="tab-password" style="display: none;">
                            <form id="password-form">
                                <div class="form-group">
                                    <label>当前密码</label>
                                    <input type="password" name="current_password" required>
                                </div>
                                <div class="form-group">
                                    <label>新密码</label>
                                    <input type="password" name="new_password" required minlength="6">
                                </div>
                                <button type="submit" class="btn btn-primary">修改密码</button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;

        this.loadUserStats(user.id);

        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('#tab-content > div').forEach(d => d.style.display = 'none');
                document.getElementById(`tab-${tab.dataset.tab}`).style.display = 'block';
            });
        });

        document.getElementById('profile-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                const result = await api.put('/profile', {
                    username: formData.get('username'),
                    bio: formData.get('bio'),
                    skills: formData.get('skills')
                });
                auth.updateUser(result.user);
                this.updateNav();
                showToast('资料更新成功！', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        });

        document.getElementById('password-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            try {
                const encryptedCurrentPassword = await auth.encryptPassword(formData.get('current_password'));
                const encryptedNewPassword = await auth.encryptPassword(formData.get('new_password'));
                await api.put('/profile/password', {
                    current_password: encryptedCurrentPassword,
                    new_password: encryptedNewPassword
                });
                showToast('密码修改成功！', 'success');
                e.target.reset();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });

        document.getElementById('avatar-input').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const formData = new FormData();
            formData.append('file', file);

            try {
                const result = await api.upload('/profile/avatar', formData);
                document.getElementById('profile-avatar-img').src = result.avatar_url;
                auth.updateUser({ avatar: result.avatar_url });
                this.updateNav();
                showToast('头像上传成功！', 'success');
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }

    async loadUserStats(userId) {
        try {
            const [ideasResult, profileResult] = await Promise.all([
                api.get(`/ideas?user_id=${userId}&per_page=100`),
                api.get(`/profile/${userId}`)
            ]);
            
            let totalLikes = 0;
            ideasResult.ideas.forEach(idea => {
                totalLikes += idea.likes_count || 0;
            });

            document.getElementById('stat-ideas').textContent = ideasResult.total;
            document.getElementById('stat-likes').textContent = totalLikes;
        } catch (error) {
            console.error('加载用户统计失败:', error);
        }
    }

    async renderUserProfile(container, userId) {
        container.innerHTML = `<div class="loading"><div class="spinner"></div></div>`;

        try {
            const [profileResult, ideasResult] = await Promise.all([
                api.get(`/profile/${userId}`),
                api.get(`/ideas?user_id=${userId}&per_page=100`)
            ]);

            const user = profileResult.user;
            const avatar = user.avatar && user.avatar !== 'default.png'
                ? user.avatar
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=6366f1&color=fff`;

            let totalLikes = 0;
            ideasResult.ideas.forEach(idea => {
                totalLikes += idea.likes_count || 0;
            });

            container.innerHTML = `
                <button class="btn btn-outline btn-sm" onclick="navigate('users')" style="margin-bottom: 1rem;">← 返回开发者列表</button>
                <div class="profile-container">
                    <div class="profile-sidebar">
                        <div class="profile-avatar">
                            <img src="${avatar}" alt="${escapeHtml(user.username)}">
                        </div>
                        <h2 class="profile-name">${escapeHtml(user.username)}</h2>
                        ${user.bio ? `<p style="color: var(--text-secondary); margin-bottom: 1rem;">${escapeHtml(user.bio)}</p>` : ''}
                        ${user.skills ? `
                            <div class="tags" style="justify-content: center;">
                                ${user.skills.split(',').filter(s => s.trim()).map(s => `<span class="tag">${escapeHtml(s.trim())}</span>`).join('')}
                            </div>
                        ` : ''}
                        <div class="profile-stats">
                            <div class="profile-stat">
                                <div class="profile-stat-value">${ideasResult.total}</div>
                                <div class="profile-stat-label">灵感</div>
                            </div>
                            <div class="profile-stat">
                                <div class="profile-stat-value">${totalLikes}</div>
                                <div class="profile-stat-label">获赞</div>
                            </div>
                        </div>
                        <p style="margin-top: 1rem; color: var(--text-muted); font-size: 0.85rem;">
                            加入于 ${formatDate(user.created_at)}
                        </p>
                        ${auth.isLoggedIn() && auth.currentUser.id !== user.id ? `
                            <button class="btn btn-primary btn-sm" style="margin-top: 1rem;" onclick="startPrivateChat(${user.id})">
                                💬 发起私聊
                            </button>
                        ` : ''}
                    </div>
                    <div class="profile-content">
                        <h2 style="margin-bottom: 1.5rem;">TA 的灵感</h2>
                        ${ideasResult.ideas.length === 0 ? `
                            <div class="empty-state">
                                <div class="empty-state-icon">💭</div>
                                <h3>还没有发布任何灵感</h3>
                            </div>
                        ` : `
                            <div class="ideas-grid">
                                ${ideasResult.ideas.map(idea => this.renderIdeaCard(idea)).join('')}
                            </div>
                        `}
                    </div>
                </div>
            `;
        } catch (error) {
            showToast(error.message, 'error');
            navigate('users');
        }
    }

    async renderUsers(container) {
        container.innerHTML = `
            <div class="page-header">
                <h1>开发者社区</h1>
            </div>
            <div class="filters">
                <div class="filter-group">
                    <label>搜索</label>
                    <input type="text" id="user-search" placeholder="搜索开发者...">
                </div>
            </div>
            <div id="users-grid" class="users-grid">
                <div class="loading"><div class="spinner"></div></div>
            </div>
            <div id="users-pagination" class="pagination"></div>
        `;

        document.getElementById('user-search').addEventListener('input', debounce(() => this.loadUsers(1), 300));
        this.loadUsers(1);
    }

    async loadUsers(page = 1) {
        const search = document.getElementById('user-search')?.value || '';
        try {
            const result = await api.get(`/profile/list?page=${page}&per_page=12&search=${encodeURIComponent(search)}`);
            const grid = document.getElementById('users-grid');
            
            if (result.users.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <div class="empty-state-icon">🔍</div>
                        <h3>没有找到相关开发者</h3>
                    </div>
                `;
            } else {
                grid.innerHTML = result.users.map(user => this.renderUserCard(user)).join('');
            }
            
            this.renderPagination('users-pagination', result.page, result.pages, (p) => this.loadUsers(p));
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    renderUserCard(user) {
        const avatar = user.avatar && user.avatar !== 'default.png'
            ? user.avatar
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=6366f1&color=fff`;
        
        const skills = user.skills ? user.skills.split(',').filter(s => s.trim()).slice(0, 3) : [];

        return `
            <div class="user-card">
                <div class="user-card-content" onclick="navigate('user/${user.id}')">
                    <div class="author-avatar">
                        <img src="${avatar}" alt="${escapeHtml(user.username)}">
                    </div>
                    <h3 class="user-card-name">${escapeHtml(user.username)}</h3>
                    <p class="user-card-bio">${escapeHtml(user.bio || '这个人很懒，什么都没写...')}</p>
                    <div class="tags" style="justify-content: center;">
                        ${skills.map(s => `<span class="tag">${escapeHtml(s.trim())}</span>`).join('')}
                    </div>
                </div>
                ${auth.isLoggedIn() && auth.currentUser.id !== user.id ? `
                    <div class="user-card-actions">
                        <button class="btn btn-outline btn-sm btn-block" onclick="event.stopPropagation(); startPrivateChat(${user.id})">
                            💬 私聊
                        </button>
                    </div>
                ` : ''}
            </div>
        `;
    }

    async renderAdmin(container) {
        if (!auth.isLoggedIn() || !auth.isAdmin()) {
            showToast('没有管理员权限', 'error');
            navigate('home');
            return;
        }

        container.innerHTML = `
            <div class="page-header">
                <h1>管理后台</h1>
            </div>
            <div class="profile-container">
                <div class="admin-sidebar">
                    <ul class="admin-menu">
                        <li><a href="javascript:void(0)" class="active" data-tab="dashboard">📊 数据概览</a></li>
                        <li><a href="javascript:void(0)" data-tab="users">👥 用户管理</a></li>
                        <li><a href="javascript:void(0)" data-tab="ideas">💡 想法管理</a></li>
                        <li><a href="javascript:void(0)" data-tab="logs">📋 操作记录</a></li>
                    </ul>
                </div>
                <div class="profile-content">
                    <div id="admin-content">
                        <div id="tab-dashboard">
                            <div class="loading"><div class="spinner"></div></div>
                        </div>
                        <div id="tab-users" style="display: none;">
                            <div class="loading"><div class="spinner"></div></div>
                        </div>
                        <div id="tab-ideas" style="display: none;">
                            <div class="loading"><div class="spinner"></div></div>
                        </div>
                        <div id="tab-logs" style="display: none;">
                            <div class="loading"><div class="spinner"></div></div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.querySelectorAll('.admin-menu a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                document.querySelectorAll('.admin-menu a').forEach(a => a.classList.remove('active'));
                link.classList.add('active');
                const tab = link.dataset.tab;
                document.querySelectorAll('#admin-content > div').forEach(d => d.style.display = 'none');
                document.getElementById(`tab-${tab}`).style.display = 'block';
                
                if (tab === 'dashboard') this.loadAdminDashboard();
                if (tab === 'users') this.loadAdminUsers();
                if (tab === 'ideas') this.loadAdminIdeas();
                if (tab === 'logs') this.loadAdminOperationLogs();
            });
        });

        this.loadAdminDashboard();
    }

    showResetPasswordModal(userId, username) {
        this.resetUserId = userId;
        this.resetUsername = username;
        
        let modal = document.getElementById('reset-password-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'reset-password-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>重置用户密码</h3>
                        <button class="modal-close" onclick="hideResetPasswordModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>用户名</label>
                            <input type="text" id="reset-username-display" readonly>
                        </div>
                        <div class="form-group">
                            <label>新密码 *</label>
                            <input type="password" id="new-password-input" placeholder="输入新密码（至少6位）" minlength="6">
                        </div>
                        <div class="form-group">
                            <label>确认新密码 *</label>
                            <input type="password" id="confirm-password-input" placeholder="再次输入新密码" minlength="6">
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="hideResetPasswordModal()">取消</button>
                        <button class="btn btn-primary" onclick="confirmResetPassword()">确认重置</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        document.getElementById('reset-username-display').value = username;
        document.getElementById('new-password-input').value = '';
        document.getElementById('confirm-password-input').value = '';
        modal.style.display = 'flex';
    }

    hideResetPasswordModal() {
        const modal = document.getElementById('reset-password-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async confirmResetPassword() {
        const newPassword = document.getElementById('new-password-input').value;
        const confirmPassword = document.getElementById('confirm-password-input').value;
        
        if (!newPassword || newPassword.length < 6) {
            showToast('密码至少需要6位', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showToast('两次输入的密码不一致', 'error');
            return;
        }
        
        if (!confirm(`确定要重置用户 "${this.resetUsername}" 的密码吗？`)) {
            return;
        }
        
        try {
            const encryptedPassword = await auth.encryptPassword(newPassword);
            await api.post(`/admin/users/${this.resetUserId}/reset-password`, {
                new_password: encryptedPassword
            });
            
            showToast('密码重置成功！', 'success');
            this.hideResetPasswordModal();
            
            if (this.currentPage === 'admin') {
                this.loadAdminUsers();
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async loadAdminDashboard() {
        const container = document.getElementById('tab-dashboard');
        try {
            const stats = await api.get('/admin/stats');
            container.innerHTML = `
                <h2 style="margin-bottom: 1.5rem;">数据概览</h2>
                <div class="stats-grid">
                    <div class="stat-card">
                        <div class="stat-card-label">总用户数</div>
                        <div class="stat-card-value">${stats.total_users}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">总灵感数</div>
                        <div class="stat-card-value">${stats.total_ideas}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">总点赞数</div>
                        <div class="stat-card-value">${stats.total_likes}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">总评论数</div>
                        <div class="stat-card-value">${stats.total_comments}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">今日新增用户</div>
                        <div class="stat-card-value">${stats.new_users_today}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">今日新增灵感</div>
                        <div class="stat-card-value">${stats.new_ideas_today}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">活跃用户</div>
                        <div class="stat-card-value">${stats.active_users}</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-card-label">禁用用户</div>
                        <div class="stat-card-value">${stats.inactive_users}</div>
                    </div>
                </div>
            `;
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async loadAdminUsers(page = 1) {
        const container = document.getElementById('tab-users');
        try {
            const search = document.getElementById('admin-user-search')?.value || '';
            const role = document.getElementById('admin-user-role')?.value || '';
            const status = document.getElementById('admin-user-status')?.value || '';
            
            let url = `/admin/users?page=${page}&per_page=10`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (role) url += `&role=${role}`;
            if (status) url += `&status=${status}`;
            
            const result = await api.get(url);
            container.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
                    <h2 style="margin: 0;">用户管理</h2>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-primary" onclick="showCreateUserModal()">+ 添加用户</button>
                        <div class="dropdown" style="position: relative;">
                            <button class="btn btn-outline" onclick="toggleExportDropdown()">
                                📥 导出 ▾
                            </button>
                            <div id="export-dropdown" class="dropdown-menu" style="display: none; position: absolute; right: 0; top: 100%; min-width: 120px; z-index: 1000;">
                                <a href="javascript:void(0)" onclick="exportUsers('csv'); hideExportDropdown();">📄 导出 CSV</a>
                                <a href="javascript:void(0)" onclick="exportUsers('excel'); hideExportDropdown();">📊 导出 Excel</a>
                                <a href="javascript:void(0)" onclick="exportUsers('pdf'); hideExportDropdown();">📑 导出 PDF</a>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="filters">
                    <div class="filter-group">
                        <label>搜索</label>
                        <input type="text" id="admin-user-search" placeholder="搜索用户..." value="${escapeHtml(search)}">
                    </div>
                    <div class="filter-group">
                        <label>角色</label>
                        <select id="admin-user-role">
                            <option value="" ${role === '' ? 'selected' : ''}>全部</option>
                            <option value="user" ${role === 'user' ? 'selected' : ''}>普通用户</option>
                            <option value="admin" ${role === 'admin' ? 'selected' : ''}>管理员</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>状态</label>
                        <select id="admin-user-status">
                            <option value="" ${status === '' ? 'selected' : ''}>全部</option>
                            <option value="active" ${status === 'active' ? 'selected' : ''}>活跃</option>
                            <option value="inactive" ${status === 'inactive' ? 'selected' : ''}>禁用</option>
                        </select>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>用户名</th>
                                <th>邮箱</th>
                                <th>角色</th>
                                <th>状态</th>
                                <th>注册时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${result.users.map(user => `
                                <tr>
                                    <td>${user.id}</td>
                                    <td>${escapeHtml(user.username)}</td>
                                    <td>${escapeHtml(user.email)}</td>
                                    <td><span class="status-badge ${user.role === 'admin' ? 'role-admin' : 'role-user'}">${user.role === 'admin' ? '管理员' : '普通用户'}</span></td>
                                    <td><span class="status-badge ${user.is_active ? 'status-active' : 'status-inactive'}">${user.is_active ? '活跃' : '禁用'}</span></td>
                                    <td>${formatDate(user.created_at)}</td>
                                    <td>
                                        <div class="actions">
                                            <button class="btn btn-outline btn-sm" onclick="adminToggleUserStatus(${user.id}, ${user.is_active})">${user.is_active ? '禁用' : '启用'}</button>
                                            <button class="btn btn-outline btn-sm" onclick="adminToggleUserRole(${user.id}, '${user.role}')">${user.role === 'admin' ? '降为用户' : '设为管理员'}</button>
                                            <button class="btn btn-primary btn-sm" data-user-id="${user.id}" data-username="${escapeHtml(user.username)}" onclick="showResetPasswordModal(this.dataset.userId, this.dataset.username)">重置密码</button>
                                            <button class="btn btn-danger btn-sm" onclick="adminDeleteUser(${user.id})">删除</button>
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="pagination" id="admin-users-pagination"></div>
            `;

            this.renderPagination('admin-users-pagination', result.page, result.pages, (p) => this.loadAdminUsers(p));

            document.getElementById('admin-user-search').addEventListener('input', debounce(() => this.loadAdminUsers(1), 300));
            document.getElementById('admin-user-role').addEventListener('change', () => this.loadAdminUsers(1));
            document.getElementById('admin-user-status').addEventListener('change', () => this.loadAdminUsers(1));
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async loadAdminIdeas(page = 1) {
        const container = document.getElementById('tab-ideas');
        try {
            const search = document.getElementById('admin-idea-search')?.value || '';
            const status = document.getElementById('admin-idea-status')?.value || '';
            
            const include_deleted = document.getElementById('admin-idea-deleted')?.value || 'false';
            
            let url = `/admin/ideas?page=${page}&per_page=10`;
            if (search) url += `&search=${encodeURIComponent(search)}`;
            if (status) url += `&status=${status}`;
            if (include_deleted === 'true') url += '&include_deleted=true';
            if (include_deleted === 'only') url += '&only_deleted=true';
            
            const result = await api.get(url);
            container.innerHTML = `
                <h2 style="margin-bottom: 1.5rem;">想法管理</h2>
                <div class="filters">
                    <div class="filter-group">
                        <label>搜索</label>
                        <input type="text" id="admin-idea-search" placeholder="搜索想法..." value="${escapeHtml(search)}">
                    </div>
                    <div class="filter-group">
                        <label>状态</label>
                        <select id="admin-idea-status">
                            <option value="" ${status === '' ? 'selected' : ''}>全部</option>
                            <option value="published" ${status === 'published' ? 'selected' : ''}>已发布</option>
                            <option value="draft" ${status === 'draft' ? 'selected' : ''}>草稿</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>已删除</label>
                        <select id="admin-idea-deleted">
                            <option value="false" ${include_deleted === 'false' ? 'selected' : ''}>不显示</option>
                            <option value="true" ${include_deleted === 'true' ? 'selected' : ''}>包含已删除</option>
                            <option value="only" ${include_deleted === 'only' ? 'selected' : ''}>仅显示已删除</option>
                        </select>
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>标题</th>
                                <th>作者</th>
                                <th>分类</th>
                                <th>状态</th>
                                <th>已删除</th>
                                <th>创建时间</th>
                                <th>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${result.ideas.length === 0 ? `
                                <tr><td colspan="8" style="text-align: center; padding: 2rem;">暂无数据</td></tr>
                            ` : result.ideas.map(idea => `
                                <tr ${idea.is_deleted ? 'style="opacity: 0.6; background: #fef2f2;"' : ''}>
                                    <td>${idea.id}</td>
                                    <td>${escapeHtml(idea.title)}</td>
                                    <td>${escapeHtml(idea.author?.username || '未知')}</td>
                                    <td>${escapeHtml(idea.category || '')}</td>
                                    <td><span class="status-badge ${idea.status === 'published' ? 'status-active' : 'status-inactive'}">${idea.status === 'published' ? '已发布' : '草稿'}</span></td>
                                    <td>${idea.is_deleted ? '<span class="status-badge status-inactive">已删除</span>' : '-'}</td>
                                    <td>${formatDate(idea.created_at)}</td>
                                    <td>
                                        <div class="actions">
                                            ${idea.is_deleted ? `
                                                <button class="btn btn-outline btn-sm" onclick="adminRestoreIdea(${idea.id})">↺ 恢复</button>
                                                <button class="btn btn-danger btn-sm" onclick="adminPermanentDeleteIdea(${idea.id}, '${escapeHtml(idea.title)}')">彻底删除</button>
                                            ` : `
                                                <button class="btn btn-outline btn-sm" onclick="navigate('idea/${idea.id}')">查看</button>
                                                <button class="btn btn-danger btn-sm" onclick="adminDeleteIdea(${idea.id})">删除</button>
                                            `}
                                        </div>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="pagination" id="admin-ideas-pagination"></div>
            `;

            this.renderPagination('admin-ideas-pagination', result.page, result.pages, (p) => this.loadAdminIdeas(p));

            document.getElementById('admin-idea-search').addEventListener('input', debounce(() => this.loadAdminIdeas(1), 300));
            document.getElementById('admin-idea-status').addEventListener('change', () => this.loadAdminIdeas(1));
            document.getElementById('admin-idea-deleted').addEventListener('change', () => this.loadAdminIdeas(1));
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async loadAdminOperationLogs(page = 1) {
        const container = document.getElementById('tab-logs');
        try {
            const operation_type = document.getElementById('log-operation-type')?.value || '';
            const target_type = document.getElementById('log-target-type')?.value || '';
            const user_id = document.getElementById('log-user-id')?.value || '';
            const start_date = document.getElementById('log-start-date')?.value || '';
            const end_date = document.getElementById('log-end-date')?.value || '';
            
            let url = `/admin/operation-logs?page=${page}&per_page=20`;
            if (operation_type) url += `&operation_type=${encodeURIComponent(operation_type)}`;
            if (target_type) url += `&target_type=${encodeURIComponent(target_type)}`;
            if (user_id) url += `&user_id=${encodeURIComponent(user_id)}`;
            if (start_date) url += `&start_date=${encodeURIComponent(start_date)}`;
            if (end_date) url += `&end_date=${encodeURIComponent(end_date)}`;
            
            const result = await api.get(url);
            const operationTypeMap = {
                'create': '创建',
                'update': '更新',
                'delete': '删除',
                'restore': '恢复',
                'remove_member': '移除成员',
                'admin_create': '管理员创建',
                'admin_update': '管理员更新',
                'admin_delete': '管理员删除',
                'permanent_delete': '永久删除'
            };
            const targetTypeMap = {
                'idea': '文档',
                'user': '用户',
                'comment': '评论',
                'chat_room': '聊天室',
                'chat_message': '聊天消息',
                'chat_room_member': '群成员'
            };
            
            container.innerHTML = `
                <h2 style="margin-bottom: 1.5rem;">操作记录管理</h2>
                <div class="filters">
                    <div class="filter-group">
                        <label>操作类型</label>
                        <select id="log-operation-type">
                            <option value="">全部</option>
                            <option value="create" ${operation_type === 'create' ? 'selected' : ''}>创建</option>
                            <option value="update" ${operation_type === 'update' ? 'selected' : ''}>更新</option>
                            <option value="delete" ${operation_type === 'delete' ? 'selected' : ''}>删除</option>
                            <option value="restore" ${operation_type === 'restore' ? 'selected' : ''}>恢复</option>
                            <option value="remove_member" ${operation_type === 'remove_member' ? 'selected' : ''}>移除成员</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>目标类型</label>
                        <select id="log-target-type">
                            <option value="">全部</option>
                            <option value="idea" ${target_type === 'idea' ? 'selected' : ''}>文档</option>
                            <option value="user" ${target_type === 'user' ? 'selected' : ''}>用户</option>
                            <option value="comment" ${target_type === 'comment' ? 'selected' : ''}>评论</option>
                            <option value="chat_room" ${target_type === 'chat_room' ? 'selected' : ''}>聊天室</option>
                            <option value="chat_message" ${target_type === 'chat_message' ? 'selected' : ''}>聊天消息</option>
                            <option value="chat_room_member" ${target_type === 'chat_room_member' ? 'selected' : ''}>群成员</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>用户ID</label>
                        <input type="number" id="log-user-id" placeholder="输入用户ID" value="${user_id}">
                    </div>
                    <div class="filter-group">
                        <label>开始日期</label>
                        <input type="date" id="log-start-date" value="${start_date}">
                    </div>
                    <div class="filter-group">
                        <label>结束日期</label>
                        <input type="date" id="log-end-date" value="${end_date}">
                    </div>
                </div>
                <div class="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>时间</th>
                                <th>操作人</th>
                                <th>操作类型</th>
                                <th>目标类型</th>
                                <th>目标ID</th>
                                <th>IP地址</th>
                                <th>详情</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${result.logs.length === 0 ? `
                                <tr><td colspan="8" style="text-align: center; padding: 2rem;">暂无操作记录</td></tr>
                            ` : result.logs.map(log => `
                                <tr>
                                    <td>${log.id}</td>
                                    <td style="white-space: nowrap;">${formatDate(log.created_at)}</td>
                                    <td>${escapeHtml(log.user?.username || '未知')}</td>
                                    <td><span class="status-badge ${log.operation_type.includes('delete') ? 'status-inactive' : log.operation_type.includes('restore') ? 'status-active' : ''}">${operationTypeMap[log.operation_type] || log.operation_type}</span></td>
                                    <td>${targetTypeMap[log.target_type] || log.target_type}</td>
                                    <td>${log.target_id || '-'}</td>
                                    <td style="font-size: 0.75rem; color: var(--text-muted);">${log.ip_address || '-'}</td>
                                    <td style="max-width: 300px; font-size: 0.75rem;">
                                        ${log.details ? `<code style="background: var(--bg-secondary); padding: 2px 4px; border-radius: 4px; white-space: pre-wrap; word-break: break-all;">${escapeHtml(typeof log.details === 'object' ? JSON.stringify(log.details, null, 0) : log.details)}</code>` : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
                <div class="pagination" id="admin-logs-pagination"></div>
            `;

            this.renderPagination('admin-logs-pagination', result.page, result.pages, (p) => this.loadAdminOperationLogs(p));

            const reload = debounce(() => this.loadAdminOperationLogs(1), 300);
            document.getElementById('log-operation-type').addEventListener('change', reload);
            document.getElementById('log-target-type').addEventListener('change', reload);
            document.getElementById('log-user-id').addEventListener('input', reload);
            document.getElementById('log-start-date').addEventListener('change', reload);
            document.getElementById('log-end-date').addEventListener('change', reload);
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    renderPagination(containerId, currentPage, totalPages, onChange) {
        const container = document.getElementById(containerId);
        if (!container || totalPages <= 1) {
            if (container) container.innerHTML = '';
            return;
        }

        let html = `
            <button class="page-btn" onclick="window.paginationCallbacks['${containerId}'](${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>上一页</button>
        `;

        for (let i = 1; i <= totalPages; i++) {
            if (i === 1 || i === totalPages || (i >= currentPage - 2 && i <= currentPage + 2)) {
                html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="window.paginationCallbacks['${containerId}'](${i})">${i}</button>`;
            } else if (i === currentPage - 3 || i === currentPage + 3) {
                html += `<span style="padding: 0.5rem;">...</span>`;
            }
        }

        html += `
            <button class="page-btn" onclick="window.paginationCallbacks['${containerId}'](${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>下一页</button>
        `;

        container.innerHTML = html;
        
        if (!window.paginationCallbacks) window.paginationCallbacks = {};
        window.paginationCallbacks[containerId] = onChange;
    }

    async renderChat(container, roomId) {
        if (!auth.isLoggedIn()) {
            navigate('login');
            return;
        }

        this.currentRoomId = roomId ? parseInt(roomId) : null;
        this.chatMessages = [];

        container.innerHTML = `
            <div class="page-header">
                <h1>消息中心</h1>
                <button class="btn btn-primary" onclick="app.showCreateRoomModal()">+ 创建群聊</button>
            </div>
            <div class="chat-container">
                <div class="chat-sidebar">
                    <div class="chat-tabs">
                        <button class="chat-tab active" data-type="all" onclick="app.filterChatRooms('all')">全部</button>
                        <button class="chat-tab" data-type="group" onclick="app.filterChatRooms('group')">群聊</button>
                        <button class="chat-tab" data-type="private" onclick="app.filterChatRooms('private')">私聊</button>
                    </div>
                    <div class="chat-room-list" id="chat-room-list">
                        <div class="loading"><div class="spinner"></div></div>
                    </div>
                    <div class="chat-settings">
                        <button class="btn btn-outline btn-block btn-sm" onclick="app.showNotificationSettings()">⚙️ 消息通知设置</button>
                    </div>
                </div>
                <div class="chat-main" id="chat-main">
                    <div class="chat-empty-state" id="chat-empty-state">
                        <div class="empty-state-icon">💬</div>
                        <h3>选择一个会话开始聊天</h3>
                        <p>或前往 <a href="javascript:void(0)" onclick="navigate('users')">开发者社区</a> 与其他开发者开始私聊</p>
                    </div>
                    <div class="chat-window" id="chat-window" style="display: none;">
                        <div class="chat-header" id="chat-header"></div>
                        <div class="chat-messages" id="chat-messages"></div>
                        <div class="chat-input-area">
                            <div id="typing-indicator" class="typing-indicator" style="display: none;"></div>
                            <div class="chat-input-wrapper">
                                <textarea id="chat-input" placeholder="输入消息..." onkeydown="app.handleChatInputKeydown(event)"></textarea>
                                <button class="btn btn-primary" onclick="app.sendChatMessage()">发送</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <div id="create-room-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>创建群聊</h3>
                        <button class="modal-close" onclick="app.hideCreateRoomModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>群名称 *</label>
                            <input type="text" id="new-room-name" placeholder="输入群名称" maxlength="50">
                        </div>
                        <div class="form-group">
                            <label>选择成员</label>
                            <div id="user-select-list" class="user-select-list">
                                <div class="loading"><div class="spinner"></div></div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="app.hideCreateRoomModal()">取消</button>
                        <button class="btn btn-primary" onclick="app.createGroupChat()">创建群聊</button>
                    </div>
                </div>
            </div>
            
            <div id="notification-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>消息通知设置</h3>
                        <button class="modal-close" onclick="app.hideNotificationSettings()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="notification-setting">
                            <label class="setting-label">
                                <span>私聊消息通知</span>
                                <div class="toggle-switch">
                                    <input type="checkbox" id="private-notify-toggle">
                                    <span class="toggle-slider"></span>
                                </div>
                            </label>
                            <p class="setting-desc">开启后，收到私聊消息时会收到通知提醒</p>
                        </div>
                        <div class="notification-setting">
                            <label class="setting-label">
                                <span>群聊消息通知</span>
                                <div class="toggle-switch">
                                    <input type="checkbox" id="group-notify-toggle">
                                    <span class="toggle-slider"></span>
                                </div>
                            </label>
                            <p class="setting-desc">开启后，收到群聊消息时会收到通知提醒</p>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="app.hideNotificationSettings()">关闭</button>
                        <button class="btn btn-primary" onclick="app.saveNotificationSettings()">保存设置</button>
                    </div>
                </div>
            </div>
            
            <div id="room-members-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>群成员列表</h3>
                        <button class="modal-close" onclick="app.hideRoomMembersModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div id="room-members-list" class="room-members-list"></div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="app.hideRoomMembersModal()">关闭</button>
                    </div>
                </div>
            </div>
            
            <div id="chat-context-menu" class="context-menu" style="display: none;">
                <div class="context-menu-item" id="ctx-menu-leave" onclick="app.handleContextMenuAction('leave')">
                    <span>🚪</span>
                    <span id="ctx-menu-leave-text">退出群聊</span>
                </div>
                <div class="context-menu-item" id="ctx-menu-delete" onclick="app.handleContextMenuAction('delete')">
                    <span>🗑️</span>
                    <span id="ctx-menu-delete-text">删除对话</span>
                </div>
            </div>
        `;

        this.chatFilter = 'all';
        await this.loadChatRooms();

        if (this.currentRoomId) {
            await this.openChatRoom(this.currentRoomId);
        }
    }

    async loadChatRooms() {
        const container = document.getElementById('chat-room-list');
        if (!container) return;

        try {
            const rooms = await chatClient.getRooms();
            this.chatRooms = rooms;
            this.renderChatRoomList();
        } catch (error) {
            container.innerHTML = `<div class="empty-state"><p>加载失败，请刷新重试</p></div>`;
        }
    }

    renderChatRoomList() {
        const container = document.getElementById('chat-room-list');
        if (!container || !this.chatRooms) return;

        let filteredRooms = this.chatRooms;
        if (this.chatFilter !== 'all') {
            filteredRooms = this.chatRooms.filter(r => r.type === this.chatFilter);
        }

        if (filteredRooms.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 2rem;">
                    <div class="empty-state-icon" style="font-size: 2rem;">💭</div>
                    <p>暂无${this.chatFilter === 'group' ? '群聊' : this.chatFilter === 'private' ? '私聊' : '会话'}</p>
                </div>
            `;
            return;
        }

        container.innerHTML = filteredRooms.map(room => this.renderChatRoomItem(room)).join('');
    }

    renderChatRoomItem(room) {
        const isActive = this.currentRoomId === room.id;
        const avatar = room.type === 'private' && room.other_user
            ? (room.other_user.avatar && room.other_user.avatar !== 'default.png'
                ? room.other_user.avatar
                : `https://ui-avatars.com/api/?name=${encodeURIComponent(room.other_user.username)}&background=6366f1&color=fff`)
            : (room.type === 'group' ? '👥' : '💬');

        const lastMessage = room.last_message;
        const lastMessageText = lastMessage 
            ? (lastMessage.user_id === auth.currentUser.id ? '你: ' : `${lastMessage.user?.username || ''}: `) + escapeHtml(lastMessage.content)
            : '暂无消息';

        const unreadCount = room.members?.find?.(m => m.user_id === auth.currentUser.id)?.unread_count || 0;
        const isOwner = room.created_by === auth.currentUser.id;

        return `
            <div class="chat-room-item ${isActive ? 'active' : ''}">
                <div class="chat-room-item-main" onclick="app.openChatRoom(${room.id})">
                    <div class="chat-room-avatar">
                        ${room.type === 'group' 
                            ? `<span class="group-avatar">${avatar}</span>`
                            : `<img src="${avatar}" alt="${escapeHtml(room.name)}">`
                        }
                        ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount > 99 ? '99+' : unreadCount}</span>` : ''}
                    </div>
                    <div class="chat-room-info">
                        <div class="chat-room-header">
                            <span class="chat-room-name">${escapeHtml(room.name)}</span>
                            <span class="chat-room-time">${lastMessage ? formatDate(lastMessage.created_at) : ''}</span>
                        </div>
                        <div class="chat-room-preview">${lastMessageText}</div>
                    </div>
                </div>
                <div class="chat-room-menu" onclick="event.stopPropagation(); app.showRoomContextMenu(event, ${room.id}, '${room.type}', ${isOwner})">
                    <button class="btn-icon" title="更多操作">⋮</button>
                </div>
            </div>
        `;
    }

    filterChatRooms(type) {
        this.chatFilter = type;
        document.querySelectorAll('.chat-tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.type === type);
        });
        this.renderChatRoomList();
    }

    async openChatRoom(roomId) {
        this.currentRoomId = roomId;
        chatClient.joinRoom(roomId);
        
        document.getElementById('chat-empty-state').style.display = 'none';
        document.getElementById('chat-window').style.display = 'flex';
        
        const room = this.chatRooms.find(r => r.id === roomId);
        if (room) {
            const header = document.getElementById('chat-header');
            const avatar = room.type === 'private' && room.other_user
                ? (room.other_user.avatar && room.other_user.avatar !== 'default.png'
                    ? room.other_user.avatar
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(room.other_user.username)}&background=6366f1&color=fff`)
                : '👥';
            
            const isOwner = room.created_by === auth.currentUser.id;
            
            header.innerHTML = `
                <div class="chat-room-avatar">
                    ${room.type === 'group' 
                        ? `<span class="group-avatar">${avatar}</span>`
                        : `<img src="${avatar}" alt="${escapeHtml(room.name)}">`
                    }
                </div>
                <div class="chat-room-info">
                    <span class="chat-room-name">${escapeHtml(room.name)}</span>
                    <span class="chat-room-type">${room.type === 'group' ? `群聊 · ${room.members_count}人` : '私聊'}</span>
                </div>
                <div class="chat-header-actions">
                    ${room.type === 'group' ? `
                        <button class="btn btn-outline btn-sm" onclick="app.showRoomMembers(${roomId})">成员</button>
                    ` : ''}
                    <div class="chat-header-menu">
                        <button class="btn-icon" onclick="event.stopPropagation(); app.showHeaderContextMenu(event, ${roomId}, '${room.type}', ${isOwner})" title="更多操作">⋮</button>
                    </div>
                </div>
            `;
        }
        
        this.renderChatRoomList();
        await this.loadChatMessages(roomId);
        
        chatClient.markAsRead(roomId);
        chatClient.updateUnreadCount();
    }

    async loadChatMessages(roomId) {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        try {
            const result = await chatClient.getMessages(roomId);
            this.chatMessages = result.messages;
            this.renderChatMessages();
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    renderChatMessages() {
        const container = document.getElementById('chat-messages');
        if (!container) return;

        if (this.chatMessages.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 2rem;">
                    <div class="empty-state-icon">💬</div>
                    <p>还没有消息，发送第一条消息吧！</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.chatMessages.map(msg => this.renderChatMessage(msg)).join('');
        container.scrollTop = container.scrollHeight;
    }

    renderChatMessage(message) {
        if (message.message_type === 'system') {
            return `
                <div class="chat-message system">
                    <div class="system-message">
                        ${escapeHtml(message.content)}
                    </div>
                </div>
            `;
        }

        const isOwn = message.user_id === auth.currentUser.id;
        const avatar = message.user?.avatar && message.user.avatar !== 'default.png'
            ? message.user.avatar
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(message.user?.username || 'User')}&background=6366f1&color=fff`;

        return `
            <div class="chat-message ${isOwn ? 'own' : ''}">
                <div class="message-avatar">
                    <img src="${avatar}" alt="${escapeHtml(message.user?.username || '')}">
                </div>
                <div class="message-content">
                    ${!isOwn ? `<div class="message-sender">${escapeHtml(message.user?.username || '')}</div>` : ''}
                    <div class="message-bubble">
                        ${escapeHtml(message.content)}
                    </div>
                    <div class="message-time">${formatDateTime(message.created_at)}</div>
                </div>
            </div>
        `;
    }

    appendMessage(message) {
        if (message.room_id !== this.currentRoomId) return;
        
        this.chatMessages.push(message);
        const container = document.getElementById('chat-messages');
        if (container) {
            container.insertAdjacentHTML('beforeend', this.renderChatMessage(message));
            container.scrollTop = container.scrollHeight;
        }
        
        chatClient.markAsRead(message.room_id);
    }

    handleChatInputKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendChatMessage();
        }
        
        if (this.currentRoomId) {
            chatClient.sendTyping(this.currentRoomId, true);
        }
    }

    sendChatMessage() {
        const input = document.getElementById('chat-input');
        const content = input?.value.trim();
        
        if (!content || !this.currentRoomId) return;
        
        chatClient.sendMessage(this.currentRoomId, content);
        input.value = '';
    }

    async showCreateRoomModal() {
        document.getElementById('create-room-modal').style.display = 'flex';
        
        try {
            const result = await api.get('/profile/list?per_page=100');
            const users = result.users.filter(u => u.id !== auth.currentUser.id);
            
            const container = document.getElementById('user-select-list');
            container.innerHTML = users.map(user => {
                const avatar = user.avatar && user.avatar !== 'default.png'
                    ? user.avatar
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=6366f1&color=fff`;
                
                return `
                    <label class="user-select-item">
                        <input type="checkbox" value="${user.id}" class="user-checkbox">
                        <img src="${avatar}" alt="${escapeHtml(user.username)}">
                        <span>${escapeHtml(user.username)}</span>
                    </label>
                `;
            }).join('');
        } catch (error) {
            document.getElementById('user-select-list').innerHTML = '<p>加载用户列表失败</p>';
        }
    }

    hideCreateRoomModal() {
        document.getElementById('create-room-modal').style.display = 'none';
    }

    async createGroupChat() {
        const name = document.getElementById('new-room-name').value.trim();
        const checkboxes = document.querySelectorAll('.user-checkbox:checked');
        const memberIds = Array.from(checkboxes).map(cb => parseInt(cb.value));
        
        if (!name) {
            showToast('请输入群名称', 'error');
            return;
        }
        
        try {
            const room = await chatClient.createGroupRoom(name, memberIds);
            if (room) {
                showToast('群聊创建成功！', 'success');
                this.hideCreateRoomModal();
                await this.loadChatRooms();
                await this.openChatRoom(room.id);
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async showNotificationSettings() {
        const settings = await chatClient.getNotificationSettings();
        if (settings) {
            document.getElementById('private-notify-toggle').checked = settings.private_message_notify;
            document.getElementById('group-notify-toggle').checked = settings.group_message_notify;
        }
        document.getElementById('notification-modal').style.display = 'flex';
    }

    hideNotificationSettings() {
        document.getElementById('notification-modal').style.display = 'none';
    }

    async saveNotificationSettings() {
        const settings = {
            private_message_notify: document.getElementById('private-notify-toggle').checked,
            group_message_notify: document.getElementById('group-notify-toggle').checked
        };
        
        try {
            await chatClient.updateNotificationSettings(settings);
            showToast('设置已保存！', 'success');
            this.hideNotificationSettings();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async showRoomMembers(roomId) {
        try {
            const result = await api.get(`/chat/rooms/${roomId}/members`);
            const members = result.members;
            
            const container = document.getElementById('room-members-list');
            container.innerHTML = members.map(member => {
                const user = member.user;
                if (!user) return '';
                
                const avatar = user.avatar && user.avatar !== 'default.png'
                    ? user.avatar
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=6366f1&color=fff`;
                
                const isCurrentUser = user.id === auth.currentUser.id;
                
                return `
                    <div class="room-member-item">
                        <div class="room-member-info">
                            <div class="room-member-avatar">
                                <img src="${avatar}" alt="${escapeHtml(user.username)}">
                            </div>
                            <div class="room-member-details">
                                <div class="room-member-name">${escapeHtml(user.username)}</div>
                                ${user.bio ? `<div class="room-member-bio">${escapeHtml(user.bio)}</div>` : ''}
                            </div>
                        </div>
                        ${!isCurrentUser ? `
                            <button class="btn btn-primary btn-sm" onclick="startPrivateChatFromRoom(${user.id})">
                                💬 私聊
                            </button>
                        ` : `
                            <span class="badge">你</span>
                        `}
                    </div>
                `;
            }).join('');
            
            document.getElementById('room-members-modal').style.display = 'flex';
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    hideRoomMembersModal() {
        document.getElementById('room-members-modal').style.display = 'none';
    }

    showRoomContextMenu(event, roomId, roomType, isOwner) {
        event.preventDefault();
        event.stopPropagation();
        this._contextMenuRoomId = roomId;
        this._contextMenuRoomType = roomType;
        this._contextMenuIsOwner = isOwner;
        
        const menu = document.getElementById('chat-context-menu');
        const leaveItem = document.getElementById('ctx-menu-leave');
        const deleteItem = document.getElementById('ctx-menu-delete');
        const leaveText = document.getElementById('ctx-menu-leave-text');
        const deleteText = document.getElementById('ctx-menu-delete-text');
        
        if (roomType === 'private') {
            leaveItem.style.display = 'none';
            deleteItem.style.display = 'flex';
            deleteText.textContent = '删除对话';
        } else {
            leaveItem.style.display = 'flex';
            if (isOwner) {
                leaveText.textContent = '解散群聊';
                deleteItem.style.display = 'flex';
                deleteText.textContent = '删除群聊';
            } else {
                leaveText.textContent = '退出群聊';
                deleteItem.style.display = 'none';
            }
        }
        
        const rect = event.currentTarget.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.display = 'block';
        
        setTimeout(() => {
            document.addEventListener('click', this._hideContextMenuHandler = (e) => {
                if (!menu.contains(e.target)) {
                    this.hideContextMenu();
                }
            });
        }, 0);
    }

    showHeaderContextMenu(event, roomId, roomType, isOwner) {
        event.preventDefault();
        event.stopPropagation();
        this._contextMenuRoomId = roomId;
        this._contextMenuRoomType = roomType;
        this._contextMenuIsOwner = isOwner;
        
        const menu = document.getElementById('chat-context-menu');
        const leaveItem = document.getElementById('ctx-menu-leave');
        const deleteItem = document.getElementById('ctx-menu-delete');
        const leaveText = document.getElementById('ctx-menu-leave-text');
        const deleteText = document.getElementById('ctx-menu-delete-text');
        
        if (roomType === 'private') {
            leaveItem.style.display = 'none';
            deleteItem.style.display = 'flex';
            deleteText.textContent = '删除对话';
        } else {
            leaveItem.style.display = 'flex';
            if (isOwner) {
                leaveText.textContent = '解散群聊';
                deleteItem.style.display = 'flex';
                deleteText.textContent = '删除群聊';
            } else {
                leaveText.textContent = '退出群聊';
                deleteItem.style.display = 'none';
            }
        }
        
        const rect = event.currentTarget.getBoundingClientRect();
        menu.style.left = `${rect.left}px`;
        menu.style.top = `${rect.bottom + 5}px`;
        menu.style.display = 'block';
        
        setTimeout(() => {
            document.addEventListener('click', this._hideContextMenuHandler = (e) => {
                if (!menu.contains(e.target)) {
                    this.hideContextMenu();
                }
            });
        }, 0);
    }

    hideContextMenu() {
        const menu = document.getElementById('chat-context-menu');
        if (menu) {
            menu.style.display = 'none';
        }
        if (this._hideContextMenuHandler) {
            document.removeEventListener('click', this._hideContextMenuHandler);
            this._hideContextMenuHandler = null;
        }
    }

    async handleContextMenuAction(action) {
        const roomId = this._contextMenuRoomId;
        const roomType = this._contextMenuRoomType;
        const isOwner = this._contextMenuIsOwner;
        
        this.hideContextMenu();
        
        if (!roomId) return;
        
        try {
            if (action === 'leave') {
                if (roomType === 'group') {
                    const confirmMsg = isOwner 
                        ? '确定要解散该群聊吗？所有成员将被移除，聊天记录将被删除。'
                        : '确定要退出该群聊吗？';
                    
                    if (!confirm(confirmMsg)) return;
                    
                    if (isOwner) {
                        await chatClient.deleteRoom(roomId);
                        showToast('群聊已解散', 'success');
                    } else {
                        await chatClient.leaveRoom(roomId);
                        showToast('已退出群聊', 'success');
                    }
                }
            } else if (action === 'delete') {
                let confirmMsg = '';
                if (roomType === 'private') {
                    confirmMsg = '确定要删除该对话吗？聊天记录将被删除。';
                } else if (isOwner) {
                    confirmMsg = '确定要删除该群聊吗？所有成员将被移除，聊天记录将被删除。';
                }
                
                if (!confirm(confirmMsg)) return;
                
                await chatClient.deleteRoom(roomId);
                showToast(roomType === 'private' ? '对话已删除' : '群聊已删除', 'success');
            }
            
            if (this.currentRoomId === roomId) {
                this.currentRoomId = null;
                document.getElementById('chat-empty-state').style.display = 'flex';
                document.getElementById('chat-window').style.display = 'none';
                navigate('chat');
            }
            
            await this.loadChatRooms();
            chatClient.updateUnreadCount();
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    showCreateUserModal() {
        let modal = document.getElementById('create-user-modal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'create-user-modal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>添加新用户</h3>
                        <button class="modal-close" onclick="hideCreateUserModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="create-user-form">
                            <div class="form-group">
                                <label>用户名 *</label>
                                <input type="text" name="username" required minlength="3" placeholder="输入用户名">
                            </div>
                            <div class="form-group">
                                <label>邮箱 *</label>
                                <input type="email" name="email" required placeholder="输入邮箱">
                            </div>
                            <div class="form-group">
                                <label>密码 *</label>
                                <input type="password" name="password" required minlength="6" placeholder="输入密码（至少6位）">
                            </div>
                            <div class="form-group">
                                <label>角色</label>
                                <select name="role">
                                    <option value="user">普通用户</option>
                                    <option value="admin">管理员</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>个人简介</label>
                                <textarea name="bio" placeholder="介绍一下该用户..."></textarea>
                            </div>
                            <div class="form-group">
                                <label>技能标签（用逗号分隔）</label>
                                <input type="text" name="skills" placeholder="例如：Unity, 2D美术, 音效设计">
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="hideCreateUserModal()">取消</button>
                        <button class="btn btn-primary" onclick="confirmCreateUser()">确认添加</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        }
        
        document.getElementById('create-user-form').reset();
        modal.style.display = 'flex';
    }

    hideCreateUserModal() {
        const modal = document.getElementById('create-user-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async confirmCreateUser() {
        const form = document.getElementById('create-user-form');
        const formData = new FormData(form);
        
        const username = formData.get('username');
        const email = formData.get('email');
        const password = formData.get('password');
        const role = formData.get('role');
        const bio = formData.get('bio');
        const skills = formData.get('skills');
        
        if (!username || !email || !password) {
            showToast('请填写所有必填字段', 'error');
            return;
        }
        
        if (password.length < 6) {
            showToast('密码至少需要6位', 'error');
            return;
        }
        
        if (!confirm('确定要添加该用户吗？')) {
            return;
        }
        
        try {
            await api.post('/admin/users', {
                username,
                email,
                password,
                role,
                bio,
                skills
            });
            
            showToast('用户添加成功！', 'success');
            this.hideCreateUserModal();
            
            if (this.currentPage === 'admin') {
                this.loadAdminUsers();
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async exportUsers(format) {
        const search = document.getElementById('admin-user-search')?.value || '';
        const role = document.getElementById('admin-user-role')?.value || '';
        const status = document.getElementById('admin-user-status')?.value || '';
        
        try {
            let url = `/admin/users/export/${format}`;
            const params = [];
            if (search) params.push(`search=${encodeURIComponent(search)}`);
            if (role) params.push(`role=${role}`);
            if (status) params.push(`status=${status}`);
            if (params.length > 0) {
                url += '?' + params.join('&');
            }
            
            await api.download(url);
            showToast(`${format.toUpperCase()} 导出成功！`, 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async renderProjects(container) {
        if (!auth.isLoggedIn()) {
            navigate('login');
            return;
        }

        container.innerHTML = `
            <div class="page-header">
                <h1>我的项目</h1>
                <button class="btn btn-primary" onclick="app.showCreateProjectModal()">+ 创建项目</button>
            </div>
            <div id="projects-grid" class="projects-grid">
                <div class="loading"><div class="spinner"></div></div>
            </div>
            
            <div id="create-project-modal" class="modal" style="display: none;">
                <div class="modal-content">
                    <div class="modal-header">
                        <h3>创建新项目</h3>
                        <button class="modal-close" onclick="app.hideCreateProjectModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="form-group">
                            <label>项目名称 *</label>
                            <input type="text" id="new-project-name" placeholder="输入项目名称" maxlength="100">
                        </div>
                        <div class="form-group">
                            <label>项目描述</label>
                            <textarea id="new-project-desc" placeholder="简单介绍一下你的项目..." rows="3"></textarea>
                        </div>
                        <div class="form-group">
                            <label>邀请成员</label>
                            <div id="project-user-select-list" class="user-select-list">
                                <div class="loading"><div class="spinner"></div></div>
                            </div>
                        </div>
                        <div class="project-channels-preview">
                            <h4 style="margin-bottom: 0.75rem; font-size: 0.9rem; color: var(--text-secondary);">项目将自动创建以下频道：</h4>
                            <div class="channels-preview-list">
                                <div class="channel-preview-item">
                                    <span class="channel-icon">📋</span>
                                    <span>策划闲聊</span>
                                </div>
                                <div class="channel-preview-item">
                                    <span class="channel-icon">💻</span>
                                    <span>程序对接</span>
                                </div>
                                <div class="channel-preview-item">
                                    <span class="channel-icon">🎨</span>
                                    <span>美术需求</span>
                                </div>
                                <div class="channel-preview-item">
                                    <span class="channel-icon">🐛</span>
                                    <span>BUG反馈</span>
                                </div>
                                <div class="channel-preview-item">
                                    <span class="channel-icon">💡</span>
                                    <span>临时脑洞</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="app.hideCreateProjectModal()">取消</button>
                        <button class="btn btn-primary" onclick="app.createProject()">创建项目</button>
                    </div>
                </div>
            </div>
        `;

        await this.loadProjects();
    }

    async loadProjects() {
        const grid = document.getElementById('projects-grid');
        if (!grid) return;

        try {
            const result = await api.get('/projects');
            const projects = result.projects;

            if (projects.length === 0) {
                grid.innerHTML = `
                    <div class="empty-state" style="grid-column: 1 / -1;">
                        <div class="empty-state-icon">📁</div>
                        <h3>还没有项目</h3>
                        <p>创建你的第一个项目，开始团队协作吧！</p>
                        <button class="btn btn-primary" onclick="app.showCreateProjectModal()" style="margin-top: 1rem;">+ 创建项目</button>
                    </div>
                `;
                return;
            }

            grid.innerHTML = projects.map(project => this.renderProjectCard(project)).join('');
        } catch (error) {
            grid.innerHTML = `<div class="empty-state"><p>加载失败，请刷新重试</p></div>`;
        }
    }

    renderProjectCard(project) {
        const channelIcons = ['📋', '💻', '🎨', '🐛', '💡'];
        
        return `
            <div class="project-card" onclick="navigate('project/${project.id}')">
                <div class="project-card-header">
                    <div class="project-icon">🎮</div>
                    <div class="project-info">
                        <h3 class="project-name">${escapeHtml(project.name)}</h3>
                        <p class="project-desc">${escapeHtml(project.description || '暂无描述')}</p>
                    </div>
                </div>
                <div class="project-card-footer">
                    <div class="project-channels">
                        ${channelIcons.map(icon => `<span class="channel-mini-icon">${icon}</span>`).join('')}
                    </div>
                    <div class="project-members-count">
                        👥 ${project.members_count} 人
                    </div>
                </div>
            </div>
        `;
    }

    async showCreateProjectModal() {
        document.getElementById('create-project-modal').style.display = 'flex';
        
        try {
            const result = await api.get('/profile/list?per_page=100');
            const users = result.users.filter(u => u.id !== auth.currentUser.id);
            
            const container = document.getElementById('project-user-select-list');
            if (users.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 1rem;">暂无其他用户</p>';
            } else {
                container.innerHTML = users.map(user => {
                    const avatar = user.avatar && user.avatar !== 'default.png'
                        ? user.avatar
                        : `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=6366f1&color=fff`;
                    
                    return `
                        <label class="user-select-item">
                            <input type="checkbox" value="${user.id}" class="project-user-checkbox">
                            <img src="${avatar}" alt="${escapeHtml(user.username)}">
                            <span>${escapeHtml(user.username)}</span>
                        </label>
                    `;
                }).join('');
            }
        } catch (error) {
            document.getElementById('project-user-select-list').innerHTML = '<p>加载用户列表失败</p>';
        }
    }

    hideCreateProjectModal() {
        document.getElementById('create-project-modal').style.display = 'none';
    }

    async createProject() {
        const name = document.getElementById('new-project-name').value.trim();
        const description = document.getElementById('new-project-desc').value.trim();
        
        if (!name) {
            showToast('请输入项目名称', 'error');
            return;
        }

        const memberCheckboxes = document.querySelectorAll('.project-user-checkbox:checked');
        const member_ids = Array.from(memberCheckboxes).map(cb => parseInt(cb.value));

        try {
            const result = await api.post('/projects', {
                name,
                description,
                member_ids
            });
            
            showToast('项目创建成功！', 'success');
            this.hideCreateProjectModal();
            navigate(`project/${result.project.id}`);
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async renderProjectDetail(container, projectId) {
        if (!auth.isLoggedIn()) {
            navigate('login');
            return;
        }

        this.currentProjectId = projectId ? parseInt(projectId) : null;
        this.currentChannelId = null;
        this.projectChatMessages = [];

        container.innerHTML = `
            <div class="project-detail-layout">
                <div class="project-sidebar">
                    <div class="project-sidebar-header">
                        <button class="btn btn-outline btn-sm" onclick="navigate('projects')">← 返回</button>
                    </div>
                    <div class="project-info-section" id="project-info-section">
                        <div class="loading"><div class="spinner"></div></div>
                    </div>
                    <div class="project-channels-section">
                        <h4 class="section-title">项目频道</h4>
                        <div class="project-channels-list" id="project-channels-list">
                            <div class="loading"><div class="spinner"></div></div>
                        </div>
                    </div>
                </div>
                <div class="project-main-content">
                    <div class="project-chat-empty" id="project-chat-empty">
                        <div class="empty-state-icon">💬</div>
                        <h3>选择一个频道开始聊天</h3>
                        <p>每个项目都有5个固定频道，按主题分类讨论</p>
                    </div>
                    <div class="project-chat-window" id="project-chat-window" style="display: none;">
                        <div class="chat-header" id="project-chat-header"></div>
                        <div class="chat-messages" id="project-chat-messages"></div>
                        <div class="chat-input-area">
                            <div id="project-typing-indicator" class="typing-indicator" style="display: none;"></div>
                            <div class="chat-input-wrapper">
                                <textarea id="project-chat-input" placeholder="输入消息..." onkeydown="app.handleProjectChatInputKeydown(event)"></textarea>
                                <button class="btn btn-primary" onclick="app.sendProjectChatMessage()">发送</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        await this.loadProjectDetail(projectId);
    }

    async loadProjectDetail(projectId) {
        try {
            const result = await api.get(`/projects/${projectId}`);
            const project = result.project;
            this.currentProject = project;
            this.projectChannels = project.channels || [];

            this.renderProjectInfo(project);
            this.renderProjectChannels();

            if (this.projectChannels.length > 0) {
                await this.openProjectChannel(this.projectChannels[0].id);
            }
        } catch (error) {
            showToast(error.message, 'error');
            navigate('projects');
        }
    }

    renderProjectInfo(project) {
        const section = document.getElementById('project-info-section');
        if (!section) return;

        const isOwner = project.role === 'owner';

        section.innerHTML = `
            <div class="project-detail-info">
                <div class="project-detail-icon">🎮</div>
                <h2 class="project-detail-name">${escapeHtml(project.name)}</h2>
                <p class="project-detail-desc">${escapeHtml(project.description || '暂无描述')}</p>
                <div class="project-detail-meta">
                    <span>👥 ${project.members_count} 人</span>
                    <span class="project-role-badge ${project.role}">${project.role === 'owner' ? '所有者' : project.role === 'admin' ? '管理员' : '成员'}</span>
                </div>
            </div>
        `;
    }

    renderProjectChannels() {
        const list = document.getElementById('project-channels-list');
        if (!list || !this.projectChannels) return;

        list.innerHTML = this.projectChannels.map(channel => {
            const isActive = this.currentChannelId === channel.id;
            const lastMessage = channel.last_message;
            const unreadCount = 0;

            return `
                <div class="project-channel-item ${isActive ? 'active' : ''}" onclick="app.openProjectChannel(${channel.id})">
                    <span class="channel-icon">${channel.channel_icon || '💬'}</span>
                    <div class="channel-info">
                        <span class="channel-name">${escapeHtml(channel.channel_name || channel.name)}</span>
                        ${lastMessage ? `<span class="channel-preview">${escapeHtml(lastMessage.content?.substring(0, 20) || '')}</span>` : ''}
                    </div>
                    ${unreadCount > 0 ? `<span class="unread-badge">${unreadCount}</span>` : ''}
                </div>
            `;
        }).join('');
    }

    async openProjectChannel(channelId) {
        this.currentChannelId = channelId;
        chatClient.joinRoom(channelId);

        document.getElementById('project-chat-empty').style.display = 'none';
        document.getElementById('project-chat-window').style.display = 'flex';

        const channel = this.projectChannels.find(c => c.id === channelId);
        if (channel) {
            const header = document.getElementById('project-chat-header');
            header.innerHTML = `
                <div class="chat-room-avatar">
                    <span class="group-avatar">${channel.channel_icon || '💬'}</span>
                </div>
                <div class="chat-room-info">
                    <span class="chat-room-name">${escapeHtml(channel.channel_name || channel.name)}</span>
                    <span class="chat-room-type">项目频道 · ${channel.members_count}人</span>
                </div>
            `;
        }

        this.renderProjectChannels();
        await this.loadProjectChatMessages(channelId);
        
        chatClient.markAsRead(channelId);
        chatClient.updateUnreadCount();
    }

    async loadProjectChatMessages(roomId) {
        const container = document.getElementById('project-chat-messages');
        if (!container) return;

        try {
            const result = await chatClient.getMessages(roomId);
            this.projectChatMessages = result.messages;
            this.renderProjectChatMessages();
        } catch (error) {
            console.error('Failed to load messages:', error);
        }
    }

    renderProjectChatMessages() {
        const container = document.getElementById('project-chat-messages');
        if (!container) return;

        if (this.projectChatMessages.length === 0) {
            container.innerHTML = `
                <div class="empty-state" style="padding: 2rem;">
                    <div class="empty-state-icon">💬</div>
                    <p>还没有消息，发送第一条消息吧！</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.projectChatMessages.map(msg => this.renderChatMessage(msg)).join('');
        container.scrollTop = container.scrollHeight;
    }

    appendProjectChatMessage(message) {
        if (message.room_id !== this.currentChannelId) return;
        
        this.projectChatMessages.push(message);
        const container = document.getElementById('project-chat-messages');
        if (container) {
            container.insertAdjacentHTML('beforeend', this.renderChatMessage(message));
            container.scrollTop = container.scrollHeight;
        }
        
        chatClient.markAsRead(message.room_id);
    }

    handleProjectChatInputKeydown(event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            this.sendProjectChatMessage();
        }
        
        if (this.currentChannelId) {
            chatClient.sendTyping(this.currentChannelId, true);
        }
    }

    sendProjectChatMessage() {
        const input = document.getElementById('project-chat-input');
        const content = input?.value.trim();
        
        if (!content || !this.currentChannelId) return;
        
        chatClient.sendMessage(this.currentChannelId, content);
        input.value = '';
    }
}

function navigate(page) {
    if (page.startsWith('/')) {
        page = page.slice(1);
    }
    const newPath = '/' + page;
    if (window.location.pathname !== newPath) {
        window.history.pushState({}, '', newPath);
        app.handleRoute();
    }
    
    app.closeMobileMenu();
}

function logout() {
    chatClient.disconnect();
    auth.logout();
    app.updateNav();
    app.currentRoomId = null;
    showToast('已退出登录', 'success');
    navigate('home');
}

function toggleUserMenu() {
    document.getElementById('user-dropdown').classList.toggle('show');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
        document.getElementById('user-dropdown')?.classList.remove('show');
    }
    if (!e.target.closest('.dropdown')) {
        hideExportDropdown();
    }
});

async function toggleLike(ideaId) {
    try {
        const result = await api.post(`/ideas/${ideaId}/like`);
        const btn = document.getElementById('like-btn');
        if (result.liked) {
            btn.classList.remove('btn-outline');
            btn.classList.add('btn-danger');
            btn.innerHTML = `❤️ ${(parseInt(btn.textContent.match(/\d+/)?.[0] || '0') + 1)} 点赞`;
        } else {
            btn.classList.remove('btn-danger');
            btn.classList.add('btn-outline');
            btn.innerHTML = `🤍 ${(parseInt(btn.textContent.match(/\d+/)?.[0] || '1') - 1)} 点赞`;
        }
        showToast(result.message, 'success');
    } catch (error) {
        if (error.message.includes('登录') || error.message.includes('Authorization')) {
            navigate('login');
        } else {
            showToast(error.message, 'error');
        }
    }
}

async function addComment(ideaId, parentId = null, replyToUserId = null) {
    const inputId = parentId ? `reply-input-${parentId}` : 'comment-input';
    const input = document.getElementById(inputId);
    const content = input.value.trim();
    if (!content) {
        showToast('请输入评论内容', 'error');
        return;
    }

    try {
        const data = { content };
        if (parentId) {
            data.parent_id = parentId;
        }
        if (replyToUserId) {
            data.reply_to_user_id = replyToUserId;
        }
        await api.post(`/ideas/${ideaId}/comments`, data);
        showToast(parentId ? '回复发表成功！' : '评论发表成功！', 'success');
        app.render();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showReplyForm(commentId, ideaId, replyToUserId, replyToUsername) {
    document.querySelectorAll('[id^="reply-form-"]').forEach(form => {
        if (form.id !== `reply-form-${commentId}`) {
            form.style.display = 'none';
        }
    });

    const formContainer = document.getElementById(`reply-form-${commentId}`);
    if (formContainer.style.display === 'block') {
        formContainer.style.display = 'none';
        return;
    }

    formContainer.innerHTML = `
        <div class="reply-form">
            <div class="form-group">
                <textarea id="reply-input-${commentId}" placeholder="回复 @${escapeHtml(replyToUsername)}..."></textarea>
            </div>
            <div style="display: flex; gap: 0.5rem;">
                <button class="btn btn-primary btn-sm" onclick="addComment(${ideaId}, ${commentId}, ${replyToUserId})">发表回复</button>
                <button class="btn btn-outline btn-sm" onclick="hideReplyForm(${commentId})">取消</button>
            </div>
        </div>
    `;
    formContainer.style.display = 'block';
    document.getElementById(`reply-input-${commentId}`).focus();
}

function hideReplyForm(commentId) {
    const formContainer = document.getElementById(`reply-form-${commentId}`);
    formContainer.style.display = 'none';
}

async function deleteComment(commentId) {
    if (!confirm('确定要删除这条评论吗？')) return;
    try {
        await api.delete(`/ideas/comments/${commentId}`);
        showToast('评论删除成功！', 'success');
        app.render();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteIdea(ideaId) {
    if (!confirm('确定要删除这个灵感吗？此操作不可撤销。')) return;
    try {
        await api.delete(`/ideas/${ideaId}`);
        showToast('灵感删除成功！', 'success');
        navigate('ideas');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function adminToggleUserStatus(userId, currentStatus) {
    if (!confirm(`确定要${currentStatus ? '禁用' : '启用'}该用户吗？`)) return;
    try {
        await api.put(`/admin/users/${userId}`, { is_active: !currentStatus });
        showToast('用户状态更新成功！', 'success');
        app.loadAdminUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function adminToggleUserRole(userId, currentRole) {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`确定要将该用户${newRole === 'admin' ? '设为管理员' : '降为普通用户'}吗？`)) return;
    try {
        await api.put(`/admin/users/${userId}`, { role: newRole });
        showToast('用户角色更新成功！', 'success');
        app.loadAdminUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function adminDeleteUser(userId) {
    if (!confirm('确定要删除该用户吗？此操作不可撤销。')) return;
    try {
        await api.delete(`/admin/users/${userId}`);
        showToast('用户删除成功！', 'success');
        app.loadAdminUsers();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function adminDeleteIdea(ideaId) {
    if (!confirm('确定要删除这个灵感吗？可在"仅显示已删除"中恢复。')) return;
    try {
        await api.delete(`/admin/ideas/${ideaId}`);
        showToast('灵感删除成功！', 'success');
        app.loadAdminIdeas();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function adminRestoreIdea(ideaId) {
    if (!confirm('确定要恢复这个灵感吗？')) return;
    try {
        await api.post(`/admin/ideas/${ideaId}/restore`);
        showToast('灵感恢复成功！', 'success');
        app.loadAdminIdeas();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function adminPermanentDeleteIdea(ideaId, title) {
    if (!confirm(`确定要彻底删除 "${title}" 吗？此操作不可恢复！`)) return;
    try {
        await api.delete(`/admin/ideas/${ideaId}/permanent`);
        showToast('灵感已彻底删除', 'success');
        app.loadAdminIdeas();
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function showResetPasswordModal(userId, username) {
    app.showResetPasswordModal(userId, username);
}

function hideResetPasswordModal() {
    app.hideResetPasswordModal();
}

async function confirmResetPassword() {
    await app.confirmResetPassword();
}

function showCreateUserModal() {
    app.showCreateUserModal();
}

function hideCreateUserModal() {
    app.hideCreateUserModal();
}

async function confirmCreateUser() {
    await app.confirmCreateUser();
}

async function exportUsers(format) {
    await app.exportUsers(format);
}

function toggleExportDropdown() {
    const dropdown = document.getElementById('export-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

function hideExportDropdown() {
    const dropdown = document.getElementById('export-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
}

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    if (!dateString) return '';
    
    let date;
    try {
        date = new Date(dateString);
        if (isNaN(date.getTime())) {
            const cleanDate = dateString.replace(' ', 'T');
            date = new Date(cleanDate);
        }
    } catch (e) {
        date = new Date();
    }
    
    const now = new Date();
    const diff = now - date;
    
    if (diff < 0) return '刚刚';
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}天前`;
    
    return date.toLocaleString('zh-CN', {
        month: 'numeric',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function startPrivateChat(userId) {
    if (!auth.isLoggedIn()) {
        navigate('login');
        return;
    }
    
    try {
        const room = await chatClient.createPrivateRoom(userId);
        if (room) {
            navigate(`chat/${room.id}`);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function startPrivateChatFromRoom(userId) {
    app.hideRoomMembersModal();
    await startPrivateChat(userId);
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

window.addEventListener('popstate', () => app.handleRoute());

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new App();

    const hamburger = document.getElementById('hamburger');
    const navOverlay = document.getElementById('nav-overlay');
    if (hamburger) {
        hamburger.addEventListener('click', () => app.toggleMobileMenu());
    }
    if (navOverlay) {
        navOverlay.addEventListener('click', () => app.closeMobileMenu());
    }
});
