'use strict';

exports.log = function(level, message, context) {
    var payload = {
        timestamp: new Date().toISOString(),
        level: level,
        message: message,
        context: context || {}
    };

    console.log(JSON.stringify(payload));
};
