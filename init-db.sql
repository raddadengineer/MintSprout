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
    ('earning', 'How to Earn Money', 'Money is earned by doing work and providing value to others. When you complete chores or help your family, you earn money as a reward for your hard work!', 'https://www.youtube.com/embed/0iRbD5rM5qc', FALSE, NULL),
    ('saving', 'Why Save Money?', 'Saving money means keeping some of your earnings for later. It''s like planting seeds that will grow into bigger plants! When you save money, you can buy bigger things you want in the future.', 'https://www.youtube.com/embed/oqgtFqd8nHo', FALSE, NULL),
    ('spending', 'Smart Spending', 'Spending money wisely means thinking before you buy. Ask yourself: Do I really need this? Will it make me happy for a long time? Smart spending helps you get the most value from your money!', 'https://www.youtube.com/embed/6OAqNtueu0U', FALSE, NULL),
    ('investing', 'Growing Your Money', 'Investing is like planting a money tree! When you invest, you put your money to work so it can grow over time. The earlier you start, the more your money can grow!', 'https://www.youtube.com/embed/jTW777ENc3c', FALSE, NULL),
    ('donating', 'Sharing is Caring', 'Donating means giving some of your money to help others. It feels good to help people in need and makes the world a better place!', 'https://www.youtube.com/embed/BbYRAK_eCvo', FALSE, NULL)
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
    ('earning', 'Making Change — Coin Math', 'Do you know all the coins? A penny is 1 cent, a nickel is 5 cents, a dime is 10 cents, and a quarter is 25 cents. When you earn money or buy something, you might need to count change. Practice by pretending to run your own store!', 'https://www.youtube.com/embed/0iRbD5rM5qc', FALSE, NULL),
    ('saving', 'Why We Save — The Magic of Goals', 'Saving feels hard at first, but here is a trick: pick something you REALLY want. That is your goal! Every time you do a chore and earn money, put some in your savings jar. Watch it grow every week — that is the magic of saving!', 'https://www.youtube.com/embed/oqgtFqd8nHo', FALSE, NULL),
    ('earning', 'Earning More Ways', 'Did you know there are many ways to earn money besides chores? You can sell lemonade, create artwork, help a neighbor, or even sell toys you no longer use. Being creative about earning money is a great skill!', 'https://www.youtube.com/embed/0iRbD5rM5qc', FALSE, NULL),
    ('donating', 'Giving Goals — Pick a Cause', 'Donating means giving some of your money to help others. You can help animals at a shelter, provide food for people who are hungry, or help plant trees. Picking a cause you care about makes giving extra special!', 'https://www.youtube.com/embed/BbYRAK_eCvo', FALSE, NULL),
    ('spending', 'Comparing Prices — Be a Smart Shopper', 'Before you buy something, look for the best deal! Two stores might sell the same toy for different prices. Comparing prices is like being a detective — you find the best deal and save money in the process!', 'https://www.youtube.com/embed/6OAqNtueu0U', FALSE, NULL),
    ('saving', 'Banking Basics — Your Money''s Safe House', 'A bank is like a super-safe house for your money. When you put money in a bank, they keep it safe AND they pay you extra money called interest! It is like getting a reward just for saving.', 'https://www.youtube.com/embed/oqgtFqd8nHo', FALSE, NULL)
ON CONFLICT DO NOTHING;

