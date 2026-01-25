import dotenv from 'dotenv';
import { test, expect } from 'vitest';
import { InfluxDBClient } from '@influxdata/influxdb3-client';

// Load .env.local from the dashboard directory when running tests.
dotenv.config({ path: '.env.local' });

const { INFLUX_HOST, INFLUX_TOKEN, INFLUX_DATABASE } = process.env;

if (!INFLUX_HOST || !INFLUX_TOKEN || !INFLUX_DATABASE) {
  // Skip the whole test file when credentials are not provided.
  test.skip('integration - InfluxDB credentials not set in .env.local', () => {});
} else {
  test('integration - query InfluxDB and iterate rows', async () => {
    // Create a real client.
    const client = new InfluxDBClient({
      host: INFLUX_HOST,
      token: INFLUX_TOKEN,
      database: INFLUX_DATABASE,
    });

    let rowCount = 0;

    try {
      // FIX: Use SQL instead of Flux.
      // We query 'information_schema.tables' because it guarantees a valid response
      // (even if empty) regardless of what custom data is in your bucket.
      const sqlQuery = 'SELECT * FROM information_schema.tables';

      // We explicitly type the generator to Record<string, unknown> to avoid 'any'.
      const rows = client.query(sqlQuery) as AsyncGenerator<Record<string, unknown>, void, unknown>;

      for await (const _row of rows) {
        rowCount++;
      }

      // We expect >= 0. If the DB is completely empty, 0 is valid.
      expect(rowCount).toBeGreaterThanOrEqual(0);
    } finally {
      // Safely close if the method exists (defensive coding without 'any').
      if ('close' in client && typeof client.close === 'function') {
        await client.close();
      }
    }
  });
}