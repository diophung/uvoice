'use strict';

var metrics = require('./metrics'),
    featureFlags = require('./feature_flags'),
    logger = require('./structured_logger');

function runAgent(agentName, items, correlationId) {
    var startedAt = Date.now();
    var latencyMs = Math.floor(Math.random() * 30) + 10;
    var tokenUsage = Math.floor(Math.random() * 180) + 40;
    var costUsd = Number((tokenUsage * 0.000002).toFixed(6));

    var scored = items.map(function(item, index) {
        return {
            id: item.id,
            title: item.title,
            score: item.baseScore + (0.05 * (items.length - index)),
            explanation: agentName + ' agent identified relevance using behavioral and content match signals.'
        };
    });

    var elapsedMs = Date.now() - startedAt + latencyMs;
    metrics.recordAgentStep(agentName, {
        latencyMs: elapsedMs,
        tokenUsage: tokenUsage,
        costUsd: costUsd
    });

    logger.log('info', 'orchestrator.step.complete', {
        correlationId: correlationId,
        step: agentName,
        latencyMs: elapsedMs,
        tokenUsage: tokenUsage,
        costUsd: costUsd
    });

    return {
        items: scored,
        latencyMs: elapsedMs,
        tokenUsage: tokenUsage,
        costUsd: costUsd
    };
}

function combineResults(results) {
    var combined = {};
    results.forEach(function(result) {
        result.items.forEach(function(item) {
            if (!combined[item.id]) {
                combined[item.id] = {
                    id: item.id,
                    title: item.title,
                    score: 0,
                    why: []
                };
            }
            combined[item.id].score += item.score;
            combined[item.id].why.push(item.explanation);
        });
    });

    return Object.keys(combined).map(function(key) {
        return combined[key];
    }).sort(function(a, b) {
        return b.score - a.score;
    });
}

function safeFallbackRanking(seedItems) {
    return seedItems.sort(function(a, b) {
        return b.baseScore - a.baseScore;
    }).map(function(item) {
        return {
            id: item.id,
            title: item.title,
            score: item.baseScore,
            why: ['Safe fallback ranking by deterministic popularity and recency baseline.']
        };
    });
}

exports.generateRecommendations = function(options) {
    var flags = featureFlags.getFlags();
    var isHealthy = featureFlags.isServiceHealthy();
    var correlationId = options.correlationId;
    var seedItems = options.seedItems || [];
    var start = Date.now();
    var tokenUsage = 0;
    var costUsd = 0;
    var usedFallback = false;
    var stepResults = [];

    logger.log('info', 'orchestrator.start', {
        correlationId: correlationId,
        flags: flags,
        serviceHealthy: isHealthy
    });

    if (flags.forceSafeFallback || (flags.safeFallbackOnUnhealthy && !isHealthy)) {
        usedFallback = true;
        var fallbackRecommendations = safeFallbackRanking(seedItems);
        return {
            recommendations: fallbackRecommendations,
            usedFallback: usedFallback,
            latencyMs: Date.now() - start,
            tokenUsage: tokenUsage,
            costUsd: costUsd,
            disabledAgents: [],
            reason: 'Service degraded or fallback forced by feature flag.'
        };
    }

    var disabledAgents = [];

    if (!flags.disableSemanticAgent) {
        stepResults.push(runAgent('semantic', seedItems, correlationId));
    } else {
        disabledAgents.push('semantic');
    }

    if (!flags.disableCollaborativeAgent) {
        stepResults.push(runAgent('collaborative', seedItems, correlationId));
    } else {
        disabledAgents.push('collaborative');
    }

    if (!flags.disableTrendingAgent) {
        stepResults.push(runAgent('trending', seedItems, correlationId));
    } else {
        disabledAgents.push('trending');
    }

    if (!stepResults.length) {
        usedFallback = true;
        return {
            recommendations: safeFallbackRanking(seedItems),
            usedFallback: usedFallback,
            latencyMs: Date.now() - start,
            tokenUsage: 0,
            costUsd: 0,
            disabledAgents: disabledAgents,
            reason: 'All agents disabled by feature flags.'
        };
    }

    stepResults.forEach(function(step) {
        tokenUsage += step.tokenUsage;
        costUsd += step.costUsd;
    });

    return {
        recommendations: combineResults(stepResults),
        usedFallback: usedFallback,
        latencyMs: Date.now() - start,
        tokenUsage: tokenUsage,
        costUsd: Number(costUsd.toFixed(6)),
        disabledAgents: disabledAgents,
        reason: null
    };
};