-- Money Builder Track (Ages 11-15)
INSERT INTO lessons (category, title, content, video_url, is_custom, family_id) VALUES
    ('investing', 'Compound Interest — Money That Grows Itself', 'Compound interest is one of the most powerful ideas in all of finance. If you put $100 in a savings account that earns 10% per year, after 1 year you have $110. After 2 years you have $121 — because the interest also earns interest! Over 30 years, your $100 grows to over $1,700 without doing anything.', 'https://www.youtube.com/embed/jTW777ENc3c', FALSE, NULL),
    ('investing', 'What is a Stock?', 'A stock is a tiny piece of ownership in a company. If you buy one share of your favorite company, you become a part-owner! If the company does well, your share becomes more valuable. Stocks can go up AND down, which is why we invest money we won''t need for a long time.', 'https://www.youtube.com/embed/p7HKvqRI_Bo', FALSE, NULL),
    ('spending', 'The 50/30/20 Rule', 'The 50/30/20 rule is a simple budget guide: put 50% of your income toward needs (food, clothes), 30% toward wants (fun stuff, games), and 20% toward savings and giving. It helps make sure you never spend more than you earn!', 'https://www.youtube.com/embed/OZQQMYfaBT4', FALSE, NULL),
    ('spending', 'Good Debt vs Bad Debt', 'Not all debt is bad! Good debt helps you earn more in the future — like a college loan that leads to a higher-paying job. Bad debt is borrowing money to buy things that lose value quickly, like buying a new phone you can''t afford. Understanding the difference is key to staying financially healthy.', 'https://www.youtube.com/embed/uv_P9yJY9jQ', FALSE, NULL),
    ('donating', 'Donating Strategically', 'Did you know you can research charities before donating? Websites like Charity Navigator show how well organizations use their donations. A strategic donor asks: Does this charity use money efficiently? What is their impact? Strategic giving makes your dollars go even further!', 'https://www.youtube.com/embed/osCUTGkKVRg', FALSE, NULL),
    ('investing', 'Roth IRA for Kids — Tax-Free Future', 'A Roth IRA is a special retirement account with a huge bonus: the money grows TAX-FREE! If you earn money from chores, you can contribute to a custodial Roth IRA. If you invest $1,000 at age 13 and leave it until age 65, it could grow to over $88,000 — all tax free!', 'https://www.youtube.com/embed/3bruQxLmGvY', FALSE, NULL)
ON CONFLICT DO NOTHING;

-- ─── Quiz Questions ────────────────────────────────────────────────────────
-- 3 questions per lesson, referenced by lesson insertion order (lessons 1-17).
-- NOTE: lesson_id values assume sequential inserts starting at 1.
-- If your DB already has lessons, adjust the lesson_id numbers accordingly.

-- Lesson 1: How to Earn Money
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (1, 'What does it mean to EARN money?', ARRAY['Finding money on the ground', 'Getting money for doing work or a job', 'Borrowing money from a friend', 'Printing your own money'], 1),
    (1, 'Which of these is a good example of earning money?', ARRAY['Wishing for money', 'Doing your chores to get your allowance', 'Taking money without asking', 'Winning a prize every day'], 1),
    (1, 'Why is earning money important?', ARRAY['So you can buy everything you see', 'So you never have to go to school', 'So you can pay for things you need and save for goals', 'So adults leave you alone'], 2);

-- Lesson 2: Why Save Money?
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (2, 'What does saving money mean?', ARRAY['Spending all your money right away', 'Keeping some money for later', 'Giving all your money away', 'Hiding money under your bed forever'], 1),
    (2, 'If Emma earns $10 and saves $3, how much did she save?', ARRAY['$10', '$7', '$3', '$13'], 2),
    (2, 'Which is the BEST reason to save money?', ARRAY['To never spend any money again', 'So you can buy something special you want later', 'To make your piggy bank look full', 'Because adults told you to'], 1);

-- Lesson 3: Smart Spending
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (3, 'What is the difference between a NEED and a WANT?', ARRAY['They are exactly the same thing', 'A need is something required to live; a want is something extra you would like', 'A want is more important than a need', 'Needs cost more than wants'], 1),
    (3, 'Which is a NEED?', ARRAY['A new video game', 'A pair of shoes to wear to school', 'A toy from the store', 'A second bicycle'], 1),
    (3, 'Jake has $5. A snack costs $2 and a toy costs $6. What should Jake do first?', ARRAY['Buy the toy by borrowing money', 'Buy the snack since he can afford it', 'Spend nothing and keep all $5 in the jar', 'Ask for more money immediately'], 1);

-- Lesson 4: Growing Your Money (Investing intro)
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (4, 'What does investing mean?', ARRAY['Spending all your money at once', 'Putting money to work so it can grow over time', 'Giving money to a friend to hold', 'Spending money on food'], 1),
    (4, 'Why is it better to start investing EARLY?', ARRAY['Because you get a trophy', 'Because the earlier you start, the more time your money has to grow', 'Because older people are not allowed to invest', 'It does not matter when you start'], 1),
    (4, 'Investing is like…', ARRAY['Throwing money in a trash can', 'Planting a seed that grows into a tree', 'Spending money at the store', 'Keeping money under your mattress'], 1);

