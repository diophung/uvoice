'use strict';

var recommendations = require('../controllers/recommendations');

module.exports = function(app) {
    app.route('/api/recommendations')
        .get(recommendations.list);

    app.route('/api/recommendations/events')
        .post(recommendations.trackEvent);

    app.route('/api/recommendations/metrics')
        .get(recommendations.getMetrics);
};
