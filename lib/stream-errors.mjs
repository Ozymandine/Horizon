import { RelayError } from '../services/stream-relay/security.mjs';

export class StreamError extends RelayError {
  constructor(message, status, code) { super(message, status); this.code = code; }
}
