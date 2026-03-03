class DomainError extends Error {
  constructor(message, code = 'DOMAIN_ERROR', details = undefined) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}

class IntegrationError extends Error {
  constructor(message, code = 'INTEGRATION_ERROR', details = undefined) {
    super(message);
    this.name = 'IntegrationError';
    this.code = code;
    this.details = details;
  }
}

class InfrastructureError extends Error {
  constructor(message, code = 'INFRASTRUCTURE_ERROR', details = undefined) {
    super(message);
    this.name = 'InfrastructureError';
    this.code = code;
    this.details = details;
  }
}

module.exports = {
  DomainError,
  IntegrationError,
  InfrastructureError
};
