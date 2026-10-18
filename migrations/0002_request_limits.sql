CREATE TABLE api_rate_limits (user_id TEXT PRIMARY KEY REFERENCES users(id), window INTEGER NOT NULL, count INTEGER NOT NULL);
