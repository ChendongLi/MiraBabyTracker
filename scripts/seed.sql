-- Seed: Insert Mira
-- After running this, copy the generated UUID into api service .env as BABY_ID

INSERT INTO babies (name, chinese_name, birth_date)
VALUES ('Mira', '啵儿啵儿', '2026-01-01')
RETURNING id, name, chinese_name;
