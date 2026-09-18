const net = require("net");
const os = require("os");
const crypto = require("crypto");
const { PROTOCOL_VERSION } = require("./transportInterface.cjs");
const { PairingStore, hashSecret } = require("./pairingStore.cjs");

const MAX_MESSAGE_BYTES = 256 * 1024;
const PAIRING_CODE_TTL_MS = 5 * 60 * 1000;

function lanLog(message, details) {
  if (details === undefined) {
    console.log(`[LAN] ${message}`);
  } else {
    console.log(`[LAN] ${message}`, details);
  }
}

function isPrivateIPv4(address) {
  const normalized = String(address || "").replace(/^::ffff:/, "");
  if (normalized === "127.0.0.1") return true;
  const parts = normalized.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  return parts[0] === 10 ||
    (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
    (parts[0] === 192 && parts[1] === 168);
}

function getPrivateAddresses() {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const info of interfaces || []) {
      if (info.family === "IPv4" && !info.internal && isPrivateIPv4(info.address)) {
        addresses.push(info.address);
      }
    }
  }
  return addresses;
}

function validateEnvelope(message) {
  if (!message || typeof message !== "object") throw new Error("Invalid LAN message");
  if (message.protocolVersion !== PROTOCOL_VERSION) throw new Error("Unsupported LAN protocol version");
  if (typeof message.messageType !== "string") throw new Error("LAN message type is required");
  return message;
}

function validateTestMessage(message) {
  validateEnvelope(message);
  if (message.messageType !== "test" || !message.testId || !message.deviceId) {
    throw new Error("Invalid LAN test message");
  }
  if (!message.payload || message.payload.testOnly !== true) {
    throw new Error("LAN test message must be explicitly marked test-only");
  }
  return message;
}

class LanTransport {
  constructor({ deviceIdProvider, dataDirectory, safeStorage, allowMutations = false, onTestMessage, onMutation } = {}) {
    if (typeof deviceIdProvider !== "function") throw new Error("LanTransport requires deviceIdProvider");
    if (!dataDirectory) throw new Error("LanTransport requires dataDirectory");
    this.deviceIdProvider = deviceIdProvider;
    this.allowMutations = allowMutations;
    this.onTestMessage = onTestMessage || null;
    this.onMutation = onMutation || null;
    this.pairingStore = new PairingStore({ directory: dataDirectory, safeStorage });
    this.mode = "stopped";
    this.server = null;
    this.socket = null;
    this.peers = new Set();
    this.pending = new Map();
    this.pairingCodeHash = null;
    this.pairingCodeExpiresAt = 0;
    this.lastTestMessage = null;
    this.lastError = null;
    this.connectionInfo = null;
  }

  getStatus() {
    return {
      mode: this.mode,
      connected: Boolean(this.socket && !this.socket.destroyed) || this.peers.size > 0,
      peerCount: this.peers.size,
      lastTestMessage: this.lastTestMessage,
      lastError: this.lastError,
      connectionInfo: this.connectionInfo
    };
  }

  createPairingCode() {
    if (this.mode !== "host") throw new Error("LAN host is not running");
    const code = String(Math.floor(100000 + Math.random() * 900000));
    this.pairingCodeHash = hashSecret(code);
    this.pairingCodeExpiresAt = Date.now() + PAIRING_CODE_TTL_MS;
    return { code, expiresAt: this.pairingCodeExpiresAt };
  }

  async startHost({ host, port = 0 } = {}) {
    if (this.server) return this.getStatus();
    const bindAddress = host || getPrivateAddresses()[0] || "127.0.0.1";
    if (!isPrivateIPv4(bindAddress)) throw new Error("LAN host must bind to a private IPv4 address");

    this.server = net.createServer((socket) => this.attachSocket(socket, "host"));
    this.mode = "host";
    this.lastError = null;
    await new Promise((resolve, reject) => {
      const onError = (error) => {
        this.server?.off("listening", onListening);
        this.lastError = error.message;
        reject(error);
      };
      const onListening = () => {
        this.server?.off("error", onError);
        const address = this.server.address();
        this.connectionInfo = {
          mode: "host",
          host: bindAddress,
          port: address.port,
          protocolVersion: PROTOCOL_VERSION
        };
        lanLog("HOST LISTENING", this.connectionInfo);
        resolve();
      };
      this.server.once("error", onError);
      this.server.once("listening", onListening);
      this.server.listen({ host: bindAddress, port });
    });
    return this.getStatus();
  }

