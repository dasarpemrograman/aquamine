-- Seed data for initial notification recipient testing.
-- Run this against your dev database if notification_recipients is empty.

INSERT INTO notification_recipients (name, phone, email, is_active, notify_warning, notify_critical)
VALUES ('Demo Admin', '628123456789', 'admin@example.com', true, true, true);
