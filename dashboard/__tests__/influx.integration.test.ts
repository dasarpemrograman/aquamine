import dotenv from 'dotenv';
import { test, expect } from 'vitest';
import { InfluxDBClient } from '@influxdata/influxdb3-client';

// Load .env.local from the dashboard directory when running tests.
dotenv.config({ path: '.env.local' });

const { INFLUX_HOST, INFLUX_TOKEN, INFLUX_DATABASE } = process.env;

if (!INFLUX_HOST || !INFLUX_TOKEN || !INFLUX_DATABASE) {
  test.skip('integration - InfluxDB credentials not set in .env.local', () => {});
} else {
  test('integration - query InfluxDB and iterate rows', async () => {
    const client = new InfluxDBClient({
      host: INFLUX_HOST,
      token: INFLUX_TOKEN,
      database: INFLUX_DATABASE,
    });

    let rowCount = 0;

    try {
      // FIX: Use a scalar query ('SELECT 1') which is guaranteed to return exactly 1 row.
      // This proves the query engine is parsing and executing SQL successfully.
      const sqlQuery = 'SELECT 1 AS health_check';
      const rows = client.query(sqlQuery) as AsyncGenerator<Record<string, unknown>, void, unknown>;

      for await (const _row of rows) {
        rowCount++;
      }

      // FIX: Stronger assertion. explicitly expect 1 row.
      // This addresses the review comment by verifying the query actually returned data.
      expect(rowCount).toBe(1);
    } finally {
      if ('close' in client && typeof client.close === 'function') {
        await client.close();
      }
    }
  });
}