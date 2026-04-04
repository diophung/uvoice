'use strict';

var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var RecommendationEventSchema = new Schema({
    correlationId: {
        type: String,
        index: true
    },
    eventType: {
        type: String,
        required: true,
        enum: ['served', 'accepted', 'dismissed', 'fallback_served', 'fallback_accepted']
    },
    recommendationId: String,
    userId: String,
    metadata: Schema.Types.Mixed,
    archived: {
        type: Boolean,
        default: false
    },
    archivedAt: Date,
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    },
    expiresAt: {
        type: Date,
        index: {
            expires: 0
        }
    }
});

RecommendationEventSchema.pre('save', function(next) {
    var retentionDays = parseInt(process.env.RECOMMENDATION_EVENT_RETENTION_DAYS || '30', 10);

    if (!this.expiresAt) {
        this.expiresAt = new Date(Date.now() + (retentionDays * 24 * 60 * 60 * 1000));
    }

    if (this.archived && !this.archivedAt) {
        this.archivedAt = new Date();
    }

    next();
});

mongoose.model('RecommendationEvent', RecommendationEventSchema);
