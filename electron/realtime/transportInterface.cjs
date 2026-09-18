const PROTOCOL_VERSION = 1;

class SyncTransport {
  async send(_event) {
    throw new Error("Sync transport must implement send(event)");
  }
}

class InMemoryTransport extends SyncTransport {
  constructor(options = {}) {
    super();
    this.events = [];
    this.onEvent = options.onEvent || null;
    this.failNext = false;
  }

  async send(event) {
    this.events.push(event);
    if (this.failNext) {
      this.failNext = false;
      throw new Error("In-memory transport failure");
    }
    if (this.onEvent) await this.onEvent(event);
    return {
      protocolVersion: PROTOCOL_VERSION,
      messageType: "ack",
      operationId: event.operationId,
      deviceId: event.deviceId,
      status: "applied",
      acknowledgedAt: Date.now()
    };
  }
}

module.exports = {
  PROTOCOL_VERSION,
  SyncTransport,
  InMemoryTransport
};
