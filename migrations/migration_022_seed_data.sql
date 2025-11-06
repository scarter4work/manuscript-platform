-- Seed Data for Enhanced Metadata System

-- Top-Level: Fiction
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('fiction', 'Fiction', NULL, 'Narrative literature created from imagination', 40000, 120000, 1);

-- Fiction > Literary Fiction
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('literary-fiction', 'Literary Fiction', 'fiction', 'Character-driven fiction with artistic merit', 80000, 100000, 1);

-- Fiction > Thriller
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('thriller', 'Thriller', 'fiction', 'Fast-paced suspenseful fiction', 70000, 90000, 2),
('psychological-thriller', 'Psychological Thriller', 'thriller', 'Mind-bending suspense focused on character psychology', 70000, 90000, 1),
('legal-thriller', 'Legal Thriller', 'thriller', 'Courtroom drama and legal suspense', 70000, 90000, 2),
('medical-thriller', 'Medical Thriller', 'thriller', 'Medical mysteries and healthcare suspense', 70000, 90000, 3),
('techno-thriller', 'Techno-Thriller', 'thriller', 'Technology-driven suspense', 70000, 90000, 4),
('espionage-thriller', 'Espionage Thriller', 'thriller', 'Spy novels and international intrigue', 70000, 100000, 5);

-- Fiction > Mystery
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('mystery', 'Mystery', 'fiction', 'Crime-solving and detective fiction', 70000, 90000, 3),
('cozy-mystery', 'Cozy Mystery', 'mystery', 'Amateur sleuth in small-town setting', 60000, 80000, 1),
('hard-boiled', 'Hard-Boiled Detective', 'mystery', 'Gritty urban detective fiction', 70000, 90000, 2),
('police-procedural', 'Police Procedural', 'mystery', 'Realistic law enforcement investigation', 70000, 90000, 3),
('noir', 'Noir', 'mystery', 'Dark, cynical crime fiction', 70000, 90000, 4);

-- Fiction > Romance
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('romance', 'Romance', 'fiction', 'Love stories with emotional focus', 70000, 100000, 4),
('contemporary-romance', 'Contemporary Romance', 'romance', 'Modern-day love stories', 70000, 90000, 1),
('historical-romance', 'Historical Romance', 'romance', 'Romance set in historical periods', 80000, 100000, 2),
('paranormal-romance', 'Paranormal Romance', 'romance', 'Romance with supernatural elements', 75000, 95000, 3),
('romantic-suspense', 'Romantic Suspense', 'romance', 'Romance combined with thriller elements', 75000, 95000, 4),
('romantic-comedy', 'Romantic Comedy', 'romance', 'Humorous love stories', 70000, 90000, 5);

-- Fiction > Fantasy
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('fantasy', 'Fantasy', 'fiction', 'Magical and imaginative worlds', 90000, 120000, 5),
('epic-fantasy', 'Epic Fantasy', 'fantasy', 'Large-scale fantasy with world-building', 100000, 150000, 1),
('urban-fantasy', 'Urban Fantasy', 'fantasy', 'Magic in contemporary urban settings', 80000, 100000, 2),
('high-fantasy', 'High Fantasy', 'fantasy', 'Secondary world fantasy', 100000, 120000, 3),
('dark-fantasy', 'Dark Fantasy', 'fantasy', 'Fantasy with horror elements', 90000, 120000, 4),
('sword-and-sorcery', 'Sword & Sorcery', 'fantasy', 'Action-oriented fantasy adventures', 80000, 100000, 5);

-- Fiction > Science Fiction
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('science-fiction', 'Science Fiction', 'fiction', 'Speculative fiction based on science', 90000, 120000, 6),
('hard-sf', 'Hard Science Fiction', 'science-fiction', 'Scientifically accurate SF', 90000, 120000, 1),
('space-opera', 'Space Opera', 'science-fiction', 'Epic space adventures', 100000, 140000, 2),
('cyberpunk', 'Cyberpunk', 'science-fiction', 'High-tech dystopian futures', 80000, 100000, 3),
('dystopian', 'Dystopian', 'science-fiction', 'Dark future societies', 80000, 100000, 4),
('post-apocalyptic', 'Post-Apocalyptic', 'science-fiction', 'After civilization collapse', 80000, 100000, 5),
('time-travel', 'Time Travel', 'science-fiction', 'Stories involving time manipulation', 80000, 100000, 6);

-- Fiction > Horror
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('horror', 'Horror', 'fiction', 'Fiction designed to frighten or disturb', 70000, 90000, 7),
('gothic-horror', 'Gothic Horror', 'horror', 'Atmospheric horror with dark settings', 70000, 90000, 1),
('psychological-horror', 'Psychological Horror', 'horror', 'Mental and emotional terror', 70000, 90000, 2),
('supernatural-horror', 'Supernatural Horror', 'horror', 'Ghosts, demons, and otherworldly threats', 70000, 90000, 3);

