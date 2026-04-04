'use strict';

var metricsStore = {
    counters: {
        recommendations: 0,
        fallbacks: 0,
        accepted: 0,
        dismissed: 0
    },
    totals: {
        latencyMs: 0,
        tokenUsage: 0,
        costUsd: 0
    },
    byAgent: {}
};

function ensureAgent(agentName) {
    if (!metricsStore.byAgent[agentName]) {
        metricsStore.byAgent[agentName] = {
            calls: 0,
            latencyMs: 0,
            tokenUsage: 0,
            costUsd: 0
        };
    }
    return metricsStore.byAgent[agentName];
}

exports.recordRecommendation = function(data) {
    metricsStore.counters.recommendations += 1;
    metricsStore.totals.latencyMs += data.latencyMs || 0;
    metricsStore.totals.tokenUsage += data.tokenUsage || 0;
    metricsStore.totals.costUsd += data.costUsd || 0;

    if (data.isFallback) {
        metricsStore.counters.fallbacks += 1;
    }
};

exports.recordAgentStep = function(agentName, data) {
    var agentMetric = ensureAgent(agentName);

    agentMetric.calls += 1;
    agentMetric.latencyMs += data.latencyMs || 0;
    agentMetric.tokenUsage += data.tokenUsage || 0;
    agentMetric.costUsd += data.costUsd || 0;
};

exports.recordSignal = function(signalType, isFallback) {
    if (signalType === 'accepted') {
        metricsStore.counters.accepted += 1;
    }

    if (signalType === 'dismissed') {
        metricsStore.counters.dismissed += 1;
    }

    if (signalType === 'accepted' && isFallback) {
        metricsStore.counters.fallbackAccepted = (metricsStore.counters.fallbackAccepted || 0) + 1;
    }
};

exports.snapshot = function() {
    var recommendations = metricsStore.counters.recommendations || 1;
    var avgLatency = metricsStore.totals.latencyMs / recommendations;
    var fallbackRate = metricsStore.counters.fallbacks / recommendations;
    var acceptanceRate = metricsStore.counters.accepted / recommendations;

    return {
        counters: metricsStore.counters,
        totals: metricsStore.totals,
        averages: {
            latencyMs: Number(avgLatency.toFixed(2)),
            tokenUsage: Number((metricsStore.totals.tokenUsage / recommendations).toFixed(2)),
            costUsd: Number((metricsStore.totals.costUsd / recommendations).toFixed(6)),
            fallbackRate: Number(fallbackRate.toFixed(4)),
            acceptanceRate: Number(acceptanceRate.toFixed(4))
        },
        byAgent: metricsStore.byAgent
    };
};
