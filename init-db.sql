-- PostgreSQL initialization script for MintSprout
-- This script sets up the database schema and initial data

-- Create database if it doesn't exist (handled by docker-compose)

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create families table
CREATE TABLE IF NOT EXISTS families (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK (role IN ('parent', 'child')),
    family_id INTEGER NOT NULL REFERENCES families(id),
    name TEXT NOT NULL,
    age INTEGER
);

-- Create children table
CREATE TABLE IF NOT EXISTS children (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    family_id INTEGER NOT NULL REFERENCES families(id),
    name TEXT NOT NULL,
    age INTEGER NOT NULL,
    total_earned DECIMAL(10,2) DEFAULT 0.00,
    completed_jobs INTEGER DEFAULT 0,
    learning_streak INTEGER DEFAULT 0
);

-- Create jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    amount DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('assigned', 'in_progress', 'completed', 'approved')),
    recurrence TEXT NOT NULL CHECK (recurrence IN ('once', 'daily', 'weekly', 'monthly')),
    assigned_to_id INTEGER NOT NULL REFERENCES children(id),
    family_id INTEGER NOT NULL REFERENCES families(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create payments table
CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    job_id INTEGER NOT NULL REFERENCES jobs(id),
    child_id INTEGER NOT NULL REFERENCES children(id),
    amount DECIMAL(10,2) NOT NULL,
    spending_amount DECIMAL(10,2) NOT NULL,
    savings_amount DECIMAL(10,2) NOT NULL,
    roth_ira_amount DECIMAL(10,2) NOT NULL,
    brokerage_amount DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create allocation_settings table
CREATE TABLE IF NOT EXISTS allocation_settings (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id),
    spending_percentage INTEGER DEFAULT 20,
    savings_percentage INTEGER DEFAULT 30,
    roth_ira_percentage INTEGER DEFAULT 25,
    brokerage_percentage INTEGER DEFAULT 25
);

-- Create lessons table
CREATE TABLE IF NOT EXISTS lessons (
    id SERIAL PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN ('earning', 'saving', 'spending', 'investing', 'donating')),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    video_url TEXT,
    is_custom BOOLEAN DEFAULT FALSE,
    family_id INTEGER REFERENCES families(id)
);

-- Create quizzes table
CREATE TABLE IF NOT EXISTS quizzes (
    id SERIAL PRIMARY KEY,
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    question TEXT NOT NULL,
    options TEXT[] NOT NULL,
    correct_answer INTEGER NOT NULL
);

-- Create learning_progress table
CREATE TABLE IF NOT EXISTS learning_progress (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id),
    lesson_id INTEGER NOT NULL REFERENCES lessons(id),
    completed BOOLEAN DEFAULT FALSE,
    quiz_score INTEGER
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default family
INSERT INTO families (name) VALUES ('Demo Family') ON CONFLICT DO NOTHING;

-- Insert default users (passwords are hashed for 'password123')
INSERT INTO users (username, password, role, family_id, name, age) VALUES 
    ('parent', '$2b$10$rOW8w/H1Ld8/LJ2l3K9kGO8vZ1nKJo5sXKl3Hms5wRtFQgR1m0pzS', 'parent', 1, 'Demo Parent', NULL),
    ('emma', '$2b$10$rOW8w/H1Ld8/LJ2l3K9kGO8vZ1nKJo5sXKl3Hms5wRtFQgR1m0pzS', 'child', 1, 'Emma', 8),
    ('jake', '$2b$10$rOW8w/H1Ld8/LJ2l3K9kGO8vZ1nKJo5sXKl3Hms5wRtFQgR1m0pzS', 'child', 1, 'Jake', 12)
ON CONFLICT (username) DO NOTHING;

-- Insert default children
INSERT INTO children (user_id, family_id, name, age) VALUES 
    (2, 1, 'Emma', 8),
    (3, 1, 'Jake', 12)
ON CONFLICT DO NOTHING;

-- Insert default allocation settings
INSERT INTO allocation_settings (child_id, spending_percentage, savings_percentage, roth_ira_percentage, brokerage_percentage) VALUES 
    (1, 20, 30, 25, 25),
    (2, 20, 30, 25, 25)
ON CONFLICT DO NOTHING;

