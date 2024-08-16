import CryptoJS from 'crypto-js';

const secretKey = "mySecretKey";

export const encryptStr = (str) => {
    const encryptedText = CryptoJS.AES.encrypt(str, secretKey).toString();
    return encryptedText.replace(/\//g, '_'); // Ganti / dengan _;
}

export const decryptHash = (hash) => {
    const decryptedText = CryptoJS.AES.decrypt(hash.replace(/_/g, '/'), secretKey).toString(CryptoJS.enc.Utf8);
    return decryptedText;
}