  async stopHost() {
    lanLog("HOST STOP", { peerCount: this.peers.size });
    this.rejectPending(new Error("LAN host stopped"));
    for (const peer of this.peers) peer.destroy();
    this.peers.clear();
    if (this.server) {
      await new Promise((resolve) => this.server.close(() => resolve()));
      this.server = null;
    }
    if (this.mode === "host") this.mode = "stopped";
    this.connectionInfo = null;
    return this.getStatus();
  }

  async connect({ host, port, pairingCode } = {}) {
    if (!isPrivateIPv4(host)) throw new Error("LAN client must connect to a private IPv4 address");
    if (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535) {
      throw new Error("LAN client port is invalid");
    }
    await this.disconnect();
    this.mode = "client";
    this.lastError = null;
    const stored = this.pairingStore.getClientCredential();
    const credential = stored && stored.host === host && Number(stored.port) === Number(port) ? stored : null;
    const socket = net.createConnection({ host, port: Number(port) });
    lanLog("CLIENT CONNECT ATTEMPT", { host, port: Number(port) });
    this.socket = socket;
    this.connectionInfo = { mode: "client", host, port: Number(port), protocolVersion: PROTOCOL_VERSION };

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error) => {
        if (settled) return;
        settled = true;
        if (error) {
          this.lastError = error.message;
          socket.destroy();
          reject(error);
        } else {
          resolve(this.getStatus());
        }
      };
      socket.once("error", finish);
      socket.once("connect", () => {
        lanLog("CLIENT TCP CONNECTED", { host, port: Number(port) });
        lanLog("CLIENT HANDSHAKE HELLO");
        this.sendRaw(socket, {
          protocolVersion: PROTOCOL_VERSION,
          messageType: "hello",
          deviceId: this.deviceIdProvider(),
          authToken: credential ? credential.token : null,
          pairingCode: pairingCode || null
        });
      });
      socket.once("lan:authorized", () => finish());
      socket.once("lan:authorized", () => lanLog("CLIENT AUTHENTICATED"));
      socket.once("lan:rejected", (error) => {
        lanLog("CLIENT AUTHENTICATION REJECTED", error.message);
        finish(error);
      });
      socket.once("close", () => {
        lanLog("CLIENT SOCKET CLOSE", { host, port: Number(port) });
        finish(new Error("LAN connection closed before authorization"));
      });
      this.attachSocket(socket, "client");
    });
  }

  async disconnect() {
    if (!this.socket) return this.getStatus();
    this.rejectPending(new Error("LAN client disconnected"));
    const socket = this.socket;
    this.socket = null;
    socket.destroy();
    if (this.mode === "client") {
      this.mode = "stopped";
      this.connectionInfo = null;
    }
    return this.getStatus();
  }

  attachSocket(socket, role) {
    lanLog(role === "host" ? "HOST SOCKET ACCEPTED" : "CLIENT SOCKET ATTACHED", {
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort
    });
    if (!isPrivateIPv4(socket.remoteAddress || "127.0.0.1")) {
      lanLog("SOCKET REJECTED NON_PRIVATE", { remoteAddress: socket.remoteAddress });
      socket.destroy();
      return;
    }
    const state = { authorized: false, role, buffer: "" };
    socket.setEncoding("utf8");
    socket.on("data", (chunk) => {
      state.buffer += chunk;
      if (Buffer.byteLength(state.buffer, "utf8") > MAX_MESSAGE_BYTES) {
        this.rejectSocket(socket, new Error("LAN message exceeds size limit"));
        return;
      }
      let newline;
      while ((newline = state.buffer.indexOf("\n")) >= 0) {
        const line = state.buffer.slice(0, newline);
        state.buffer = state.buffer.slice(newline + 1);
        if (!line.trim()) continue;
        let message;
        try {
          message = validateEnvelope(JSON.parse(line));
          this.handleMessage(socket, state, message);
        } catch (error) {
          lanLog("SOCKET PROTOCOL ERROR", error.message);
          this.rejectSocket(socket, error);
          return;
        }
      }
    });
    socket.on("close", () => {
      this.peers.delete(socket);
      lanLog(role === "host" ? "HOST CLIENT DISCONNECTED" : "CLIENT SOCKET CLOSE", {
        remoteAddress: socket.remoteAddress,
        remotePort: socket.remotePort,
        peerCount: this.peers.size
      });
      if (this.socket === socket) this.socket = null;
    });
    socket.on("error", (error) => {
      this.lastError = error.message;
      lanLog(role === "host" ? "HOST SOCKET ERROR" : "CLIENT SOCKET ERROR", error.message);
    });
  }

  handleMessage(socket, state, message) {
    if (message.messageType === "hello") {
      if (state.role !== "host") throw new Error("Unexpected hello message");
      lanLog("HOST HELLO RECEIVED", { deviceId: message.deviceId });
      if (message.deviceId === this.deviceIdProvider()) throw new Error("Duplicate device identity");
      const authorized = message.authToken && this.pairingStore.isAuthorized(message.deviceId, message.authToken);
      const pairingAllowed = message.pairingCode && this.pairingCodeHash && Date.now() < this.pairingCodeExpiresAt && hashSecret(message.pairingCode) === this.pairingCodeHash;
      if (!authorized && !pairingAllowed) {
        lanLog("HOST AUTHENTICATION REJECTED", { deviceId: message.deviceId });
        this.sendRaw(socket, { protocolVersion: PROTOCOL_VERSION, messageType: "error", code: "not_paired" });
        socket.emit("lan:rejected", new Error("LAN device is not paired"));
        socket.destroy();
        return;
      }
      const token = authorized ? message.authToken : crypto.randomBytes(32).toString("hex");
      if (!authorized) {
        this.pairingStore.authorizeDevice(message.deviceId, token);
        this.pairingCodeHash = null;
        this.pairingCodeExpiresAt = 0;
      }
      state.authorized = true;
      state.deviceId = message.deviceId;
      this.peers.add(socket);
      lanLog("HOST CLIENT REGISTERED", { deviceId: state.deviceId, peerCount: this.peers.size });
      this.sendRaw(socket, {
        protocolVersion: PROTOCOL_VERSION,
        messageType: "pairing_ack",
        deviceId: this.deviceIdProvider(),
        pairedDeviceId: message.deviceId,
        authToken: authorized ? null : token
      });
      socket.emit("lan:authorized");
      lanLog("HOST PAIRING ACK SENT", { deviceId: state.deviceId });
      return;
    }
    if (message.messageType === "error") {
      const error = new Error(message.code || "LAN peer rejected the message");
      socket.emit("lan:rejected", error);
      if (state.role === "client") socket.destroy();
      return;
    }
    if (message.messageType === "pairing_ack") {
      if (state.role !== "client" || message.pairedDeviceId !== this.deviceIdProvider()) {
        throw new Error("Invalid LAN pairing acknowledgement");
      }
      if (message.authToken) {
        this.pairingStore.saveClientCredential({
          host: this.connectionInfo.host,
          port: this.connectionInfo.port,
          deviceId: message.deviceId,
          token: message.authToken
        });
      }
      state.authorized = true;
      lanLog("CLIENT PAIRING ACK RECEIVED", { hostDeviceId: message.deviceId });
      socket.emit("lan:authorized");
      return;
    }
    if (!state.authorized) throw new Error("LAN message received before authorization");
    if (message.messageType === "test") {
      const testMessage = validateTestMessage(message);
      this.lastTestMessage = testMessage;
      if (this.onTestMessage) this.onTestMessage(testMessage);
      this.sendRaw(socket, {
        protocolVersion: PROTOCOL_VERSION,
        messageType: "test_ack",
        testId: testMessage.testId,
        deviceId: this.deviceIdProvider(),
        status: "received",
        acknowledgedAt: Date.now()
      });
      return;
    }
    if (message.messageType === "mutation") {
      if (!this.allowMutations || !this.onMutation) throw new Error("LAN mutation application is disabled in test mode");
      Promise.resolve(this.onMutation(message)).then((result) => {
        this.sendRaw(socket, {
          protocolVersion: PROTOCOL_VERSION,
          messageType: "ack",
          operationId: message.operationId,
          deviceId: this.deviceIdProvider(),
          status: result && result.duplicate ? "duplicate" : "applied",
          acknowledgedAt: Date.now()
        });
      }).catch((error) => {
        this.sendRaw(socket, { protocolVersion: PROTOCOL_VERSION, messageType: "error", operationId: message.operationId, code: "mutation_rejected", error: error.message });
      });
      return;
    }
    if (message.messageType === "ack" || message.messageType === "test_ack") {
      const key = message.operationId || message.testId;
      const pending = this.pending.get(key);
      if (pending) {
        this.pending.delete(key);
        pending.resolve(message);
      }
      return;
    }
    throw new Error("Unsupported LAN message type");
  }

  sendRaw(socket, message) {
    const encoded = `${JSON.stringify(message)}\n`;
    if (Buffer.byteLength(encoded, "utf8") > MAX_MESSAGE_BYTES) throw new Error("LAN message exceeds size limit");
    socket.write(encoded);
  }

  rejectSocket(socket, error) {
    this.lastError = error.message;
    try { this.sendRaw(socket, { protocolVersion: PROTOCOL_VERSION, messageType: "error", code: "malformed_message" }); } catch (sendError) {}
    socket.destroy();
  }

  getActiveSocket() {
    if (this.socket && !this.socket.destroyed) return this.socket;
    for (const peer of this.peers) if (!peer.destroyed) return peer;
    return null;
  }

  rejectPending(error) {
    for (const pending of this.pending.values()) pending.reject(error);
    this.pending.clear();
  }

  async send(event) {
    if (!event || event.protocolVersion !== PROTOCOL_VERSION || event.messageType !== "mutation") throw new Error("LAN transport accepts only versioned mutation envelopes");
    if (!this.allowMutations) throw new Error("LAN mutation sending is disabled in test mode");
    const socket = this.getActiveSocket();
    if (!socket) throw new Error("LAN transport is not connected");
    return new Promise((resolve, reject) => {
      this.pending.set(event.operationId, { resolve, reject });
      try { this.sendRaw(socket, event); } catch (error) { this.pending.delete(event.operationId); reject(error); }
    });
  }

  async sendTestMessage(payload = {}) {
    const socket = this.getActiveSocket();
    if (!socket) throw new Error("LAN transport is not connected");
    const message = {
      protocolVersion: PROTOCOL_VERSION,
      messageType: "test",
      testId: crypto.randomUUID(),
      deviceId: this.deviceIdProvider(),
      payload: { testOnly: true, ...payload },
      createdAt: Date.now()
    };
    return new Promise((resolve, reject) => {
      this.pending.set(message.testId, { resolve, reject });
      try { this.sendRaw(socket, message); } catch (error) { this.pending.delete(message.testId); reject(error); }
    });
  }

  getLastTestMessage() {
    return this.lastTestMessage;
  }

  confirmTestMessage(testId) {
    return Boolean(this.lastTestMessage && this.lastTestMessage.testId === testId);
  }
}

module.exports = {
  LanTransport,
  getPrivateAddresses,
  isPrivateIPv4,
  validateEnvelope,
  validateTestMessage,
  MAX_MESSAGE_BYTES
};
