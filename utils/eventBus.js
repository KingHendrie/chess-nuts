const EventEmitter = require('events');

let bus = new EventEmitter();

if (process.env.REDIS_URL) {
	try {
		const IORedis = require('ioredis');
		const pub = new IORedis(process.env.REDIS_URL);
		const sub = new IORedis(process.env.REDIS_URL);
		sub.subscribe('eventbus');
		sub.on('message', (channel, message) => {
			try {
				const { event, payload } = JSON.parse(message);
				bus.emit(event, payload);
			} catch (e) {
				// ignore
			}
		});

		bus.publish = async (event, payload) => {
			await pub.publish('eventbus', JSON.stringify({ event, payload }));
		};
		// override emit to also publish
		const origEmit = bus.emit.bind(bus);
		bus.emit = (event, payload) => {
			origEmit(event, payload);
			bus.publish(event, payload).catch(() => {});
		};
	} catch (e) {
		// fallback to in-memory bus
		bus = new EventEmitter();
	}
}

module.exports = bus;
