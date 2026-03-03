const { DomainError, normalizeUsageEvent } = require('../../../packages/domain/src');
const {
  resolveRate,
  parseMicros,
  resolveMinimumRequestMicros,
  calculateLlmCreditsMicros,
  calculateToolCreditsMicros
} = require('./costing');

function normalizeTimestamp(value) {
  if (!value) {
    return new Date().toISOString();
  }
  return new Date(value).toISOString();
}

function createLiteLlmHookHandlers({
  leaseStore,
  usageEmitter,
  rateCatalog,
  defaultRateId,
  now = () => new Date(),
  idFactory = () => Math.random().toString(36).slice(2, 12)
}) {
  if (!leaseStore || !usageEmitter || !rateCatalog) {
    throw new DomainError('leaseStore, usageEmitter, and rateCatalog are required', 'INVALID_HOOK_DEPS');
  }

  function ensureMetadata(metadata, fieldName) {
    const value = metadata[fieldName];
    if (!value || typeof value !== 'string') {
      throw new DomainError(`missing required metadata field: ${fieldName}`, 'INVALID_HOOK_METADATA', {
        field: fieldName
      });
    }
    return value;
  }

  async function ensureLeaseForActual({ orgId, actualMicros, chargedMicros }) {
    if (actualMicros === chargedMicros) {
      return;
    }

    if (actualMicros < chargedMicros) {
      await leaseStore.creditBack({
        orgId,
        amountMicros: chargedMicros - actualMicros
      });
      return;
    }

    const gap = actualMicros - chargedMicros;
    const reserve = await leaseStore.reserve({
      orgId,
      amountMicros: gap
    });

    if (!reserve.approved) {
      throw new DomainError('additional lease debit failed', 'LEASE_DEBIT_SHORTFALL', {
        orgId,
        requiredGapMicros: gap.toString(),
        remainingMicros: reserve.remainingMicros.toString()
      });
    }
  }

  function createUsageEvent({
    idempotencyKey,
    orgId,
    userId,
    runId,
    stepId,
    traceId,
    kind,
    units,
    creditsMicros,
    rateId,
    tsInitiated,
    tsCompleted,
    metadata
  }) {
    return normalizeUsageEvent({
      idempotency_key: idempotencyKey,
      org_id: orgId,
      user_id: userId,
      run_id: runId,
      step_id: stepId,
      trace_id: traceId || null,
      kind,
      units,
      credits_micros: creditsMicros.toString(),
      rate_id: rateId,
      ts_initiated: normalizeTimestamp(tsInitiated),
      ts_completed: normalizeTimestamp(tsCompleted),
      metadata: metadata || {}
    });
  }

  return {
    async preCallHook({ metadata = {}, requestDebitMicros }) {
      const orgId = ensureMetadata(metadata, 'org_id');
      const userId = metadata.user_id || null;
      const runId = metadata.run_id || `run_${idFactory()}`;
      const stepId = metadata.step_id || `step_${idFactory()}`;
      const rateId = metadata.rate_id || defaultRateId || rateCatalog.default_rate_id;
      const rate = resolveRate({ rateCatalog, rateId });
      const fallbackMicros = resolveMinimumRequestMicros({ rate });

      let debitMicros = fallbackMicros;
      const requestedDebit = requestDebitMicros ?? metadata.request_debit_micros;

      try {
        const parsed = parseMicros(requestedDebit, 'request_debit_micros');
        if (parsed > 0n) {
          debitMicros = parsed;
        }
      } catch (error) {
        // Missing/invalid request_debit_micros falls back to configured minimum.
      }

      const reserve = await leaseStore.reserve({
        orgId,
        amountMicros: debitMicros
      });

      if (!reserve.approved) {
        throw new DomainError('insufficient leased credits', 'INSUFFICIENT_LEASE_CREDITS', {
          orgId,
          remainingMicros: reserve.remainingMicros.toString()
        });
      }

      return {
        metadata: {
          ...metadata,
          org_id: orgId,
          user_id: userId,
          run_id: runId,
          step_id: stepId,
          rate_id: rateId,
          lease_debit_micros: debitMicros.toString(),
          lease_key: reserve.leaseId
        }
      };
    },

    async postCallHook({ metadata = {}, usage = {} }) {
      const orgId = ensureMetadata(metadata, 'org_id');
      const runId = ensureMetadata(metadata, 'run_id');
      const stepId = ensureMetadata(metadata, 'step_id');
      const rateId = metadata.rate_id || defaultRateId || rateCatalog.default_rate_id;
      const rate = resolveRate({ rateCatalog, rateId });

      const inputTokens = Number(usage.input_tokens || usage.prompt_tokens || 0);
      const outputTokens = Number(usage.output_tokens || usage.completion_tokens || 0);
      const actualMicros = calculateLlmCreditsMicros({
        rate,
        model: usage.model || metadata.model,
        inputTokens,
        outputTokens
      });

      const chargedMicros = parseMicros(metadata.lease_debit_micros, 'lease_debit_micros');
      await ensureLeaseForActual({
        orgId,
        actualMicros,
        chargedMicros
      });

      const usageEvent = createUsageEvent({
        idempotencyKey: `${runId}:${stepId}`,
        orgId,
        userId: metadata.user_id || null,
        runId,
        stepId,
        traceId: metadata.trace_id || usage.trace_id || null,
        kind: 'LLM',
        units: {
          input_tokens: inputTokens,
          output_tokens: outputTokens
        },
        creditsMicros: actualMicros,
        rateId,
        tsInitiated: usage.ts_initiated || metadata.ts_initiated || now().toISOString(),
        tsCompleted: usage.ts_completed || now().toISOString(),
        metadata: {
          model: usage.model || metadata.model || null,
          environment: metadata.environment || null
        }
      });

      const outbox = await usageEmitter.emitUsageEvent(usageEvent);
      return {
        outboxId: outbox.outboxId,
        usageEvent
      };
    },

    async mcpPostHook({ metadata = {}, tool = {} }) {
      const orgId = ensureMetadata(metadata, 'org_id');
      const runId = ensureMetadata(metadata, 'run_id');
      const stepId = ensureMetadata(metadata, 'step_id');
      const toolName = ensureMetadata(tool, 'name');

      const rateId = metadata.rate_id || defaultRateId || rateCatalog.default_rate_id;
      const rate = resolveRate({ rateCatalog, rateId });
      const toolCalls = Number(tool.calls || 1);
      const creditsMicros = calculateToolCreditsMicros({
        rate,
        toolName,
        toolCalls
      });

      if (creditsMicros > 0n) {
        const reserve = await leaseStore.reserve({
          orgId,
          amountMicros: creditsMicros
        });

        if (!reserve.approved) {
          throw new DomainError('insufficient leased credits for tool usage', 'INSUFFICIENT_LEASE_CREDITS', {
            orgId,
            toolName,
            remainingMicros: reserve.remainingMicros.toString()
          });
        }
      }

      const baseIdempotencyKey = `${runId}:${stepId}:tool:${toolName}`;
      const toolEvent = createUsageEvent({
        idempotencyKey: baseIdempotencyKey,
        orgId,
        userId: metadata.user_id || null,
        runId,
        stepId,
        traceId: metadata.trace_id || null,
        kind: 'TOOL',
        units: {
          tool_calls: toolCalls
        },
        creditsMicros,
        rateId,
        tsInitiated: tool.ts_initiated || now().toISOString(),
        tsCompleted: tool.ts_completed || now().toISOString(),
        metadata: {
          tool_name: toolName,
          environment: metadata.environment || null
        }
      });

      await usageEmitter.emitUsageEvent(toolEvent);

      if (!tool.failed) {
        return { usageEvent: toolEvent };
      }

      if (creditsMicros > 0n) {
        await leaseStore.creditBack({
          orgId,
          amountMicros: creditsMicros
        });
      }

      const refundEvent = createUsageEvent({
        idempotencyKey: `${baseIdempotencyKey}:refund`,
        orgId,
        userId: metadata.user_id || null,
        runId,
        stepId,
        traceId: metadata.trace_id || null,
        kind: 'TOOL',
        units: {
          tool_calls: toolCalls
        },
        creditsMicros,
        rateId,
        tsInitiated: now().toISOString(),
        tsCompleted: now().toISOString(),
        metadata: {
          tool_name: toolName,
          is_refund: true,
          lago_event_code: 'refund_step',
          refund_reason: tool.error_code || 'tool_failed'
        }
      });

      await usageEmitter.emitUsageEvent(refundEvent);
      return {
        usageEvent: toolEvent,
        refundEvent
      };
    }
  };
}

module.exports = {
  createLiteLlmHookHandlers
};
