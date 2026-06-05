const API_BASE_URL = '/api';

class ApiClient {
    constructor() {
        this.token = localStorage.getItem('token');
    }

    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }
        return headers;
    }

    async request(method, endpoint, data = null) {
        const url = `${API_BASE_URL}${endpoint}`;
        const options = {
            method,
            headers: this.getHeaders(),
        };

        if (data !== null) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(url, options);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '请求失败');
            }

            return result;
        } catch (error) {
            if (error.message === 'Failed to fetch') {
                throw new Error('网络连接失败，请检查服务器是否运行');
            }
            throw error;
        }
    }

    async upload(endpoint, formData) {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
            method: 'POST',
            headers,
            body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || '上传失败');
        }

        return result;
    }

    get(endpoint) {
        return this.request('GET', endpoint);
    }

    post(endpoint, data) {
        return this.request('POST', endpoint, data);
    }

    put(endpoint, data) {
        return this.request('PUT', endpoint, data);
    }

    delete(endpoint) {
        return this.request('DELETE', endpoint);
    }

    async download(endpoint) {
        const url = `${API_BASE_URL}${endpoint}`;
        const headers = {};
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        const response = await fetch(url, {
            method: 'GET',
            headers,
        });

        if (!response.ok) {
            const result = await response.json();
            throw new Error(result.error || '下载失败');
        }

        const blob = await response.blob();
        const contentDisposition = response.headers.get('Content-Disposition');
        let filename = 'download';
        if (contentDisposition) {
            const matches = contentDisposition.match(/filename="?(.+?)"?$/);
            if (matches) {
                filename = matches[1];
            }
        }

        const link = document.createElement('a');
        link.href = window.URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(link.href);
    }
}

const api = new ApiClient();
