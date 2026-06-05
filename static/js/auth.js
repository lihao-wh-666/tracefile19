class AuthManager {
    constructor() {
        this.currentUser = null;
        this._publicKey = null;
        this._publicKeyPromise = null;
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
}

const auth = new AuthManager();
