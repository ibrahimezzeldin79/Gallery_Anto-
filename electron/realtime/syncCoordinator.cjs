const { PROTOCOL_VERSION } = require("./transportInterface.cjs");

function validateAcknowledgement(ack, operationId) {
  if (!ack || ack.protocolVersion !== PROTOCOL_VERSION || ack.messageType !== "ack") {
    throw new Error("Invalid sync acknowledgement");
  }
  if (ack.operationId !== operationId) {
    throw new Error("Sync acknowledgement operation mismatch");
  }
  if (!["accepted", "applied", "duplicate"].includes(ack.status)) {
    throw new Error("Unsupported sync acknowledgement status");
  }
}

class SyncCoordinator {
  constructor({ syncApi, transport }) {
    if (!syncApi) throw new Error("SyncCoordinator requires syncApi");
    if (!transport || typeof transport.send !== "function") {
      throw new Error("SyncCoordinator requires a transport with send(event)");
    }
    this.syncApi = syncApi;
    this.transport = transport;
    this.running = false;
    this.processing = false;
    this.lastRunAt = null;
    this.lastError = null;
    this.lastProcessedCount = 0;
  }

  start() {
    this.running = true;
    this.lastError = null;
    return this.getStatus();
  }

  stop() {
    this.running = false;
    return this.getStatus();
  }

  setTransport(transport) {
    if (!transport || typeof transport.send !== "function") {
      throw new Error("SyncCoordinator requires a transport with send(event)");
    }
    if (this.processing) throw new Error("Cannot change transport while processing");
    this.transport = transport;
    return this.getStatus();
  }

  getStatus() {
    return {
      running: this.running,
      processing: this.processing,
      lastRunAt: this.lastRunAt,
      lastError: this.lastError,
      lastProcessedCount: this.lastProcessedCount
    };
  }

  async processPending(limit = 100) {
    if (!this.running) return { processed: 0, skipped: true, reason: "stopped" };
    if (this.processing) return { processed: 0, skipped: true, reason: "already_processing" };

    this.processing = true;
    this.lastRunAt = Date.now();
    this.lastError = null;
    this.lastProcessedCount = 0;

    try {
      const operations = this.syncApi.getPendingOperations(limit);
      for (const operation of operations) {
        const event = {
          protocolVersion: PROTOCOL_VERSION,
          messageType: "mutation",
          operationId: operation.operationId,
          deviceId: operation.deviceId,
          entityTable: operation.entityTable,
          entityId: operation.entityId,
          operationType: operation.operationType,
          payload: operation.payload,
          createdAt: operation.createdAt
        };

        try {
          const acknowledgement = await this.transport.send(event);
          validateAcknowledgement(acknowledgement, operation.operationId);
          this.syncApi.markOperationSynced(operation.operationId);
          this.lastProcessedCount += 1;
        } catch (error) {
          this.syncApi.markOperationFailed(operation.operationId, error.message);
          this.lastError = error.message;
        }
      }
      return { processed: this.lastProcessedCount, skipped: false };
    } finally {
      this.processing = false;
    }
  }
}

module.exports = {
  SyncCoordinator,
  validateAcknowledgement
};
