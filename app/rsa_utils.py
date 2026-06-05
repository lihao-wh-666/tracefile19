from Crypto.PublicKey import RSA
from Crypto.Cipher import PKCS1_v1_5
import base64
import os


RSA_KEY_SIZE = 2048
RSA_PRIVATE_KEY_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'instance', 'rsa_private_key.pem')

_private_key = None
_public_key_pem = None


def _generate_key_pair():
    key = RSA.generate(RSA_KEY_SIZE)
    private_pem = key.export_key().decode('utf-8')
    public_pem = key.publickey().export_key().decode('utf-8')

    key_dir = os.path.dirname(RSA_PRIVATE_KEY_FILE)
    os.makedirs(key_dir, exist_ok=True)

    with open(RSA_PRIVATE_KEY_FILE, 'w') as f:
        f.write(private_pem)

    return private_pem, public_pem


def _load_keys():
    global _private_key, _public_key_pem

    if os.path.exists(RSA_PRIVATE_KEY_FILE):
        with open(RSA_PRIVATE_KEY_FILE, 'r') as f:
            private_pem = f.read()
        key = RSA.import_key(private_pem)
        _private_key = key
        _public_key_pem = key.publickey().export_key().decode('utf-8')
    else:
        private_pem, public_pem = _generate_key_pair()
        _private_key = RSA.import_key(private_pem)
        _public_key_pem = public_pem


def get_public_key_pem():
    if _public_key_pem is None:
        _load_keys()
    return _public_key_pem


def decrypt_rsa(encrypted_base64):
    if _private_key is None:
        _load_keys()

    try:
        encrypted_data = base64.b64decode(encrypted_base64)
        cipher = PKCS1_v1_5.new(_private_key)
        decrypted = cipher.decrypt(encrypted_data, None)

        if decrypted is None:
            return None

        return decrypted.decode('utf-8')
    except Exception:
        return None


_load_keys()
