CREATE DATABASE IF NOT EXISTS rewriting_tool
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE rewriting_tool;

CREATE TABLE IF NOT EXISTS roles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(40) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_roles_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_accounts (
  id BIGINT NOT NULL AUTO_INCREMENT,
  username VARCHAR(80) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  enabled BIT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_accounts_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_profiles (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id BIGINT NOT NULL,
  full_name VARCHAR(160) NOT NULL,
  email VARCHAR(160) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_profiles_user_id (user_id),
  CONSTRAINT fk_user_profiles_user
    FOREIGN KEY (user_id) REFERENCES user_accounts (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_roles (
  user_id BIGINT NOT NULL,
  role_id BIGINT NOT NULL,
  PRIMARY KEY (user_id, role_id),
  KEY idx_user_roles_role_id (role_id),
  CONSTRAINT fk_user_roles_user
    FOREIGN KEY (user_id) REFERENCES user_accounts (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_user_roles_role
    FOREIGN KEY (role_id) REFERENCES roles (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS prompt_settings (
  mode VARCHAR(40) NOT NULL,
  label VARCHAR(120) NOT NULL,
  description VARCHAR(500) NOT NULL,
  prompt_instruction TEXT NOT NULL,
  output_instruction TEXT NULL,
  enabled BIT NOT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (mode)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_prompt_settings (
  id BIGINT NOT NULL AUTO_INCREMENT,
  owner_id BIGINT NOT NULL,
  mode VARCHAR(40) NOT NULL,
  prompt_instruction TEXT NULL,
  output_instruction TEXT NULL,
  updated_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_user_prompt_settings_owner_mode (owner_id, mode),
  CONSTRAINT fk_user_prompt_settings_owner
    FOREIGN KEY (owner_id) REFERENCES user_accounts (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS rewrite_history (
  id BIGINT NOT NULL AUTO_INCREMENT,
  original_text LONGTEXT NOT NULL,
  rewritten_text LONGTEXT NOT NULL,
  vocabulary_suggestions TEXT NULL,
  avoid_words TEXT NULL,
  evaluation TEXT NULL,
  mode VARCHAR(40) NOT NULL,
  created_at DATETIME(6) NOT NULL,
  owner_id BIGINT NULL,
  PRIMARY KEY (id),
  KEY idx_rewrite_history_owner_id (owner_id),
  CONSTRAINT fk_rewrite_history_owner
    FOREIGN KEY (owner_id) REFERENCES user_accounts (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT,
  actor_id BIGINT NULL,
  action VARCHAR(80) NOT NULL,
  details TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_admin_audit_logs_actor_id (actor_id),
  CONSTRAINT fk_admin_audit_logs_actor
    FOREIGN KEY (actor_id) REFERENCES user_accounts (id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGINT NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(160) NOT NULL,
  subject VARCHAR(160) NOT NULL,
  message TEXT NOT NULL,
  created_at DATETIME(6) NOT NULL,
  owner_id BIGINT NULL,
  PRIMARY KEY (id),
  KEY idx_contact_messages_owner_id (owner_id),
  CONSTRAINT fk_contact_messages_owner
    FOREIGN KEY (owner_id) REFERENCES user_accounts (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO roles (name) VALUES ('ADMIN'), ('USER');

INSERT IGNORE INTO prompt_settings (mode, label, description, prompt_instruction, output_instruction, enabled, updated_at)
VALUES
  (
    'GRAMMAR_FIX',
    'Grammar fix',
    'Clean grammar, spelling, punctuation, and capitalization while keeping the same meaning.',
    'Clean grammar, spelling, punctuation, capitalization, and sentence endings while keeping the same meaning and writing level.',
    'Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.',
    b'1',
    NOW(6)
  ),
  (
    'ACADEMIC_REWRITE',
    'Academic rewrite',
    'Make the writing sound more formal, structured, and school-appropriate.',
    'Rewrite the text in a more formal academic style with clearer structure, school-appropriate vocabulary, and the same main idea.',
    'Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.',
    b'1',
    NOW(6)
  ),
  (
    'SIMPLE_REWRITE',
    'Simple rewrite',
    'Rewrite the text in clearer and easier English.',
    'Rewrite the text in clearer and easier English using simple sentence structure while preserving the student''s meaning.',
    'Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.',
    b'1',
    NOW(6)
  ),
  (
    'SHORTER_VERSION',
    'Shorter version',
    'Reduce the text to the most important points.',
    'Reduce the text to the most important points. Remove repetition and keep the final answer concise.',
    'Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.',
    b'1',
    NOW(6)
  ),
  (
    'LONGER_VERSION',
    'Longer version',
    'Expand the text with clearer detail and explanation.',
    'Expand the text with clearer detail, explanation, and transitions without inventing facts beyond the student''s original meaning.',
    'Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.',
    b'1',
    NOW(6)
  ),
  (
    'PARAPHRASE',
    'Paraphrase',
    'Rewrite the text with different wording while preserving the main idea.',
    'Rewrite the text with different wording and sentence structure while preserving the main idea and avoiding plagiarism-like copying.',
    'Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.',
    b'1',
    NOW(6)
  ),
  (
    'LEVEL_1_ADVANCED',
    'Mode 1 - C1-C2 Advanced',
    'Precise vocabulary, controlled complex sentences, and advanced neutral student writing.',
    'Rewrite at C1-C2 advanced student level. Preserve meaning, facts, paragraph structure, citations, order, and student flow while using precise academic vocabulary and controlled complex sentences.',
    'Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.',
    b'1',
    NOW(6)
  ),
  (
    'LEVEL_2_CLEAR',
    'Mode 2 - B2-C1 Clear',
    'Strong readable academic wording that is less dense than advanced writing.',
    'Rewrite at B2-C1 clear student level. Use strong readable academic wording, medium-developed sentences, and less density than advanced mode while preserving all content and order.',
    'Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.',
    b'1',
    NOW(6)
  ),
  (
    'LEVEL_3_NATURAL',
    'Mode 3 - B1-B2 Natural',
    'Normal student assignment writing with common academic words and medium sentences.',
    'Rewrite at B1-B2 natural student level. Use normal assignment English, common academic words, medium sentences, and keep the same meaning, structure, and flow.',
    'Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.',
    b'1',
    NOW(6)
  ),
  (
    'LEVEL_4_SIMPLE',
    'Mode 4 - A2-B1 Simple',
    'Simple assignment English with short to medium sentences.',
    'Rewrite at A2-B1 simple student level. Use simple words, short to medium sentences, and keep all facts, citations, paragraph order, and important details.',
    'Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.',
    b'1',
    NOW(6)
  ),
  (
    'LEVEL_5_BASIC',
    'Mode 5 - A1-A2 Basic',
    'Very simple words, short direct sentences, and full meaning preserved.',
    'Rewrite at A1-A2 basic student level. Use very common words and short direct sentences while preserving the full real meaning, order, and required terms.',
    'Return only the rewritten student text. Do not add explanations, labels, markdown, quotes, score text, or checklist text.',
    b'1',
    NOW(6)
  );
