CREATE TABLE IF NOT EXISTS profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(150),
  avatar_url VARCHAR(255),
  bio TEXT,
  public_repos INT NOT NULL,
  followers INT NOT NULL,
  following INT NOT NULL,
  github_created_at TIMESTAMP NULL,
  total_stars INT DEFAULT 0,
  total_forks INT DEFAULT 0,
  top_languages JSON,
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