-- Fiction > Historical Fiction
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('historical-fiction', 'Historical Fiction', 'fiction', 'Stories set in historical periods', 80000, 120000, 8);

-- Fiction > Young Adult
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('young-adult', 'Young Adult', 'fiction', 'Fiction for teen readers (13-18)', 50000, 80000, 9),
('ya-contemporary', 'YA Contemporary', 'young-adult', 'Realistic modern YA fiction', 50000, 75000, 1),
('ya-fantasy', 'YA Fantasy', 'young-adult', 'Fantasy for young adults', 60000, 85000, 2),
('ya-science-fiction', 'YA Science Fiction', 'young-adult', 'SF for young adults', 60000, 85000, 3),
('ya-dystopian', 'YA Dystopian', 'young-adult', 'Dystopian fiction for teens', 55000, 80000, 4);

-- Top-Level: Nonfiction
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('nonfiction', 'Nonfiction', NULL, 'Factual and informational writing', 40000, 90000, 2);

-- Nonfiction > Memoir
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('memoir', 'Memoir', 'nonfiction', 'Personal life stories', 60000, 80000, 1);

-- Nonfiction > Biography
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('biography', 'Biography', 'nonfiction', 'Life stories of others', 70000, 100000, 2);

-- Nonfiction > Business
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('business', 'Business', 'nonfiction', 'Business and entrepreneurship', 40000, 60000, 3);

-- Nonfiction > Self-Help
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('self-help', 'Self-Help', 'nonfiction', 'Personal development and improvement', 40000, 60000, 4);

-- Nonfiction > History
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('history', 'History', 'nonfiction', 'Historical accounts and analysis', 70000, 100000, 5);

-- Nonfiction > True Crime
INSERT OR IGNORE INTO genres (id, name, parent_genre_id, description, typical_word_count_min, typical_word_count_max, display_order) VALUES
('true-crime', 'True Crime', 'nonfiction', 'Real criminal cases and investigations', 60000, 80000, 6);

-- Content Warning Types
INSERT OR IGNORE INTO content_warning_types (id, name, category, description, severity, display_order) VALUES
-- Violence
('violence-graphic', 'Graphic Violence', 'violence', 'Detailed descriptions of physical violence', 'severe', 1),
('violence-moderate', 'Violence', 'violence', 'Non-graphic violence', 'moderate', 2),
('violence-war', 'War/Combat', 'violence', 'Military combat or war scenes', 'moderate', 3),
('violence-torture', 'Torture', 'violence', 'Depictions of torture', 'severe', 4),
('violence-death', 'Death/Dying', 'violence', 'Characters dying or dead', 'moderate', 5),
('violence-self-harm', 'Self-Harm', 'violence', 'Self-inflicted injury', 'severe', 6),
-- Sexual Content
('sexual-explicit', 'Explicit Sexual Content', 'sexual', 'Detailed sexual scenes', 'severe', 7),
('sexual-moderate', 'Sexual Content', 'sexual', 'Non-explicit sexual situations', 'moderate', 8),
('sexual-assault', 'Sexual Assault/Rape', 'sexual', 'Sexual violence', 'severe', 9),
-- Substance Use
('substance-alcohol', 'Alcohol Use', 'substance', 'Alcohol consumption', 'mild', 10),
('substance-drugs', 'Drug Use', 'substance', 'Illegal drug use', 'moderate', 11),
('substance-addiction', 'Addiction', 'substance', 'Substance addiction themes', 'moderate', 12),
-- Mental Health
('mental-suicide', 'Suicide', 'mental_health', 'Suicide or suicidal ideation', 'severe', 13),
('mental-depression', 'Depression', 'mental_health', 'Clinical depression themes', 'moderate', 14),
('mental-anxiety', 'Anxiety/Panic', 'mental_health', 'Anxiety disorders or panic attacks', 'moderate', 15),
('mental-trauma', 'Trauma/PTSD', 'mental_health', 'Traumatic events or PTSD', 'severe', 16),
-- Discrimination/Abuse
('discrimination-racism', 'Racism', 'discrimination', 'Racial discrimination or slurs', 'moderate', 17),
('discrimination-sexism', 'Sexism', 'discrimination', 'Gender discrimination', 'moderate', 18),
('discrimination-homophobia', 'Homophobia', 'discrimination', 'Anti-LGBTQ+ discrimination', 'moderate', 19),
('abuse-domestic', 'Domestic Abuse', 'discrimination', 'Intimate partner violence', 'severe', 20),
('abuse-child', 'Child Abuse', 'discrimination', 'Abuse of children', 'severe', 21),
-- Other
('language-profanity', 'Strong Language', 'other', 'Profanity and explicit language', 'mild', 22),
('horror-body-horror', 'Body Horror', 'other', 'Disturbing body transformation or gore', 'severe', 23),
('eating-disorder', 'Eating Disorder', 'other', 'Eating disorder themes', 'moderate', 24);
