CREATE TABLE password_accounts (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  password_hash TEXT NOT NULL,
  email_verified_at INTEGER,
  updated_at INTEGER NOT NULL
);
CREATE TABLE auth_email_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  purpose TEXT NOT NULL CHECK(purpose IN ('verify','reset')),
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  UNIQUE(user_id,purpose)
);
CREATE TABLE auth_email_limits (
  email_hash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  window INTEGER NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY(email_hash,purpose)
);
CREATE TABLE auth_dev_mail (
  id TEXT PRIMARY KEY,
  recipient TEXT NOT NULL,
  purpose TEXT NOT NULL,
  link TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX auth_dev_mail_recipient ON auth_dev_mail(recipient,expires_at);
