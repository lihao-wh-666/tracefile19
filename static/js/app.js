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
        const navCalendar = document.getElementById('nav-calendar');
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
            navCalendar.style.display = 'block';
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
            navCalendar.style.display = 'none';
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
        let queryParams = {};
        
        const hash = window.location.hash;
        if (hash && hash.startsWith('#/')) {
            const hashPath = hash.slice(2);
            const [pathPart, queryPart] = hashPath.split('?');
            path = '/' + pathPart;
            
            if (queryPart) {
                queryParams = Object.fromEntries(
                    queryPart.split('&').map(pair => pair.split('='))
                );
            }
        }
        
        if (path === '/' || path === '') {
            path = '/home';
        }
        if (path.startsWith('/')) {
            path = path.slice(1);
        }
        const [page, ...params] = path.split('/');
        this.currentPage = page || 'home';
        this.currentParams = { id: params[0], ...queryParams };
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
            case 'calendar':
                this.renderCalendar(main);
                break;
            case 'chat':
                this.renderChat(main, this.currentParams.id);
                break;
            case 'admin':
                this.renderAdmin(main);
                break;
            case 'oauth-callback':
                this.renderOAuthCallback(main);
                break;
            default:
                this.renderHome(main);
        }
    }

    renderOAuthCallback(container) {
        const params = this.currentParams;
        const success = params.success === 'true';
        const error = params.error ? decodeURIComponent(params.error) : null;
        const token = params.token || null;
        const code = params.code || null;

        container.innerHTML = `
            <div class="auth-container" style="text-align: center;">
                <div class="auth-header">
                    ${success ? '<div style="font-size: 4rem; margin-bottom: 1rem;">✅</div>' : '<div style="font-size: 4rem; margin-bottom: 1rem;">❌</div>'}
                    <h1>${success ? '授权成功' : '授权失败'}</h1>
                    <p>${success ? '正在处理登录信息...' : (error || '授权过程中出现错误')}</p>
                </div>
                <div class="loading" style="margin: 2rem 0;">
                    ${success ? '<div class="spinner"></div>' : ''}
                </div>
                <p style="color: var(--text-muted); font-size: 0.875rem;">
                    窗口将自动关闭...
                </p>
            </div>
        `;

        if (success && window.opener && !window.opener.closed) {
            if (window.opener._handleOAuthCallback) {
                window.opener._handleOAuthCallback({
                    success: true,
                    token: token,
                    user_id: params.user_id,
                    username: decodeURIComponent(params.username || ''),
                    avatar: decodeURIComponent(params.avatar || ''),
                });
                setTimeout(() => window.close(), 500);
                return;
            }
            
            if (window.opener._handleLinkCallback) {
                window.opener._handleLinkCallback({
                    success: true,
                    code: code,
                });
                setTimeout(() => window.close(), 500);
                return;
            }
        }

        if (success && token) {
            api.setToken(token);
            auth.currentUser = {
                id: params.user_id,
                username: decodeURIComponent(params.username || ''),
                avatar: decodeURIComponent(params.avatar || ''),
            };
            setTimeout(() => {
                navigate('home');
            }, 1000);
        }

        if (!success) {
            setTimeout(() => {
                if (window.opener && !window.opener.closed) {
                    if (window.opener._handleOAuthCallback) {
                        window.opener._handleOAuthCallback({
                            success: false,
                            error: error
                        });
                    }
                    if (window.opener._handleLinkCallback) {
                        window.opener._handleLinkCallback({
                            success: false,
                            error: error
                        });
                    }
                    window.close();
                } else {
                    navigate('login');
                }
            }, 2000);
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
                
                <div class="auth-tabs">
                    <button class="auth-tab active" data-tab="password">密码登录</button>
                    <button class="auth-tab" data-tab="email">邮箱验证码</button>
                </div>
                
                <div class="auth-tab-content">
                    <form id="login-form" class="auth-tab-pane active" data-pane="password">
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
                    
                    <form id="email-login-form" class="auth-tab-pane" data-pane="email" style="display: none;">
                        <div class="form-group">
                            <label>邮箱</label>
                            <input type="email" name="email" required placeholder="your@email.com" id="email-login-email">
                        </div>
                        <div class="form-group">
                            <label>验证码</label>
                            <div class="code-input-group">
                                <input type="text" name="code" required placeholder="请输入验证码" maxlength="6" id="email-login-code">
                                <button type="button" class="btn btn-outline btn-code" id="send-code-btn">发送验证码</button>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">登录 / 注册</button>
                    </form>
                </div>
                
                <div class="auth-divider">
                    <span>或使用以下方式登录</span>
                </div>
                
                <div class="social-login" id="social-login-buttons">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
                
                <div class="form-footer">
                    还没有账号？<a href="javascript:void(0)" onclick="navigate('register')">立即注册</a>
                </div>
            </div>
        `;

        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.auth-tab-pane').forEach(p => p.style.display = 'none');
                document.querySelector(`[data-pane="${tab.dataset.tab}"]`).style.display = 'block';
            });
        });

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

        let codeCountdown = 0;
        const sendCodeBtn = document.getElementById('send-code-btn');
        sendCodeBtn.addEventListener('click', async () => {
            const email = document.getElementById('email-login-email').value;
            if (!email) {
                showToast('请先输入邮箱', 'error');
                return;
            }
            if (codeCountdown > 0) return;
            
            try {
                await auth.sendEmailCode(email, 'login');
                showToast('验证码已发送，请查收邮箱', 'success');
                codeCountdown = 60;
                const updateBtn = () => {
                    if (codeCountdown > 0) {
                        sendCodeBtn.textContent = `${codeCountdown}秒后重发`;
                        sendCodeBtn.disabled = true;
                        codeCountdown--;
                        setTimeout(updateBtn, 1000);
                    } else {
                        sendCodeBtn.textContent = '发送验证码';
                        sendCodeBtn.disabled = false;
                    }
                };
                updateBtn();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });

        document.getElementById('email-login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email-login-email').value;
            const code = document.getElementById('email-login-code').value;
            
            try {
                const result = await auth.loginWithEmail(email, code);
                showToast(result.user ? '登录成功！' : '注册成功！', 'success');
                this.updateNav();
                this.initChat();
                navigate('home');
            } catch (error) {
                showToast(error.message, 'error');
            }
        });

        this._loadSocialLoginButtons();
    }

    async _loadSocialLoginButtons() {
        try {
            const providers = await auth.getOAuthProviders();
            const container = document.getElementById('social-login-buttons');
            if (!container) return;
            
            if (providers.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">暂无第三方登录方式</p>';
                return;
            }
            
            container.innerHTML = providers.map(p => `
                <button class="btn btn-social btn-${p.provider}" onclick="app.socialLogin('${p.provider}')">
                    <span class="social-icon">${p.icon}</span>
                    <span>${p.name}登录</span>
                </button>
            `).join('');
        } catch (error) {
            console.error('加载第三方登录方式失败:', error);
        }
    }

    async socialLogin(provider) {
        try {
            showToast(`正在跳转到${provider === 'github' ? 'GitHub' : provider === 'qq' ? 'QQ' : '邮箱'}授权页面...`, 'info');
            await auth.loginWithOAuth(provider);
            showToast('登录成功！', 'success');
            this.updateNav();
            this.initChat();
            navigate('home');
        } catch (error) {
            showToast(error.message, 'error');
        }
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
                
                <div class="auth-divider">
                    <span>或使用以下方式快速注册</span>
                </div>
                
                <div class="social-login" id="register-social-buttons">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
                
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

        this._loadRegisterSocialButtons();
    }

    async _loadRegisterSocialButtons() {
        try {
            const providers = await auth.getOAuthProviders();
            const container = document.getElementById('register-social-buttons');
            if (!container) return;
            
            const oauthProviders = providers.filter(p => p.provider !== 'email');
            
            if (oauthProviders.length === 0) {
                container.innerHTML = '<p style="color: var(--text-muted); text-align: center;">暂无第三方注册方式</p>';
                return;
            }
            
            container.innerHTML = oauthProviders.map(p => `
                <button class="btn btn-social btn-${p.provider}" onclick="app.socialLogin('${p.provider}')">
                    <span class="social-icon">${p.icon}</span>
                    <span>${p.name}快速注册</span>
                </button>
            `).join('');
        } catch (error) {
            console.error('加载第三方注册方式失败:', error);
        }
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
                    <p class="idea-description">${escapeHtml(getContentPreview(idea.content, 100))}</p>
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
                            ${idea.attachments_count > 0 ? `<span class="stat">📎 ${idea.attachments_count}</span>` : ''}
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
                        ${renderContentWithImages(idea.content)}
                    </div>
                    ${idea.attachments && idea.attachments.length > 0 ? `
                        <div class="idea-attachments">
                        <h3 style="margin-bottom: 1rem;">📎 附件 (${idea.attachments.length})</h3>
                        <div class="attachments-list">
                            ${idea.attachments.map(att => renderAttachmentItem(att, isOwner)).join('')}
                        </div>
                    </div>
                    ` : ''}
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
                        <div class="editor-toolbar">
                            <button type="button" class="toolbar-btn" onclick="toggleEmojiPicker('idea-content', 'emoji-picker-create')" title="插入表情">
                                😀 表情
                            </button>
                            <button type="button" class="toolbar-btn" onclick="triggerImageUpload('idea-image-input')" title="上传图片">
                                🖼️ 图片
                            </button>
                            <input type="file" id="idea-image-input" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp" style="display:none;" onchange="handleImageUpload(event, 'idea-content')">
                        </div>
                        <div class="emoji-picker" id="emoji-picker-create">
                            ${EMOJI_LIST.map(emoji => `<span class="emoji-item" onclick="insertEmoji('idea-content', '${emoji}')">${emoji}</span>`).join('')}
                        </div>
                        <textarea id="idea-content" name="content" required placeholder="详细描述你的灵感..."></textarea>
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
                    <div class="form-group">
                        <label style="display: block; margin-bottom: 0.5rem;">💡 提示</label>
                        <div style="padding: 0.75rem; background: var(--bg-secondary); border-radius: 8px; font-size: 0.9rem; color: var(--text-muted);">
                            发布灵感后，您可以在编辑页面添加附件（支持 PDF、Word、Excel、PPT、图片等格式）
                        </div>
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
                            <div class="editor-toolbar">
                                <button type="button" class="toolbar-btn" onclick="toggleEmojiPicker('edit-idea-content', 'emoji-picker-edit')" title="插入表情">
                                    😀 表情
                                </button>
                                <button type="button" class="toolbar-btn" onclick="triggerImageUpload('edit-idea-image-input')" title="上传图片">
                                    🖼️ 图片
                                </button>
                                <input type="file" id="edit-idea-image-input" accept="image/png,image/jpeg,image/jpg,image/gif,image/webp" style="display:none;" onchange="handleImageUpload(event, 'edit-idea-content')">
                            </div>
                            <div class="emoji-picker" id="emoji-picker-edit">
                                ${EMOJI_LIST.map(emoji => `<span class="emoji-item" onclick="insertEmoji('edit-idea-content', '${emoji}')">${emoji}</span>`).join('')}
                            </div>
                            <textarea id="edit-idea-content" name="content" required>${escapeHtml(idea.content)}</textarea>
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
                        <div class="form-group">
                            <label>📎 附件</label>
                            <div class="attachment-upload-area" id="attachment-upload-area">
                                <div class="attachment-upload-hint" onclick="triggerAttachmentUpload('edit-attachment-input')">
                                    <div style="font-size: 2rem; margin-bottom: 0.5rem;">📁</div>
                                    <div>点击或拖拽文件到此处上传附件</div>
                                    <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 0.5rem;">
                                        支持 PDF、Word、Excel、PPT、TXT、图片等格式
                                    </div>
                                </div>
                                <input type="file" id="edit-attachment-input" style="display:none;" multiple 
                                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.md,.png,.jpg,.jpeg,.gif,.webp"
                                    onchange="handleAttachmentUpload(event, ${id})">
                            </div>
                            <div id="attachments-list" class="attachments-list" style="margin-top: 1rem;">
                                <div class="loading"><div class="spinner"></div></div>
                            </div>
                        </div>
                        <button type="submit" class="btn btn-primary btn-block">保存修改</button>
                    </form>
                </div>
            `;

            this.loadAttachments(id);

            const uploadArea = document.getElementById('attachment-upload-area');
            if (uploadArea) {
                uploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    uploadArea.classList.add('drag-over');
                });
                uploadArea.addEventListener('dragleave', () => {
                    uploadArea.classList.remove('drag-over');
                });
                uploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    uploadArea.classList.remove('drag-over');
                    const files = e.dataTransfer.files;
                    for (let file of files) {
                        uploadIdeaAttachment(id, file, () => app.loadAttachments(id));
                    }
                });
            }

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

    async loadAttachments(ideaId) {
        try {
            const result = await api.get(`/ideas/${ideaId}/attachments`);
            const listContainer = document.getElementById('attachments-list');
            if (listContainer) {
                if (result.attachments.length === 0) {
                    listContainer.innerHTML = `
                        <div style="text-align: center; padding: 1rem; color: var(--text-muted); font-size: 0.9rem;">
                            暂无附件
                        </div>
                    `;
                } else {
                    listContainer.innerHTML = result.attachments.map(att => renderAttachmentItem(att, true)).join('');
                }
            }
        } catch (error) {
            console.error('Failed to load attachments:', error);
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
                        <button class="tab" data-tab="accounts">账号绑定</button>
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
                        <div id="tab-accounts" style="display: none;">
                            <div class="linked-accounts">
                                <h3>第三方账号绑定</h3>
                                <div id="linked-accounts-list">
                                    <div class="loading"><div class="spinner"></div></div>
                                </div>
                                <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--text-muted);">
                                    绑定第三方账号后，可以使用该账号快速登录，无需记住密码。
                                </p>
                            </div>
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

        const accountsTab = document.querySelector('[data-tab="accounts"]');
        if (accountsTab) {
            accountsTab.addEventListener('click', () => {
                this._loadLinkedAccounts();
            });
        }
    }

    async _loadLinkedAccounts() {
        try {
            const [accountsData, providersData] = await Promise.all([
                auth.getLinkedAccounts(),
                auth.getOAuthProviders()
            ]);

            const linkedAccounts = accountsData.accounts || [];
            const hasPassword = accountsData.has_password;
            const allProviders = providersData.filter(p => p.provider !== 'email');

            const container = document.getElementById('linked-accounts-list');
            if (!container) return;

            let html = '';
            
            allProviders.forEach(provider => {
                const linked = linkedAccounts.find(a => a.provider === provider.provider);
                const providerName = provider.provider === 'github' ? 'GitHub' : 'QQ';
                
                if (linked) {
                    html += `
                        <div class="account-item">
                            <div class="account-item-left">
                                <span class="account-icon">${provider.icon}</span>
                                <div class="account-info">
                                    <h4>${providerName}账号</h4>
                                    <p>已绑定 · 绑定时间: ${formatDate(linked.created_at)}</p>
                                </div>
                            </div>
                            <button class="btn btn-outline btn-sm" onclick="app.unlinkAccount('${provider.provider}')">
                                解绑
                            </button>
                        </div>
                    `;
                } else {
                    html += `
                        <button class="link-account-btn" onclick="app.linkAccount('${provider.provider}')">
                            <span class="account-icon">${provider.icon}</span>
                            <span>绑定${providerName}账号</span>
                        </button>
                    `;
                }
            });

            if (allProviders.length === 0) {
                html = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">暂无可绑定的第三方账号</p>';
            }

            container.innerHTML = html;
        } catch (error) {
            console.error('加载绑定账号失败:', error);
            const container = document.getElementById('linked-accounts-list');
            if (container) {
                container.innerHTML = '<p style="color: var(--danger-color); text-align: center;">加载失败，请刷新重试</p>';
            }
        }
    }

    async linkAccount(provider) {
        try {
            showToast(`正在跳转到${provider === 'github' ? 'GitHub' : 'QQ'}授权页面...`, 'info');
            
            const result = await api.get(`/auth/oauth/${provider}`);
            const authUrl = result.auth_url;
            
            const width = 600;
            const height = 700;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;
            
            const linkWindow = window.open(
                authUrl,
                'Link Account',
                `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
            );

            window._handleLinkCallback = async (data) => {
                if (linkWindow && !linkWindow.closed) {
                    linkWindow.close();
                }
                
                if (data.success && data.code) {
                    try {
                        await auth.linkAccount(provider, data.code);
                        showToast('绑定成功！', 'success');
                        this._loadLinkedAccounts();
                    } catch (error) {
                        showToast(error.message, 'error');
                    }
                } else {
                    showToast(data.error || '绑定失败', 'error');
                }
            };
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async unlinkAccount(provider) {
        if (!confirm(`确定要解绑${provider === 'github' ? 'GitHub' : 'QQ'}账号吗？解绑后将无法使用该账号登录。`)) {
            return;
        }
        
        try {
            await auth.unlinkAccount(provider);
            showToast('解绑成功！', 'success');
            this._loadLinkedAccounts();
        } catch (error) {
            showToast(error.message, 'error');
        }
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

    async renderCalendar(container) {
        if (!auth.isLoggedIn()) {
            navigate('login');
            return;
        }

        this.currentCalendarTab = 'calendar';

        container.innerHTML = `
            <div class="page-header">
                <h1>日程日历</h1>
                <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-primary" onclick="app.showCreateEventModal()">+ 新建日程</button>
                </div>
            </div>

            <div class="calendar-tabs">
                <div class="calendar-tab active" data-tab="calendar" onclick="app.switchCalendarTab('calendar')">📅 日历视图</div>
                <div class="calendar-tab" data-tab="meetings" onclick="app.switchCalendarTab('meetings')">📋 项目例会</div>
                <div class="calendar-tab" data-tab="deliveries" onclick="app.switchCalendarTab('deliveries')">📦 交付截止</div>
            </div>

            <div class="filters">
                <div class="filter-group">
                    <label>搜索</label>
                    <input type="text" id="calendar-search" placeholder="搜索日程..." oninput="debounce(() => app.searchCalendarEvents(), 300)()">
                </div>
                <div class="filter-group">
                    <label>项目</label>
                    <select id="calendar-project-filter" onchange="app.filterCalendar()">
                        <option value="">全部项目</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>类型</label>
                    <select id="calendar-type-filter" onchange="app.filterCalendar()">
                        <option value="">全部类型</option>
                        <option value="meeting">项目例会</option>
                        <option value="delivery">交付任务</option>
                        <option value="general">普通日程</option>
                    </select>
                </div>
                <div class="filter-group">
                    <label>资源类型</label>
                    <select id="calendar-resource-filter" onchange="app.filterCalendar()">
                        <option value="">全部资源</option>
                        <option value="art">美术资源</option>
                        <option value="code">程序代码</option>
                        <option value="document">文档</option>
                        <option value="sound">音效音乐</option>
                        <option value="general">其他</option>
                    </select>
                </div>
            </div>

            <div id="calendar-stats" class="calendar-stats">
                <div class="loading"><div class="spinner"></div></div>
            </div>

            <div id="calendar-container"></div>

            <div id="event-modal" class="modal" style="display: none;">
                <div class="modal-content" style="max-width: 600px;">
                    <div class="modal-header">
                        <h3 id="event-modal-title">新建日程</h3>
                        <button class="modal-close" onclick="app.hideEventModal()">&times;</button>
                    </div>
                    <div class="modal-body">
                        <form id="event-form">
                            <div class="form-group">
                                <label>标题 *</label>
                                <input type="text" name="title" required maxlength="200" placeholder="日程标题">
                            </div>
                            <div class="form-group">
                                <label>类型</label>
                                <select name="event_type" id="event-type-select" onchange="app.updateEventTypeOptions()">
                                    <option value="general">普通日程</option>
                                    <option value="meeting">项目例会</option>
                                    <option value="delivery">交付任务</option>
                                </select>
                            </div>
                            <div class="form-group" id="event-project-group">
                                <label>关联项目</label>
                                <select name="project_id" id="event-project-select">
                                    <option value="">不关联</option>
                                </select>
                            </div>
                            <div class="form-group" id="event-start-group">
                                <label>开始时间 *</label>
                                <input type="datetime-local" name="start_time" required>
                            </div>
                            <div class="form-group" id="event-end-group">
                                <label>结束时间 *</label>
                                <input type="datetime-local" name="end_time" required>
                            </div>
                            <div class="form-group">
                                <label>地点/会议室</label>
                                <input type="text" name="location" placeholder="例如：会议室A / 腾讯会议">
                            </div>
                            <div class="form-group">
                                <label>会议链接</label>
                                <input type="url" name="meeting_link" placeholder="https://...">
                            </div>
                            <div class="form-group">
                                <label>颜色标记</label>
                                <select name="color">
                                    <option value="#6366f1">紫色（默认）</option>
                                    <option value="#8b5cf6">深紫</option>
                                    <option value="#ec4899">粉色</option>
                                    <option value="#06b6d4">青色</option>
                                    <option value="#10b981">绿色</option>
                                    <option value="#f59e0b">橙色</option>
                                    <option value="#ef4444">红色</option>
                                </select>
                            </div>
                            <div class="form-group">
                                <label>描述</label>
                                <textarea name="description" rows="3" placeholder="详细描述..."></textarea>
                            </div>
                            <div class="form-group" id="meeting-options-group" style="display: none;">
                                <label>
                                    <input type="checkbox" id="is-recurring-meeting" onchange="app.toggleRecurringOptions()">
                                    重复例会
                                </label>
                            </div>
                            <div id="recurring-options" style="display: none;">
                                <div class="form-group">
                                    <label>重复周期</label>
                                    <select name="recurrence_type" id="recurrence-type">
                                        <option value="weekly">每周</option>
                                        <option value="daily">每天</option>
                                        <option value="monthly">每月</option>
                                        <option value="once">单次</option>
                                    </select>
                                </div>
                                <div class="form-group" id="recurrence-day-group">
                                    <label>周几</label>
                                    <select name="recurrence_day" id="recurrence-day">
                                        <option value="1">周一</option>
                                        <option value="2">周二</option>
                                        <option value="3">周三</option>
                                        <option value="4">周四</option>
                                        <option value="5">周五</option>
                                        <option value="6">周六</option>
                                        <option value="0">周日</option>
                                    </select>
                                </div>
                                <div class="form-group">
                                    <label>开始日期</label>
                                    <input type="date" name="start_date" id="meeting-start-date">
                                </div>
                                <div class="form-group">
                                    <label>结束日期（可选）</label>
                                    <input type="date" name="end_date" id="meeting-end-date">
                                </div>
                            </div>
                        </form>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-outline" onclick="app.hideEventModal()">取消</button>
                        <button class="btn btn-primary" onclick="app.saveEvent()">保存</button>
                    </div>
                </div>
            </div>

            <div id="event-detail-modal" class="event-detail-modal" style="display: none;">
                <div class="event-detail-content">
                    <div class="event-detail-header">
                        <div>
                            <span class="event-type-badge" id="detail-event-type">普通日程</span>
                            <h3 id="detail-event-title"></h3>
                        </div>
                        <button class="modal-close" onclick="app.hideEventDetailModal()">&times;</button>
                    </div>
                    <div class="event-detail-body">
                        <div class="event-detail-item">
                            <div class="item-icon">⏰</div>
                            <div class="item-content">
                                <div class="item-label">时间</div>
                                <div id="detail-event-time"></div>
                            </div>
                        </div>
                        <div class="event-detail-item">
                            <div class="item-icon">📍</div>
                            <div class="item-content">
                                <div class="item-label">地点</div>
                                <div id="detail-event-location"></div>
                            </div>
                        </div>
                        <div class="event-detail-item" id="detail-link-item">
                            <div class="item-icon">🔗</div>
                            <div class="item-content">
                                <div class="item-label">会议链接</div>
                                <div><a id="detail-event-link" href="#" target="_blank"></a></div>
                            </div>
                        </div>
                        <div class="event-detail-item" id="detail-project-item">
                            <div class="item-icon">📁</div>
                            <div class="item-content">
                                <div class="item-label">项目</div>
                                <div id="detail-event-project"></div>
                            </div>
                        </div>
                        <div class="event-detail-item" id="detail-desc-item">
                            <div class="item-icon">📝</div>
                            <div class="item-content">
                                <div class="item-label">描述</div>
                                <div id="detail-event-desc"></div>
                            </div>
                        </div>
                    </div>
                    <div class="event-detail-footer">
                        <button class="btn btn-danger btn-sm" id="delete-event-btn" onclick="app.deleteCurrentEvent()">删除</button>
                        <button class="btn btn-primary btn-sm" id="edit-event-btn" onclick="app.editCurrentEvent()">编辑</button>
                    </div>
                </div>
            </div>

            <div id="meetings-list-container" style="display: none;">
                <div class="page-header" style="margin-bottom: 1rem;">
                    <h3>项目例会</h3>
                    <button class="btn btn-primary btn-sm" onclick="app.showCreateMeetingModal()">+ 创建例会</button>
                </div>
                <div id="meetings-list" class="meeting-list">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>

            <div id="deliveries-list-container" style="display: none;">
                <div class="page-header" style="margin-bottom: 1rem;">
                    <h3>资源交付任务</h3>
                    <button class="btn btn-primary btn-sm" onclick="app.showCreateDeliveryModal()">+ 添加交付任务</button>
                </div>
                <div id="deliveries-list" class="delivery-list">
                    <div class="loading"><div class="spinner"></div></div>
                </div>
            </div>
        `;

        await Promise.all([
            this.loadCalendarProjects(),
            this.loadCalendarStats()
        ]);

        this.initCalendar();
    }

    async loadCalendarProjects() {
        try {
            const result = await api.get('/projects');
            const select = document.getElementById('calendar-project-filter');
            const eventSelect = document.getElementById('event-project-select');
            if (result.projects) {
                result.projects.forEach(p => {
                    const opt1 = document.createElement('option');
                    opt1.value = p.id;
                    opt1.textContent = p.name;
                    select.appendChild(opt1);

                    const opt2 = document.createElement('option');
                    opt2.value = p.id;
                    opt2.textContent = p.name;
                    eventSelect.appendChild(opt2);
                });
            }
        } catch (error) {
            console.error('加载项目列表失败:', error);
        }
    }

    async loadCalendarStats() {
        try {
            const result = await api.get('/calendar/summary');
            const summary = result.summary;
            const container = document.getElementById('calendar-stats');
            
            container.innerHTML = `
                <div class="stat-card">
                    <div class="stat-value">${summary.deliveries_today}</div>
                    <div class="stat-label">今日交付</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${summary.deliveries_this_week}</div>
                    <div class="stat-label">本周交付</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${summary.deliveries_this_month}</div>
                    <div class="stat-label">本月交付</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${summary.active_meetings}</div>
                    <div class="stat-label">活跃例会</div>
                </div>
            `;
        } catch (error) {
            document.getElementById('calendar-stats').innerHTML = '';
        }
    }

    initCalendar() {
        const container = document.getElementById('calendar-container');
        if (!container) return;

        calendarInstance = new CalendarComponent(container, {
            viewMode: 'month',
            onEventClick: (event) => this.showEventDetail(event),
            onDateClick: (date) => this.showCreateEventModal(date),
            onEventDrop: (event, newDate) => this.handleEventDrop(event, newDate)
        });
    }

    switchCalendarTab(tab) {
        this.currentCalendarTab = tab;

        document.querySelectorAll('.calendar-tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`[data-tab="${tab}"]`).classList.add('active');

        document.getElementById('calendar-container').style.display = tab === 'calendar' ? 'block' : 'none';
        document.getElementById('meetings-list-container').style.display = tab === 'meetings' ? 'block' : 'none';
        document.getElementById('deliveries-list-container').style.display = tab === 'deliveries' ? 'block' : 'none';

        if (tab === 'meetings') {
            this.loadMeetingsList();
        } else if (tab === 'deliveries') {
            this.loadDeliveriesList();
        }
    }

    filterCalendar() {
        if (!calendarInstance) return;

        const projectFilter = document.getElementById('calendar-project-filter').value;
        const typeFilter = document.getElementById('calendar-type-filter').value;
        const resourceFilter = document.getElementById('calendar-resource-filter').value;

        calendarInstance.setFilter('project', projectFilter);
        calendarInstance.setFilter('type', typeFilter);
        calendarInstance.setFilter('resource', resourceFilter);
    }

    searchCalendarEvents() {
        if (!calendarInstance) return;
        const query = document.getElementById('calendar-search').value;
        calendarInstance.setFilter('search', query);
    }

    showCreateEventModal(date = null) {
        this.editingEvent = null;
        this.editingEventId = null;

        document.getElementById('event-modal-title').textContent = '新建日程';
        document.getElementById('event-form').reset();

        const typeSelect = document.getElementById('event-type-select');
        typeSelect.value = 'general';
        this.updateEventTypeOptions();

        if (date) {
            const startInput = document.querySelector('[name="start_time"]');
            const endInput = document.querySelector('[name="end_time"]');
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            startInput.value = `${year}-${month}-${day}T09:00`;
            endInput.value = `${year}-${month}-${day}T10:00`;
        }

        document.getElementById('event-modal').style.display = 'flex';
    }

    hideEventModal() {
        document.getElementById('event-modal').style.display = 'none';
    }

    updateEventTypeOptions() {
        const eventType = document.getElementById('event-type-select').value;
        const meetingOptions = document.getElementById('meeting-options-group');
        const recurringOptions = document.getElementById('recurring-options');

        if (eventType === 'meeting') {
            meetingOptions.style.display = 'block';
        } else {
            meetingOptions.style.display = 'none';
            recurringOptions.style.display = 'none';
            document.getElementById('is-recurring-meeting').checked = false;
        }
    }

    toggleRecurringOptions() {
        const checkbox = document.getElementById('is-recurring-meeting');
        const options = document.getElementById('recurring-options');
        options.style.display = checkbox.checked ? 'block' : 'none';

        if (checkbox.checked) {
            const startDate = document.querySelector('[name="start_time"]').value?.split('T')[0];
            if (startDate) {
                document.getElementById('meeting-start-date').value = startDate;
            }
        }
    }

    async saveEvent() {
        const form = document.getElementById('event-form');
        const formData = new FormData(form);
        const eventType = formData.get('event_type');

        try {
            if (eventType === 'meeting' && document.getElementById('is-recurring-meeting').checked) {
                await this.createMeetingFromForm();
            } else if (eventType === 'meeting') {
                await this.createSingleMeeting();
            } else {
                await this.createGeneralEvent();
            }
            this.hideEventModal();
            if (calendarInstance) {
                calendarInstance.clearCache();
                calendarInstance.loadEvents();
            }
            this.loadCalendarStats();
            showToast('日程创建成功！', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async createGeneralEvent() {
        const form = document.getElementById('event-form');
        const formData = new FormData(form);

        const projectId = formData.get('project_id');
        const data = {
            title: formData.get('title'),
            description: formData.get('description') || '',
            start_time: formData.get('start_time'),
            end_time: formData.get('end_time'),
            location: formData.get('location') || '',
            meeting_link: formData.get('meeting_link') || '',
            color: formData.get('color') || '#6366f1',
            event_type: 'general'
        };

        if (projectId) {
            data.project_id = parseInt(projectId);
        }

        if (this.editingEventId && !this.editingEventId.toString().startsWith('meeting_') && !this.editingEventId.toString().startsWith('delivery_')) {
            await api.put(`/calendar/events/${this.editingEventId}`, data);
        } else {
            await api.post('/calendar/events/general', data);
        }
    }

    async createMeetingFromForm() {
        const form = document.getElementById('event-form');
        const formData = new FormData(form);

        const projectId = formData.get('project_id');
        if (!projectId) {
            throw new Error('例会需要关联项目');
        }

        const startTime = formData.get('start_time')?.split('T')[1];
        const endTime = formData.get('end_time')?.split('T')[1];

        const data = {
            project_id: parseInt(projectId),
            title: formData.get('title'),
            description: formData.get('description') || '',
            recurrence_type: formData.get('recurrence_type') || 'weekly',
            start_time: startTime,
            end_time: endTime,
            start_date: formData.get('start_date'),
            location: formData.get('location') || '',
            meeting_link: formData.get('meeting_link') || ''
        };

        const recType = formData.get('recurrence_type');
        if (recType === 'weekly') {
            data.recurrence_day = parseInt(formData.get('recurrence_day'));
        } else if (recType === 'monthly') {
            const startDate = new Date(formData.get('start_date'));
            data.recurrence_day = startDate.getDate();
        }

        const endDate = formData.get('end_date');
        if (endDate) {
            data.end_date = endDate;
        }

        await api.post('/calendar/meetings', data);
    }

    async createSingleMeeting() {
        const form = document.getElementById('event-form');
        const formData = new FormData(form);

        const projectId = formData.get('project_id');
        const startDateTime = formData.get('start_time');
        const startDate = startDateTime?.split('T')[0];
        const startTime = startDateTime?.split('T')[1];
        const endTime = formData.get('end_time')?.split('T')[1];

        const data = {
            project_id: parseInt(projectId),
            title: formData.get('title'),
            description: formData.get('description') || '',
            recurrence_type: 'once',
            start_time: startTime,
            end_time: endTime,
            start_date: startDate,
            location: formData.get('location') || '',
            meeting_link: formData.get('meeting_link') || ''
        };

        await api.post('/calendar/meetings', data);
    }

    showEventDetail(event) {
        this.currentEvent = event;

        const typeNames = {
            meeting: '项目例会',
            delivery: '交付任务',
            general: '普通日程'
        };

        document.getElementById('detail-event-type').textContent = typeNames[event.event_type] || '日程';
        document.getElementById('detail-event-type').className = `event-type-badge ${event.event_type}`;
        document.getElementById('detail-event-title').textContent = event.title;

        const startTime = new Date(event.start_time);
        const endTime = new Date(event.end_time);
        const timeStr = `${startTime.toLocaleString('zh-CN')} - ${endTime.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
        document.getElementById('detail-event-time').textContent = timeStr;

        document.getElementById('detail-event-location').textContent = event.location || '未设置';
        document.getElementById('detail-event-project').textContent = event.project_name || '未关联';

        const linkItem = document.getElementById('detail-link-item');
        const linkEl = document.getElementById('detail-event-link');
        if (event.meeting_link) {
            linkItem.style.display = 'flex';
            linkEl.href = event.meeting_link;
            linkEl.textContent = event.meeting_link;
        } else {
            linkItem.style.display = 'none';
        }

        const descEl = document.getElementById('detail-event-desc');
        const descItem = document.getElementById('detail-desc-item');
        if (event.description) {
            descItem.style.display = 'flex';
            descEl.textContent = event.description;
        } else {
            descItem.style.display = 'none';
        }

        const canEdit = event.event_type === 'general' && !event.id.toString().startsWith('meeting_') && !event.id.toString().startsWith('delivery_');
        document.getElementById('edit-event-btn').style.display = canEdit ? 'inline-flex' : 'none';
        document.getElementById('delete-event-btn').style.display = canEdit ? 'inline-flex' : 'none';

        document.getElementById('event-detail-modal').style.display = 'flex';
    }

    hideEventDetailModal() {
        document.getElementById('event-detail-modal').style.display = 'none';
        this.currentEvent = null;
    }

    editCurrentEvent() {
        if (!this.currentEvent) return;
        this.hideEventDetailModal();

        this.editingEventId = this.currentEvent.id;
        this.editingEvent = this.currentEvent;

        document.getElementById('event-modal-title').textContent = '编辑日程';

        const form = document.getElementById('event-form');
        form.title.value = this.currentEvent.title;
        form.description.value = this.currentEvent.description || '';
        form.location.value = this.currentEvent.location || '';
        form.meeting_link.value = this.currentEvent.meeting_link || '';
        form.color.value = this.currentEvent.color || '#6366f1';
        form.event_type.value = this.currentEvent.event_type || 'general';

        const start = new Date(this.currentEvent.start_time);
        const end = new Date(this.currentEvent.end_time);
        form.start_time.value = start.toISOString().slice(0, 16);
        form.end_time.value = end.toISOString().slice(0, 16);

        this.updateEventTypeOptions();
        document.getElementById('event-modal').style.display = 'flex';
    }

    async deleteCurrentEvent() {
        if (!this.currentEvent) return;
        if (!confirm('确定要删除这个日程吗？')) return;

        try {
            const eventId = this.currentEvent.id;
            if (!eventId.toString().startsWith('meeting_') && !eventId.toString().startsWith('delivery_')) {
                await api.delete(`/calendar/events/${eventId}`);
                if (calendarInstance) {
                    calendarInstance.removeEvent(eventId);
                }
            }
            this.hideEventDetailModal();
            this.loadCalendarStats();
            showToast('日程已删除', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async handleEventDrop(event, newDate) {
        if (event.id.toString().startsWith('meeting_') || event.id.toString().startsWith('delivery_')) {
            showToast('例会和交付任务不能直接拖拽调整', 'info');
            return;
        }

        try {
            const duration = new Date(event.end_time) - new Date(event.start_time);
            const newEndTime = new Date(newDate.getTime() + duration);

            await api.put(`/calendar/events/${event.id}`, {
                start_time: newDate.toISOString(),
                end_time: newEndTime.toISOString()
            });

            if (calendarInstance) {
                calendarInstance.clearCache();
                calendarInstance.loadEvents();
            }
            showToast('日程已更新', 'success');
        } catch (error) {
            showToast(error.message, 'error');
            if (calendarInstance) {
                calendarInstance.loadEvents();
            }
        }
    }

    async loadMeetingsList() {
        const container = document.getElementById('meetings-list');
        const projectFilter = document.getElementById('calendar-project-filter').value;

        try {
            let url = '/calendar/meetings';
            if (projectFilter) url += `?project_id=${projectFilter}`;

            const result = await api.get(url);
            const meetings = result.meetings || [];

            if (meetings.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📋</div>
                        <h3>还没有例会</h3>
                        <p>创建第一个项目例会吧！</p>
                    </div>
                `;
                return;
            }

            const recurrenceNames = {
                daily: '每天',
                weekly: '每周',
                monthly: '每月',
                once: '单次'
            };

            container.innerHTML = meetings.map(m => `
                <div class="meeting-item">
                    <div class="meeting-info">
                        <h4>${escapeHtml(m.title)}</h4>
                        <div class="meeting-meta">
                            <span class="meeting-badge ${m.recurrence_type}">${recurrenceNames[m.recurrence_type]}</span>
                            <span>📁 ${escapeHtml(m.project_name)}</span>
                            <span>⏰ ${m.start_time?.substring(0, 5)} - ${m.end_time?.substring(0, 5)}</span>
                        </div>
                        ${m.description ? `<p class="meeting-desc">${escapeHtml(m.description)}</p>` : ''}
                        ${m.location ? `<div class="meeting-location">📍 ${escapeHtml(m.location)}</div>` : ''}
                    </div>
                    <div class="meeting-actions">
                        <button class="btn btn-outline btn-sm" onclick="app.editMeeting(${m.id})">编辑</button>
                        <button class="btn btn-danger btn-sm" onclick="app.deleteMeeting(${m.id})">删除</button>
                    </div>
                </div>
            `).join('');
        } catch (error) {
            container.innerHTML = `<div class="empty-state"><p>加载失败：${error.message}</p></div>`;
        }
    }

    showCreateMeetingModal() {
        this.showCreateEventModal();
        document.getElementById('event-type-select').value = 'meeting';
        document.getElementById('is-recurring-meeting').checked = true;
        this.updateEventTypeOptions();
        this.toggleRecurringOptions();
    }

    async editMeeting(meetingId) {
        try {
            const result = await api.get(`/calendar/meetings?project_id=`);
            const meeting = result.meetings?.find(m => m.id === meetingId);
            if (meeting) {
                showToast('编辑例会功能开发中', 'info');
            }
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async deleteMeeting(meetingId) {
        if (!confirm('确定要删除这个例会吗？')) return;

        try {
            await api.delete(`/calendar/meetings/${meetingId}`);
            this.loadMeetingsList();
            if (calendarInstance) {
                calendarInstance.clearCache();
                calendarInstance.loadEvents();
            }
            this.loadCalendarStats();
            showToast('例会已删除', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
    }

    async loadDeliveriesList() {
        const container = document.getElementById('deliveries-list');
        const projectFilter = document.getElementById('calendar-project-filter').value;
        const resourceFilter = document.getElementById('calendar-resource-filter').value;

        try {
            let params = [];
            if (projectFilter) params.push(`project_id=${projectFilter}`);
            if (resourceFilter) params.push(`resource_type=${resourceFilter}`);
            let url = '/calendar/deliveries' + (params.length ? '?' + params.join('&') : '');

            const result = await api.get(url);
            const deliveries = result.deliveries || [];

            if (deliveries.length === 0) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-state-icon">📦</div>
                        <h3>还没有交付任务</h3>
                        <p>添加第一个资源交付任务吧！</p>
                    </div>
                `;
                return;
            }

            const statusNames = {
                pending: '待开始',
                in_progress: '进行中',
                completed: '已完成',
                delayed: '已延期'
            };

            const resourceNames = {
                art: '美术资源',
                code: '程序代码',
                document: '文档',
                sound: '音效音乐',
                general: '其他'
            };

            const priorityColors = {
                low: 'var(--text-muted)',
                medium: 'var(--primary-color)',
                high: 'var(--warning-color)',
                urgent: 'var(--danger-color)'
            };

            container.innerHTML = deliveries.map(d => {
                const deadline = new Date(d.deadline);
                const isOverdue = new Date() > deadline && d.status !== 'completed';
                return `
                    <div class="delivery-item ${isOverdue ? 'overdue' : ''} status-${d.status}">
                        <div class="delivery-header">
                            <h4>${escapeHtml(d.title)}</h4>
                            <span class="delivery-status status-${d.status}">${statusNames[d.status]}</span>
                        </div>
                        <div class="delivery-meta">
                            <span class="resource-type-badge type-${d.resource_type}">${resourceNames[d.resource_type] || d.resource_type}</span>
                            <span>📁 ${escapeHtml(d.project_name)}</span>
                            <span style="color: ${priorityColors[d.priority]};">⚡ ${d.priority === 'urgent' ? '紧急' : d.priority === 'high' ? '高' : d.priority === 'medium' ? '中' : '低'}</span>
                        </div>
                        <div class="delivery-deadline">
                            📅 截止：${deadline.toLocaleString('zh-CN')}
                            ${isOverdue ? '<span class="overdue-badge">已延期</span>' : ''}
                        </div>
                        ${d.assignee ? `<div class="delivery-assignee">👤 ${escapeHtml(d.assignee?.username || '')}</div>` : ''}
                        ${d.description ? `<p class="delivery-desc">${escapeHtml(d.description)}</p>` : ''}
                        <div class="delivery-actions">
                            <button class="btn btn-outline btn-sm" onclick="app.editDelivery(${d.id})">编辑</button>
                            <button class="btn btn-danger btn-sm" onclick="app.deleteDelivery(${d.id})">删除</button>
                        </div>
                    </div>
                `;
            }).join('');
        } catch (error) {
            container.innerHTML = `<div class="empty-state"><p>加载失败：${error.message}</p></div>`;
        }
    }

    showCreateDeliveryModal() {
        showToast('交付任务创建功能可通过"新建日程"选择"交付任务"类型使用', 'info');
    }

    async editDelivery(taskId) {
        showToast('编辑交付任务功能开发中', 'info');
    }

    async deleteDelivery(taskId) {
        if (!confirm('确定要删除这个交付任务吗？')) return;

        try {
            await api.delete(`/calendar/deliveries/${taskId}`);
            this.loadDeliveriesList();
            if (calendarInstance) {
                calendarInstance.clearCache();
                calendarInstance.loadEvents();
            }
            this.loadCalendarStats();
            showToast('交付任务已删除', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        }
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

const EMOJI_LIST = [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
    '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫',
    '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬',
    '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
    '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎',
    '🤓', '🧐', '😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳',
    '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖',
    '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬',
    '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽',
    '👾', '🤖', '😺', '😸', '😹', '😻', '😼', '😽', '🙀', '😿',
    '😾', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎',
    '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
    '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️', '🤟', '🤘',
    '👌', '🤌', '🤏', '👈', '👉', '👆', '👇', '☝️', '✋', '🤚',
    '🖐️', '🖖', '👋', '🤙', '💪', '🦾', '🖕', '🙏', '✍️', '💅',
    '🎮', '🎲', '🎯', '🎪', '🎨', '🎭', '🏰', '🚀', '⚔️', '🔮',
    '⭐', '🌟', '✨', '💫', '🔥', '💥', '💦', '💨', '🎉', '🎊',
    '🎁', '🎈', '🎀', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '📝',
    '📌', '📎', '✂️', '🔧', '🔨', '⚙️', '🛠️', '🧰', '💡', '🔦'
];

function insertAtCursor(textarea, text) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    textarea.value = value.substring(0, start) + text + value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + text.length;
    textarea.focus();
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function renderContentWithImages(content) {
    if (!content) return '';
    let html = escapeHtml(content);
    const imgRegex = /\[img\](.+?)\[\/img\]/g;
    html = html.replace(imgRegex, (match, url) => {
        return `<img src="${url}" alt="image" class="content-image" onclick="openImagePreview('${url}')" loading="lazy">`;
    });
    html = html.replace(/\n/g, '<br>');
    return html;
}

function getContentPreview(content, maxLength = 100) {
    if (!content) return '';
    let text = content.replace(/\[img\].*?\[\/img\]/g, '🖼️图片');
    text = text.replace(/\n/g, ' ');
    if (text.length > maxLength) {
        text = text.substring(0, maxLength) + '...';
    }
    return text;
}

function openImagePreview(imageUrl) {
    const modal = document.createElement('div');
    modal.className = 'image-preview-modal';
    modal.id = 'image-preview-modal';
    modal.innerHTML = `
        <div class="image-preview-overlay" onclick="closeImagePreview()"></div>
        <div class="image-preview-content">
            <button class="image-preview-close" onclick="closeImagePreview()">&times;</button>
            <img src="${imageUrl}" alt="preview" class="image-preview-img">
        </div>
    `;
    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';
}

function closeImagePreview() {
    const modal = document.getElementById('image-preview-modal');
    if (modal) {
        modal.remove();
        document.body.style.overflow = '';
    }
}

function toggleEmojiPicker(textareaId, pickerId) {
    const picker = document.getElementById(pickerId);
    if (picker.style.display === 'none' || !picker.style.display) {
        picker.style.display = 'block';
    } else {
        picker.style.display = 'none';
    }
}

function insertEmoji(textareaId, emoji) {
    const textarea = document.getElementById(textareaId);
    if (textarea) {
        insertAtCursor(textarea, emoji);
    }
}

async function uploadIdeaImage(file, textareaId) {
    const formData = new FormData();
    formData.append('file', file);
    
    showToast('正在上传图片...', 'info');
    
    try {
        const result = await api.upload('/ideas/upload-image', formData);
        const textarea = document.getElementById(textareaId);
        if (textarea) {
            insertAtCursor(textarea, `[img]${result.image_url}[/img]`);
        }
        showToast('图片上传成功！', 'success');
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function triggerImageUpload(inputId) {
    document.getElementById(inputId).click();
}

function handleImageUpload(event, textareaId) {
    const file = event.target.files[0];
    if (file) {
        uploadIdeaImage(file, textareaId);
    }
    event.target.value = '';
}

function getFileIcon(fileType) {
    const icons = {
        'pdf': '📄',
        'word': '📝',
        'excel': '📊',
        'ppt': '📽️',
        'text': '📃',
        'image': '🖼️',
        'other': '📎'
    };
    return icons[fileType] || icons['other'];
}

function formatFileSize(bytes) {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function canPreview(fileType) {
    return ['pdf', 'image', 'text'].includes(fileType);
}

async function uploadIdeaAttachment(ideaId, file, onSuccess) {
    const formData = new FormData();
    formData.append('file', file);
    
    showToast('正在上传附件...', 'info');
    
    try {
        const result = await api.upload(`/ideas/${ideaId}/attachments`, formData);
        showToast('附件上传成功！', 'success');
        if (onSuccess) {
            onSuccess(result.attachment);
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

async function deleteIdeaAttachment(attachmentId, onSuccess) {
    if (!confirm('确定要删除这个附件吗？')) {
        return;
    }
    
    try {
        await api.delete(`/ideas/attachments/${attachmentId}`);
        showToast('附件删除成功！', 'success');
        if (onSuccess) {
            onSuccess();
        }
    } catch (error) {
        showToast(error.message, 'error');
    }
}

function renderAttachmentItem(attachment, isOwner = false) {
    const icon = getFileIcon(attachment.file_type);
    const size = formatFileSize(attachment.file_size);
    const canPreviewFile = canPreview(attachment.file_type);
    
    return `
        <div class="attachment-item" data-id="${attachment.id}">
            <div class="attachment-icon">${icon}</div>
            <div class="attachment-info">
                <div class="attachment-name" title="${escapeHtml(attachment.original_filename)}">
                    ${escapeHtml(attachment.original_filename)}
                </div>
                <div class="attachment-meta">${size}</div>
            </div>
            <div class="attachment-actions">
                ${canPreviewFile ? `
                    <button class="btn btn-outline btn-sm" onclick="previewAttachment(${attachment.id})" title="在线预览">
                        👁️ 预览
                    </button>
                ` : ''}
                <button class="btn btn-outline btn-sm" onclick="downloadAttachment(${attachment.id})" title="下载">
                    ⬇️ 下载
                </button>
                ${isOwner ? `
                    <button class="btn btn-danger btn-sm" onclick="deleteAttachment(${attachment.id})" title="删除">
                        🗑️ 删除
                    </button>
                ` : ''}
            </div>
        </div>
    `;
}

function previewAttachment(attachmentId) {
    const url = `/api/ideas/attachments/preview/${attachmentId}`;
    window.open(url, '_blank');
}

function downloadAttachment(attachmentId) {
    window.location.href = `/api/ideas/attachments/download/${attachmentId}`;
}

function triggerAttachmentUpload(inputId) {
    document.getElementById(inputId).click();
}

function handleAttachmentUpload(event, ideaId) {
    const files = event.target.files;
    for (let file of files) {
        uploadIdeaAttachment(ideaId, file, () => app.loadAttachments(ideaId));
    }
    event.target.value = '';
}

function deleteAttachment(attachmentId) {
    deleteIdeaAttachment(attachmentId, () => {
        const item = document.querySelector(`.attachment-item[data-id="${attachmentId}"]`);
        if (item) {
            item.remove();
        }
    });
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

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeImagePreview();
            document.querySelectorAll('.emoji-picker').forEach(picker => {
                picker.style.display = 'none';
            });
        }
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.emoji-picker') && !e.target.closest('.toolbar-btn')) {
            document.querySelectorAll('.emoji-picker').forEach(picker => {
                picker.style.display = 'none';
            });
        }
    });
});
