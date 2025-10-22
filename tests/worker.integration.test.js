jest.setTimeout(10000);

const computerJobQueue = require('../utils/computerJobQueue');
const stockfishWorker = require('../workers/stockfishWorker');

describe('Stockfish worker integration (in-memory)', () => {
    beforeAll(() => {
        // If REDIS_URL is set, skip since this test expects in-memory queue
        if (process.env.REDIS_URL) {
            console.warn('Skipping in-memory worker test because REDIS_URL is set');
            return;
        }
    });

    it('can start worker and enqueue a job', async () => {
        // Start worker
        stockfishWorker.start();

        // Enqueue a fake job (sessionId that doesn't exist) - should not throw
        const enqueued = await computerJobQueue.enqueueComputerMove('test-session-1', 5);
        expect(enqueued).toBe(true);

        // Stop worker after a short delay
        await new Promise((r) => setTimeout(r, 500));
        stockfishWorker.stop();
    });
});
