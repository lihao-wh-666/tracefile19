class AuthManager {
    constructor() {
        this.currentUser = null;
        this._publicKey = null;
        this._publicKeyPromise = null;
        this._oauthWindow = null;
    }

    async _fetchPublicKey() {
        if (this._publicKey) {
            return this._publicKey;
        }
        if (this._publicKeyPromise) {
            return this._publicKeyPromise;
        }
        this._publicKeyPromise = fetch('/api/auth/public-key')
            .then(res => res.json())
            .then(data => {
                this._publicKey = data.public_key;
                this._publicKeyPromise = null;
                return this._publicKey;
            })
            .catch(err => {
                this._publicKeyPromise = null;
                throw new Error('获取RSA公钥失败');
            });
        return this._publicKeyPromise;
    }

    async _encryptPassword(password) {
        const publicKey = await this._fetchPublicKey();
        const encrypt = new JSEncrypt();
        encrypt.setPublicKey(publicKey);
        const encrypted = encrypt.encrypt(password);
        if (!encrypted) {
            throw new Error('密码加密失败');
        }
        return encrypted;
    }

    async register(userData) {
        try {
            const encryptedPassword = await this._encryptPassword(userData.password);
            const result = await api.post('/auth/register', {
                username: userData.username,
                email: userData.email,
                password: encryptedPassword
            });
            api.setToken(result.access_token);
            this.currentUser = result.user;
            return result;
        } catch (error) {
            throw error;
        }
    }

    async login(credentials) {
        try {
            const encryptedPassword = await this._encryptPassword(credentials.password);
            const result = await api.post('/auth/login', {
                email: credentials.email,
                password: encryptedPassword
            });
            api.setToken(result.access_token);
            this.currentUser = result.user;
            return result;
        } catch (error) {
            throw error;
        }
    }

    async encryptPassword(password) {
        return this._encryptPassword(password);
    }

    async getCurrentUser() {
        if (!api.token) {
            return null;
        }

        try {
            const result = await api.get('/auth/me');
            this.currentUser = result.user;
            return this.user;
        } catch (error) {
            this.logout();
            return null;
        }
    }

    logout() {
        api.setToken(null);
        this.currentUser = null;
    }

    isLoggedIn() {
        return !!api.token;
    }

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    }

    updateUser(userData) {
        this.currentUser = { ...this.currentUser, ...userData };
    }

    async getOAuthProviders() {
        try {
            const result = await api.get('/auth/oauth/providers');
            return result.providers;
        } catch (error) {
            throw error;
        }
    }

    async loginWithOAuth(provider) {
        try {
            const result = await api.get(`/auth/oauth/${provider}`);
            const authUrl = result.auth_url;
            
            const width = 600;
            const height = 700;
            const left = (window.screen.width - width) / 2;
            const top = (window.screen.height - height) / 2;
            
            this._oauthWindow = window.open(
                authUrl,
                'OAuth Login',
                `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
            );

            return new Promise((resolve, reject) => {
                const checkInterval = setInterval(() => {
                    if (this._oauthWindow && this._oauthWindow.closed) {
                        clearInterval(checkInterval);
                        clearTimeout(timeout);
                        reject(new Error('授权窗口已关闭'));
                    }
                }, 500);

                const timeout = setTimeout(() => {
                    clearInterval(checkInterval);
                    if (this._oauthWindow && !this._oauthWindow.closed) {
                        this._oauthWindow.close();
                    }
                    reject(new Error('授权超时'));
                }, 5 * 60 * 1000);

                window._handleOAuthCallback = (data) => {
                    clearInterval(checkInterval);
                    clearTimeout(timeout);
                    if (this._oauthWindow && !this._oauthWindow.closed) {
                        this._oauthWindow.close();
                    }
                    
                    if (data.success && data.token) {
                        api.setToken(data.token);
                        this.currentUser = {
                            id: data.user_id,
                            username: data.username,
                            avatar: data.avatar,
                        };
                        this.getCurrentUser().then(() => resolve(data));
                    } else {
                        reject(new Error(data.error || '授权失败'));
                    }
                };
            });
        } catch (error) {
            throw error;
        }
    }

    async sendEmailCode(email, purpose = 'login') {
        try {
            const result = await api.post('/auth/email/send-code', {
                email: email,
                purpose: purpose
            });
            return result;
        } catch (error) {
            throw error;
        }
    }

    async loginWithEmail(email, code) {
        try {
            const result = await api.post('/auth/email/login', {
                email: email,
                code: code
            });
            api.setToken(result.access_token);
            this.currentUser = result.user;
            return result;
        } catch (error) {
            throw error;
        }
    }

    async getLinkedAccounts() {
        try {
            const result = await api.get('/auth/oauth/accounts');
            return result;
        } catch (error) {
            throw error;
        }
    }

    async unlinkAccount(provider) {
        try {
            const result = await api.post(`/auth/oauth/unlink/${provider}`);
            return result;
        } catch (error) {
            throw error;
        }
    }

    async linkAccount(provider, code) {
        try {
            const result = await api.post(`/auth/oauth/link/${provider}`, {
                code: code
            });
            return result;
        } catch (error) {
            throw error;
        }
    }
}

const auth = new AuthManager();