-- Lesson 5: Sharing is Caring (Donating intro)
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (5, 'What does it mean to donate?', ARRAY['To loan money and expect it back', 'To give some of your money or things to help others', 'To spend money on yourself', 'To save money in a bank'], 1),
    (5, 'Why do people donate to charity?', ARRAY['To get more allowance', 'To help others and make the world a better place', 'Because they have too much money', 'To buy things for themselves'], 1),
    (5, 'Which of these is a way to donate?', ARRAY['Spending money on candy', 'Giving food to a food bank', 'Buying the newest game', 'Saving money for a bike'], 1);

-- Lesson 6: Making Change — Coin Math
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (6, 'How many cents is a quarter worth?', ARRAY['10 cents', '5 cents', '25 cents', '50 cents'], 2),
    (6, 'You buy a snack for 30 cents and pay with 2 quarters. How much change do you get back?', ARRAY['10 cents', '20 cents', '30 cents', '5 cents'], 1),
    (6, 'Which coins add up to exactly 50 cents?', ARRAY['5 dimes', '1 quarter and 3 nickels', '2 quarters', 'All of the above'], 3);

-- Lesson 7: Why We Save — The Magic of Goals
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (7, 'What is a savings GOAL?', ARRAY['A rule that says you must spend all your money', 'A specific thing you want to save up enough money to buy or do', 'A game you play with coins', 'A type of bank account'], 1),
    (7, 'Emma wants a bike that costs $40. She saves $5 each week. How many weeks will it take her?', ARRAY['4 weeks', '8 weeks', '10 weeks', '6 weeks'], 1),
    (7, 'What happens to your savings jar each time you add money?', ARRAY['It gets smaller', 'It stays the same', 'It grows bigger toward your goal', 'The money disappears'], 2);

-- Lesson 8: Earning More Ways
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (8, 'Which of these is a creative way a kid can earn money?', ARRAY['Printing fake money', 'Setting up a lemonade stand', 'Taking money from a parent''s wallet without asking', 'Waiting for money to appear'], 1),
    (8, 'What does it mean to be an entrepreneur?', ARRAY['Someone who spends all their money', 'A person who starts their own small business to earn money', 'A person who goes to school', 'Someone who never works'], 1),
    (8, 'If you sell 10 cups of lemonade for $1 each, how much do you earn?', ARRAY['$1', '$5', '$10', '$100'], 2);

-- Lesson 9: Giving Goals — Pick a Cause
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (9, 'What is a "cause" when it comes to donating?', ARRAY['A type of coin', 'An important issue or group that your donation helps', 'A savings jar label', 'A chore you have to do'], 1),
    (9, 'Which is a good example of a cause you could support?', ARRAY['Buying yourself a new toy', 'Helping provide food for kids who need it', 'Saving up for a video game', 'Spending money at a movie theater'], 1),
    (9, 'Why should you pick a cause YOU care about when donating?', ARRAY['Because it doesn''t matter where your money goes', 'Because caring about a cause makes giving feel meaningful and motivating', 'So you can get the money back later', 'Because all charities are the same'], 1);

-- Lesson 10: Comparing Prices — Be a Smart Shopper
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (10, 'Store A sells a book for $8. Store B sells the same book for $5. Which is the better deal?', ARRAY['Store A because it is bigger', 'Store B because it is cheaper', 'They are the same price', 'It depends on the color of the store'], 1),
    (10, 'What does it mean to compare prices?', ARRAY['Buying the first thing you see', 'Looking at different prices for the same item to find the best deal', 'Only shopping at one store forever', 'Spending more money to get better quality always'], 1),
    (10, 'Before spending your money, what is a good question to ask yourself?', ARRAY['Is this the first thing I saw?', 'Is there a cheaper option somewhere else?', 'Does this cost the most?', 'Should I buy two of these?'], 1);

-- Lesson 11: Banking Basics — Your Money's Safe House
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (11, 'What is a bank?', ARRAY['A place where you play games', 'A safe place to store your money that also helps it grow', 'A type of piggy bank', 'A store where you buy money'], 1),
    (11, 'What is INTEREST in a savings account?', ARRAY['Something you have to pay the bank', 'Extra money the bank pays you just for keeping your money there', 'A fee for spending money', 'A type of loan'], 1),
    (11, 'Why is keeping money in a bank safer than keeping it at home?', ARRAY['Banks are more colorful', 'Banks are insured and protected, so your money is guaranteed even if something goes wrong', 'Money grows faster at home', 'It isn''t safer — the bank can take your money'], 1);

