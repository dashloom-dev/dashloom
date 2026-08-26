CREATE TABLE IF NOT EXISTS dashloom_metrics_daily (
  metric_date TEXT NOT NULL CHECK (metric_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  metric TEXT NOT NULL CHECK (length(metric) BETWEEN 2 AND 80),
  value REAL NOT NULL,
  dimensions_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (metric_date, metric, dimensions_json)
);

CREATE INDEX IF NOT EXISTS idx_dashloom_metrics_daily_date
  ON dashloom_metrics_daily(metric_date);

-- Populate this aggregate table from your application. Never place raw events,
-- email addresses, tokens, request bodies, or other personal data in it.
-- Example shape only (intentionally not executed):
-- INSERT INTO dashloom_metrics_daily (metric_date, metric, value, dimensions_json)
-- VALUES (date('now'), 'active_users', YOUR_REAL_AGGREGATE, '{"environment":"production"}')
-- ON CONFLICT(metric_date, metric, dimensions_json) DO UPDATE SET value = excluded.value;