-- Insert default lessons
INSERT INTO lessons (category, title, content, video_url, is_custom, family_id) VALUES 
    ('earning', 'How to Earn Money', 'Money is earned by doing work and providing value to others. When you complete chores or help your family, you earn money as a reward for your hard work!', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL),
    ('saving', 'Why Save Money?', 'Saving money means keeping some of your earnings for later. It''s like planting seeds that will grow into bigger plants! When you save money, you can buy bigger things you want in the future.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL),
    ('spending', 'Smart Spending', 'Spending money wisely means thinking before you buy. Ask yourself: Do I really need this? Will it make me happy for a long time? Smart spending helps you get the most value from your money!', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL),
    ('investing', 'Growing Your Money', 'Investing is like planting a money tree! When you invest, you put your money to work so it can grow over time. The earlier you start, the more your money can grow!', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL),
    ('donating', 'Sharing is Caring', 'Donating means giving some of your money to help others. It feels good to help people in need and makes the world a better place!', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL)
ON CONFLICT DO NOTHING;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_users_family_id ON users(family_id);
CREATE INDEX IF NOT EXISTS idx_children_family_id ON children(family_id);
CREATE INDEX IF NOT EXISTS idx_jobs_family_id ON jobs(family_id);
CREATE INDEX IF NOT EXISTS idx_jobs_assigned_to_id ON jobs(assigned_to_id);
CREATE INDEX IF NOT EXISTS idx_payments_child_id ON payments(child_id);
CREATE INDEX IF NOT EXISTS idx_payments_job_id ON payments(job_id);
CREATE INDEX IF NOT EXISTS idx_allocation_settings_child_id ON allocation_settings(child_id);
CREATE INDEX IF NOT EXISTS idx_learning_progress_child_id ON learning_progress(child_id);
CREATE INDEX IF NOT EXISTS idx_achievements_child_id ON achievements(child_id);

-- ─── Phase 3: New Feature Tables ──────────────────────────────────────────

-- Savings Goals
CREATE TABLE IF NOT EXISTS savings_goals (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount DECIMAL(10,2) NOT NULL,
    current_amount DECIMAL(10,2) DEFAULT 0.00,
    deadline TEXT,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_savings_goals_child_id ON savings_goals(child_id);

-- Spending Log
CREATE TABLE IF NOT EXISTS spending_log (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('food', 'toys', 'clothes', 'entertainment', 'education', 'other')),
    date TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spending_log_child_id ON spending_log(child_id);

-- Donations
CREATE TABLE IF NOT EXISTS donations (
    id SERIAL PRIMARY KEY,
    child_id INTEGER NOT NULL REFERENCES children(id) ON DELETE CASCADE,
    organization TEXT NOT NULL,
    cause TEXT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    date TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_donations_child_id ON donations(child_id);

-- ─── Phase 4: Expanded Learning Curriculum ────────────────────────────────
-- Money Grower Track (Ages 7-10)
INSERT INTO lessons (category, title, content, video_url, is_custom, family_id) VALUES
    ('earning', 'Making Change — Coin Math', 'Do you know all the coins? A penny is 1 cent, a nickel is 5 cents, a dime is 10 cents, and a quarter is 25 cents. When you earn money or buy something, you might need to count change. Practice by pretending to run your own store!', 'https://www.youtube.com/embed/5ajulLspFbI', FALSE, NULL),
    ('saving', 'Why We Save — The Magic of Goals', 'Saving feels hard at first, but here is a trick: pick something you REALLY want. That is your goal! Every time you do a chore and earn money, put some in your savings jar. Watch it grow every week — that is the magic of saving!', 'https://www.youtube.com/embed/Pf3BYJUQB4c', FALSE, NULL),
    ('earning', 'Earning More Ways', 'Did you know there are many ways to earn money besides chores? You can sell lemonade, create artwork, help a neighbor, or even sell toys you no longer use. Being creative about earning money is a great skill!', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL),
    ('donating', 'Giving Goals — Pick a Cause', 'Donating means giving some of your money to help others. You can help animals at a shelter, provide food for people who are hungry, or help plant trees. Picking a cause you care about makes giving extra special!', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL),
    ('spending', 'Comparing Prices — Be a Smart Shopper', 'Before you buy something, look for the best deal! Two stores might sell the same toy for different prices. Comparing prices is like being a detective — you find the best deal and save money in the process!', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL),
    ('saving', 'Banking Basics — Your Money''s Safe House', 'A bank is like a super-safe house for your money. When you put money in a bank, they keep it safe AND they pay you extra money called interest! It is like getting a reward just for saving.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL)
ON CONFLICT DO NOTHING;

-- Money Builder Track (Ages 11-15)
INSERT INTO lessons (category, title, content, video_url, is_custom, family_id) VALUES
    ('investing', 'Compound Interest — Money That Grows Itself', 'Compound interest is one of the most powerful ideas in all of finance. If you put $100 in a savings account that earns 10% per year, after 1 year you have $110. After 2 years you have $121 — because the interest also earns interest! Over 30 years, your $100 grows to over $1,700 without doing anything.', 'https://www.youtube.com/embed/wf91rEGw88Q', FALSE, NULL),
    ('investing', 'What is a Stock?', 'A stock is a tiny piece of ownership in a company. If you buy one share of your favorite company, you become a part-owner! If the company does well, your share becomes more valuable. Stocks can go up AND down, which is why we invest money we won''t need for a long time.', 'https://www.youtube.com/embed/p7HKvqRI_Bo', FALSE, NULL),
    ('spending', 'The 50/30/20 Rule', 'The 50/30/20 rule is a simple budget guide: put 50% of your income toward needs (food, clothes), 30% toward wants (fun stuff, games), and 20% toward savings and giving. It helps make sure you never spend more than you earn!', 'https://www.youtube.com/embed/HQzoZfc3GwQ', FALSE, NULL),
    ('spending', 'Good Debt vs Bad Debt', 'Not all debt is bad! Good debt helps you earn more in the future — like a college loan that leads to a higher-paying job. Bad debt is borrowing money to buy things that lose value quickly, like buying a new phone you can''t afford. Understanding the difference is key to staying financially healthy.', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL),
    ('donating', 'Donating Strategically', 'Did you know you can research charities before donating? Websites like Charity Navigator show how well organizations use their donations. A strategic donor asks: Does this charity use money efficiently? What is their impact? Strategic giving makes your dollars go even further!', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL),
    ('investing', 'Roth IRA for Kids — Tax-Free Future', 'A Roth IRA is a special retirement account with a huge bonus: the money grows TAX-FREE! If you earn money from chores, you can contribute to a custodial Roth IRA. If you invest $1,000 at age 13 and leave it until age 65, it could grow to over $88,000 — all tax free!', 'https://www.youtube.com/embed/dQw4w9WgXcQ', FALSE, NULL)
ON CONFLICT DO NOTHING;