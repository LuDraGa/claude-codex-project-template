const fs = require('fs');
const path = require('path');
const { DomainError, creditsToMicros, CREDIT_MICROS_PER_CREDIT } = require('../../domain/src');

function readJson(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function validatePackageCatalog(config) {
  if (!config || typeof config !== 'object') {
    throw new DomainError('package config must be an object', 'INVALID_PACKAGE_CONFIG');
  }

  if (!Array.isArray(config.packages) || config.packages.length === 0) {
    throw new DomainError('package config must include non-empty packages array', 'INVALID_PACKAGE_CONFIG');
  }

  const seenCodes = new Set();

  for (const item of config.packages) {
    if (seenCodes.has(item.code)) {
      throw new DomainError(`duplicate package code: ${item.code}`, 'DUPLICATE_PACKAGE_CODE');
    }
    seenCodes.add(item.code);

    if (!Number.isInteger(item.amount_minor) || item.amount_minor < 10000) {
      throw new DomainError(`invalid amount_minor for package ${item.code}`, 'INVALID_PACKAGE_AMOUNT');
    }

    if (!Number.isInteger(item.credits) || item.credits <= 0) {
      throw new DomainError(`invalid credits for package ${item.code}`, 'INVALID_PACKAGE_CREDITS');
    }

    const expectedMicros = creditsToMicros(item.credits);
    const actualMicros = BigInt(item.credits_micros);

    if (expectedMicros !== actualMicros) {
      throw new DomainError(`credits_micros mismatch for package ${item.code}`, 'PACKAGE_MICROS_MISMATCH', {
        expectedMicros: expectedMicros.toString(),
        actualMicros: actualMicros.toString()
      });
    }
  }

  return config;
}

function validateRateCatalog(config) {
  if (!config || typeof config !== 'object') {
    throw new DomainError('rate catalog must be an object', 'INVALID_RATE_CONFIG');
  }

  if (!Array.isArray(config.rates) || config.rates.length === 0) {
    throw new DomainError('rate catalog must include non-empty rates array', 'INVALID_RATE_CONFIG');
  }

  if (!config.default_rate_id) {
    throw new DomainError('rate catalog must define default_rate_id', 'INVALID_RATE_CONFIG');
  }

  return config;
}

function loadStaticPricingConfig(options = {}) {
  const packagesPath = options.packagesPath || path.resolve(__dirname, '../config/credit-packages.v1.json');
  const ratesPath = options.ratesPath || path.resolve(__dirname, '../config/rate-catalog.v1.json');

  const packageCatalog = validatePackageCatalog(readJson(packagesPath));
  const rateCatalog = validateRateCatalog(readJson(ratesPath));

  const packageMicrosPerCredit = BigInt(packageCatalog.credit_micros_per_credit);
  const rateMicrosPerCredit = BigInt(rateCatalog.credit_micros_per_credit);

  if (packageMicrosPerCredit !== CREDIT_MICROS_PER_CREDIT) {
    throw new DomainError('package catalog credit_micros_per_credit mismatch', 'MICROS_BASE_MISMATCH');
  }

  if (rateMicrosPerCredit !== CREDIT_MICROS_PER_CREDIT) {
    throw new DomainError('rate catalog credit_micros_per_credit mismatch', 'MICROS_BASE_MISMATCH');
  }

  return {
    packageCatalog,
    rateCatalog
  };
}

module.exports = {
  loadStaticPricingConfig
};
