const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function hashSecret(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function safeFileWrite(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, { encoding: "utf8", mode: 0o600 });
}

class PairingStore {
  constructor({ directory, safeStorage } = {}) {
    if (!directory) throw new Error("PairingStore requires a directory");
    this.directory = directory;
    this.safeStorage = safeStorage || null;
    this.hostFile = path.join(directory, "lan-authorized-devices.json");
    this.clientFile = path.join(directory, "lan-client-credential.json");
  }

  readJson(filePath, fallback) {
    try {
      return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      return fallback;
    }
  }

  writeHostDevices(devices) {
    safeFileWrite(this.hostFile, JSON.stringify({ version: 1, devices }, null, 2));
  }

  getAuthorizedDevice(deviceId) {
    const data = this.readJson(this.hostFile, { version: 1, devices: {} });
    return data.devices && data.devices[deviceId] ? data.devices[deviceId] : null;
  }

  authorizeDevice(deviceId, token) {
    const data = this.readJson(this.hostFile, { version: 1, devices: {} });
    data.devices = data.devices || {};
    data.devices[deviceId] = {
      tokenHash: hashSecret(token),
      pairedAt: Date.now()
    };
    this.writeHostDevices(data.devices);
  }

  isAuthorized(deviceId, token) {
    const device = this.getAuthorizedDevice(deviceId);
    return Boolean(device && device.tokenHash === hashSecret(token));
  }

  saveClientCredential({ host, port, deviceId, token }) {
    let storedToken = token;
    let encrypted = false;
    if (this.safeStorage && this.safeStorage.isEncryptionAvailable()) {
      storedToken = this.safeStorage.encryptString(token).toString("base64");
      encrypted = true;
    }
    safeFileWrite(this.clientFile, JSON.stringify({
      version: 1,
      host,
      port,
      deviceId,
      token: storedToken,
      encrypted,
      savedAt: Date.now()
    }, null, 2));
  }

  getClientCredential() {
    const credential = this.readJson(this.clientFile, null);
    if (!credential || !credential.host || !credential.port || !credential.deviceId || !credential.token) return null;
    let token = credential.token;
    if (credential.encrypted) {
      if (!this.safeStorage || !this.safeStorage.isEncryptionAvailable()) return null;
      try {
        token = this.safeStorage.decryptString(Buffer.from(credential.token, "base64"));
      } catch (error) {
        return null;
      }
    }
    return { ...credential, token };
  }

  clearClientCredential() {
    try { fs.unlinkSync(this.clientFile); } catch (error) {}
  }
}

module.exports = {
  PairingStore,
  hashSecret
};
