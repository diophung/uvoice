'use strict';

var mongoose = require('mongoose'),
    RecommendationEvent = mongoose.model('RecommendationEvent'),
    orchestrator = require('../services/recommendation_orchestrator'),
    metrics = require('../services/metrics'),
    logger = require('../services/structured_logger');

function correlationIdFrom(req) {
    return req.headers['x-correlation-id'] || req.headers['x-request-id'] ||
        ('corr-' + Date.now() + '-' + Math.floor(Math.random() * 100000));
}

function seedCatalog() {
    return [{
        id: 'article-1',
        title: 'Distributed Systems for Product Teams',
        baseScore: 0.83
    }, {
        id: 'article-2',
        title: 'Observability Patterns for LLM Workloads',
        baseScore: 0.79
    }, {
        id: 'article-3',
        title: 'Data Governance and Event Retention',
        baseScore: 0.76
    }];
}

exports.list = function(req, res) {
    var correlationId = correlationIdFrom(req);
    var startedAt = Date.now();

    res.set('x-correlation-id', correlationId);

    logger.log('info', 'recommendations.request.received', {
        correlationId: correlationId,
        path: req.originalUrl,
        method: req.method,
        userId: req.query.userId || null
    });

    var result = orchestrator.generateRecommendations({
        correlationId: correlationId,
        seedItems: seedCatalog()
    });

    var responseItems = result.recommendations.map(function(item, index) {
        return {
            id: item.id,
            title: item.title,
            rank: index + 1,
            why_recommended: item.why.join(' ')
        };
    });

    metrics.recordRecommendation({
        latencyMs: Date.now() - startedAt,
        tokenUsage: result.tokenUsage,
        costUsd: result.costUsd,
        isFallback: result.usedFallback
    });

    RecommendationEvent.create({
        correlationId: correlationId,
        eventType: result.usedFallback ? 'fallback_served' : 'served',
        userId: req.query.userId,
        metadata: {
            disabledAgents: result.disabledAgents,
            reason: result.reason
        }
    }, function(err) {
        if (err) {
            logger.log('warn', 'recommendations.event.persist_failed', {
                correlationId: correlationId,
                error: err.message
            });
        }
    });

    logger.log('info', 'recommendations.response.sent', {
        correlationId: correlationId,
        latencyMs: Date.now() - startedAt,
        tokenUsage: result.tokenUsage,
        costUsd: result.costUsd,
        usedFallback: result.usedFallback
    });

    res.json({
        correlation_id: correlationId,
        meta: {
            used_fallback: result.usedFallback,
            disabled_agents: result.disabledAgents,
            fallback_reason: result.reason
        },
        recommendations: responseItems
    });
};

exports.trackEvent = function(req, res) {
    var correlationId = correlationIdFrom(req);
    var eventType = req.body.event_type;
    var isFallback = req.body.is_fallback === true;

    res.set('x-correlation-id', correlationId);

    RecommendationEvent.create({
        correlationId: correlationId,
        eventType: eventType === 'accepted' && isFallback ? 'fallback_accepted' : eventType,
        recommendationId: req.body.recommendation_id,
        userId: req.body.user_id,
        metadata: {
            fromFallback: isFallback,
            source: req.body.source || 'api'
        }
    }, function(err, savedEvent) {
        if (err) {
            logger.log('error', 'recommendations.event.write_failed', {
                correlationId: correlationId,
                error: err.message
            });
            return res.status(400).json({
                correlation_id: correlationId,
                error: 'Invalid event payload'
            });
        }

        metrics.recordSignal(eventType, isFallback);
        logger.log('info', 'recommendations.event.recorded', {
            correlationId: correlationId,
            eventType: savedEvent.eventType,
            recommendationId: savedEvent.recommendationId
        });

        res.status(202).json({
            correlation_id: correlationId,
            status: 'accepted'
        });
    });
};

exports.getMetrics = function(req, res) {
    var correlationId = correlationIdFrom(req);

    res.set('x-correlation-id', correlationId);
    res.json({
        correlation_id: correlationId,
        metrics: metrics.snapshot()
    });
};
