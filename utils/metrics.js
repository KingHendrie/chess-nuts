let client = null;
let registry = null;
try {
    client = require('prom-client');
    registry = client.register;
} catch (e) {
    // prom-client not installed; provide no-op replacements
    client = null;
    registry = {
        metrics: async () => ''
    };
}

function createGauge(name, help, labels = []) {
    if (!client) return { set: () => {}, inc: () => {}, dec: () => {} };
    const g = new client.Gauge({ name, help, labelNames: labels });
    return g;
}

function createCounter(name, help, labels = []) {
    if (!client) return { inc: () => {} };
    return new client.Counter({ name, help, labelNames: labels });
}

module.exports = { client, registry, createGauge, createCounter };
