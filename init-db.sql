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