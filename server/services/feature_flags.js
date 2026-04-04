'use strict';

function boolFlag(value, defaultValue) {
    if (typeof value === 'undefined') {
        return defaultValue;
    }
    return String(value).toLowerCase() === 'true';
}

exports.getFlags = function() {
    return {
        disableSemanticAgent: boolFlag(process.env.RECO_DISABLE_SEMANTIC_AGENT, false),
        disableCollaborativeAgent: boolFlag(process.env.RECO_DISABLE_COLLAB_AGENT, false),
        disableTrendingAgent: boolFlag(process.env.RECO_DISABLE_TRENDING_AGENT, false),
        forceSafeFallback: boolFlag(process.env.RECO_FORCE_SAFE_FALLBACK, false),
        safeFallbackOnUnhealthy: boolFlag(process.env.RECO_SAFE_FALLBACK_ON_UNHEALTHY, true)
    };
};

exports.isServiceHealthy = function() {
    return (process.env.RECO_SERVICE_HEALTH || 'healthy') === 'healthy';
};