-- Lesson 12: Compound Interest — Money That Grows Itself
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (12, 'What is compound interest?', ARRAY['Paying extra taxes on your money', 'Interest that earns interest — so your money grows faster and faster over time', 'A fee for using a credit card', 'Interest on a loan you owe'], 1),
    (12, 'You put $100 in an account that earns 10% per year. After 1 year, how much do you have?', ARRAY['$90', '$100', '$110', '$200'], 2),
    (12, 'Why is it smart to start saving and investing when you are YOUNG?', ARRAY['Because old people cannot save money', 'Because you have more time for compound interest to grow your money', 'Because young people pay no taxes', 'It makes no difference when you start'], 1);

-- Lesson 13: What is a Stock?
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (13, 'What is a stock?', ARRAY['A type of soup', 'A tiny piece of ownership in a company', 'A bank savings account', 'Money you borrow from someone'], 1),
    (13, 'If the company you own shares in grows and does well, what happens to your stock?', ARRAY['It disappears', 'It loses all its value', 'Its value increases, so your investment grows', 'Nothing changes'], 2),
    (13, 'Why do stocks sometimes go DOWN in value?', ARRAY['Because the company is celebrating', 'Because investors get bored', 'Because the company struggles, or the overall economy weakens', 'Because of the weather'], 2);

-- Lesson 14: The 50/30/20 Rule
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (14, 'In the 50/30/20 rule, what does the 50% go toward?', ARRAY['Wants like video games and movies', 'Needs like food, rent, and transportation', 'Savings and investing', 'Donating to charity'], 1),
    (14, 'You earn $100. Using the 50/30/20 rule, how much should go to savings?', ARRAY['$50', '$30', '$20', '$10'], 2),
    (14, 'What is the purpose of the 50/30/20 rule?', ARRAY['To make sure you spend all your money', 'To help you budget so you always have money for needs, wants, AND savings', 'To tell you which stores to shop at', 'To decide how much to donate only'], 1);

-- Lesson 15: Good Debt vs Bad Debt
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (15, 'Which is an example of GOOD debt?', ARRAY['Using a credit card to buy a luxury watch', 'Taking a student loan to pay for college so you can earn a higher salary', 'Borrowing money to buy candy', 'Buying a gaming system you cannot afford'], 1),
    (15, 'Which is an example of BAD debt?', ARRAY['A mortgage to buy a home', 'A business loan to start a company', 'Borrowing money on a high-interest credit card to buy things you do not need', 'A student loan for education'], 2),
    (15, 'What does it mean when a debt has HIGH interest?', ARRAY['You get more money back', 'You have to pay back a lot more than you borrowed', 'The bank is being nice to you', 'You borrowed money for a long time'], 1);

-- Lesson 16: Donating Strategically
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (16, 'What does it mean to donate STRATEGICALLY?', ARRAY['Giving money randomly to whoever asks', 'Researching charities to make sure your donation is used effectively', 'Only donating to famous organizations', 'Donating the largest possible amount no matter what'], 1),
    (16, 'Charity Navigator is a website that helps you…', ARRAY['Play charity-themed video games', 'Evaluate how efficiently charities use donations', 'Find free coupons', 'Set up your own bank account'], 1),
    (16, 'Before donating to a charity, what is a smart question to ask?', ARRAY['What color is their logo?', 'How do they use the money they receive and what impact do they have?', 'Are they on TV?', 'How many employees do they have?'], 1);

-- Lesson 17: Roth IRA for Kids — Tax-Free Future
INSERT INTO quizzes (lesson_id, question, options, correct_answer) VALUES
    (17, 'What is a Roth IRA?', ARRAY['A type of checking account you use every day', 'A retirement savings account where your money grows tax-free', 'A loan from the government', 'A special type of stock'], 1),
    (17, 'What is the BIG advantage of a Roth IRA compared to a regular savings account?', ARRAY['It has no limits on withdrawals', 'The money and all its growth is tax-free when you retire', 'The bank pays you every month for free', 'You can spend it on anything right away'], 1),
    (17, 'To contribute to a Roth IRA as a kid, you need to have…', ARRAY['Your parents'' credit card', 'Earned income (money from a job or chores)', 'A college degree', 'At least $10,000 saved already'], 1);