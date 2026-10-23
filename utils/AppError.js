"use strict";

/**
 * AppError — canonical error thrown by all services.
 *
 * @property {number}      httpStatus   HTTP status to return to the client
 * @property {string|null} code         Provider-level status/response code
 * @property {string}      provider     "brassica_pmt" | "ecollect" | "gateway"
 * @property {object|null} raw          Full upstream response body (dev only)
 */
class AppError extends Error {
  constructor(message, httpStatus = 500, code = null, provider = "gateway", raw = null) {
    super(message);
    this.name = "AppError";
    this.httpStatus = httpStatus;
    this.code = code;
    this.provider = provider;
    this.raw = raw;
  }
}

module.exports = AppError;
