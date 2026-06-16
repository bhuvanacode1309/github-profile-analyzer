const axios = require('axios');
const db = require('../config/db');

// Helper function to strip emojis and variation selectors
function stripEmojis(text) {
  if (!text) return '';
  return text.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDC00-\uDFFF]|\uFE0F/g, '').trim();
}

// Helper function to calculate account age in years
function calculateAccountAge(createdAtString) {
  const createdAt = new Date(createdAtString);
  const now = new Date();
  const diffInMs = now - createdAt;
  const ageInYears = diffInMs / (1000 * 60 * 60 * 24 * 365.25);
  return parseFloat(ageInYears.toFixed(2));
}

// 1. Fetch & Analyze GitHub profile
exports.analyzeProfile = async (req, res) => {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const userUrl = `https://api.github.com/users/${username}`;
    const userResponse = await axios.get(userUrl, {
      headers: { 'User-Agent': 'Node-GitHub-Analyzer' }
    });

    const userData = userResponse.data;

    const reposUrl = `https://api.github.com/users/${username}/repos?per_page=100`;
    const reposResponse = await axios.get(reposUrl, {
      headers: { 'User-Agent': 'Node-GitHub-Analyzer' }
    });

    const reposData = reposResponse.data;

    let totalStars = 0;
    let totalForks = 0;
    const languagesCount = {};

    reposData.forEach(repo => {
      totalStars += repo.stargazers_count || 0;
      totalForks += repo.forks_count || 0;
      if (repo.language) {
        languagesCount[repo.language] = (languagesCount[repo.language] || 0) + 1;
      }
    });

    const totalReposWithLanguage = Object.values(languagesCount).reduce((sum, count) => sum + count, 0);
    const topLanguages = {};
    if (totalReposWithLanguage > 0) {
      for (const lang in languagesCount) {
        const percentage = (languagesCount[lang] / totalReposWithLanguage) * 100;
        topLanguages[lang] = Math.round(percentage);
      }
    }

    const accountAge = calculateAccountAge(userData.created_at);

    const query = `
      INSERT INTO profiles (
        username, name, avatar_url, bio, public_repos, followers, following, 
        github_created_at, total_stars, total_forks, top_languages
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        avatar_url = VALUES(avatar_url),
        bio = VALUES(bio),
        public_repos = VALUES(public_repos),
        followers = VALUES(followers),
        following = VALUES(following),
        total_stars = VALUES(total_stars),
        total_forks = VALUES(total_forks),
        top_languages = VALUES(top_languages);
    `;

    const values = [
      userData.login,
      userData.name || null,
      userData.avatar_url || null,
      userData.bio || null,
      userData.public_repos,
      userData.followers,
      userData.following,
      new Date(userData.created_at),
      totalStars,
      totalForks,
      JSON.stringify(topLanguages)
    ];

    await db.execute(query, values);

    return res.status(200).json({
      message: 'Profile analyzed and saved successfully',
      data: {
        username: userData.login,
        name: userData.name,
        avatar_url: userData.avatar_url,
        bio: userData.bio,
        public_repos: userData.public_repos,
        followers: userData.followers,
        following: userData.following,
        account_age_years: accountAge,
        total_stars: totalStars,
        total_forks: totalForks,
        top_languages: topLanguages
      }
    });

  } catch (error) {
    console.error('Error analyzing profile:', error.message);
    if (error.response && error.response.status === 404) {
      return res.status(404).json({ error: 'GitHub user not found' });
    }
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 2. Fetch all analyzed profiles
exports.getAllProfiles = async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM profiles ORDER BY analyzed_at DESC');
    
    const parsedRows = rows.map(row => {
      if (row.top_languages && typeof row.top_languages === 'string') {
        row.top_languages = JSON.parse(row.top_languages);
      }
      return row;
    });

    return res.status(200).json(parsedRows);
  } catch (error) {
    console.error('Error fetching all profiles:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 3. Fetch a single analyzed profile
exports.getSingleProfile = async (req, res) => {
  const { username } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM profiles WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Profile not found. Please analyze it first!' });
    }

    const profile = rows[0];
    if (profile.top_languages && typeof profile.top_languages === 'string') {
      profile.top_languages = JSON.parse(profile.top_languages);
    }

    return res.status(200).json(profile);
  } catch (error) {
    console.error('Error fetching single profile:', error.message);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
};

// 4. Generate HTML Resume Card
exports.getProfileResume = async (req, res) => {
  const { username } = req.params;

  try {
    const [rows] = await db.query('SELECT * FROM profiles WHERE username = ?', [username]);

    if (rows.length === 0) {
      return res.status(404).send('<h1>Profile not found. Please analyze it first!</h1>');
    }

    const profile = rows[0];
    const languages = profile.top_languages && typeof profile.top_languages === 'string' 
      ? JSON.parse(profile.top_languages) 
      : (profile.top_languages || {});

    const createdAt = new Date(profile.github_created_at);
    const now = new Date();
    const ageInYears = ((now - createdAt) / (1000 * 60 * 60 * 24 * 365.25)).toFixed(1);

    // Format analysis date professionally, e.g. June 16, 2026
    const analysisDate = new Date(profile.analyzed_at).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    // Clean name and bio of any emojis for a professional look
    const cleanName = stripEmojis(profile.name || profile.username);
    const cleanBio = stripEmojis(profile.bio || '');

    // 1. Generate languages progress bar HTML
    let languagesHtml = '';
    const langEntries = Object.entries(languages);
    if (langEntries.length > 0) {
      langEntries
        .sort((a, b) => b[1] - a[1]) // Sort by percentage descending
        .slice(0, 5) // Take only top 5 languages
        .forEach(([lang, percent]) => {
          languagesHtml += `
            <div class="skill-item">
              <div class="skill-info">
                <span class="skill-name">${lang}</span>
                <span class="skill-percent">${percent}%</span>
              </div>
              <div class="progress-bar-bg">
                <div class="progress-bar-fill" style="width: ${percent}%"></div>
              </div>
            </div>
          `;
        });
    } else {
      languagesHtml = '<p class="no-data">No language data available</p>';
    }

    // 2. Fetch and render Top 3 repositories dynamically
    let projectsHtml = '';
    try {
      const reposUrl = `https://api.github.com/users/${username}/repos?per_page=100`;
      const reposResponse = await axios.get(reposUrl, {
        headers: { 'User-Agent': 'Node-GitHub-Analyzer' }
      });
      const repos = reposResponse.data;
      const topRepos = repos
        .sort((a, b) => b.stargazers_count - a.stargazers_count) // Sort by stars descending
        .slice(0, 3); // Take top 3

      if (topRepos.length > 0) {
        topRepos.forEach(repo => {
          const cleanRepoDesc = stripEmojis(repo.description || 'No description provided.');
          projectsHtml += `
            <div class="project-item">
              <div class="project-header">
                <a href="${repo.html_url}" target="_blank" class="project-name">${repo.name}</a>
                <div class="project-meta">
                  <span class="project-lang">${repo.language || 'Markdown'}</span>
                  <span class="project-stars">&#9733; ${repo.stargazers_count}</span>
                </div>
              </div>
              <p class="project-desc">${cleanRepoDesc}</p>
            </div>
          `;
        });
      } else {
        projectsHtml = '<p class="no-data">No public projects available</p>';
      }
    } catch (err) {
      console.error('Error fetching repositories for resume:', err.message);
      projectsHtml = '<p class="no-data">Unable to load featured projects</p>';
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${cleanName}'s Developer Resume</title>
        <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
        <style>
          :root {
            --bg-color: #0b0f19;
            --card-bg: #111827;
            --border-color: rgba(255, 255, 255, 0.05);
            --accent-gradient: linear-gradient(135deg, #0284c7, #4f46e5);
            --text-primary: #f8fafc;
            --text-secondary: #94a3b8;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          body {
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 2rem;
          }
          .resume-card {
            background: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            width: 100%;
            max-width: 600px;
            padding: 2.5rem;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
            position: relative;
          }
          .header {
            display: flex;
            align-items: center;
            gap: 1.5rem;
            margin-bottom: 1.5rem;
          }
          .avatar {
            width: 80px;
            height: 80px;
            border-radius: 50%;
            border: 2px solid #0284c7;
          }
          .title-area h1 {
            font-size: 1.8rem;
            font-weight: 700;
            color: #f8fafc;
          }
          .title-area p {
            color: var(--text-secondary);
            font-size: 1rem;
            margin-top: 0.1rem;
          }
          .bio {
            font-size: 0.95rem;
            line-height: 1.6;
            color: var(--text-secondary);
            margin-bottom: 0.5rem;
            border-left: 3px solid #0284c7;
            padding-left: 1rem;
          }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 1rem;
            margin-bottom: 1.8rem;
          }
          .stat-box {
            background: #1f2937;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 1rem;
            text-align: center;
          }
          .stat-value {
            font-size: 1.5rem;
            font-weight: 700;
            color: #f8fafc;
            margin-bottom: 0.2rem;
          }
          .stat-label {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: var(--text-secondary);
          }
          .section-title {
            font-size: 1.1rem;
            font-weight: 600;
            margin-top: 1.8rem;
            margin-bottom: 1rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 0.4rem;
            color: #0284c7;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .skill-item {
            margin-bottom: 0.9rem;
          }
          .skill-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 0.3rem;
            font-size: 0.9rem;
          }
          .skill-name {
            font-weight: 600;
          }
          .skill-percent {
            color: var(--text-secondary);
          }
          .progress-bar-bg {
            background: #1f2937;
            height: 6px;
            border-radius: 3px;
            overflow: hidden;
          }
          .progress-bar-fill {
            background: var(--accent-gradient);
            height: 100%;
            border-radius: 3px;
          }
          
          /* Projects Styling */
          .project-item {
            background: #1f2937;
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 1rem;
            margin-bottom: 0.8rem;
          }
          .project-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 0.4rem;
          }
          .project-name {
            color: #f8fafc;
            font-weight: 600;
            text-decoration: none;
            font-size: 1rem;
          }
          .project-name:hover {
            color: #0284c7;
            text-decoration: underline;
          }
          .project-meta {
            display: flex;
            gap: 0.8rem;
            font-size: 0.8rem;
          }
          .project-lang {
            color: #0284c7;
            background: rgba(2, 132, 199, 0.1);
            padding: 0.1rem 0.4rem;
            border-radius: 4px;
            font-weight: 600;
          }
          .project-stars {
            color: var(--text-secondary);
          }
          .project-desc {
            color: var(--text-secondary);
            font-size: 0.85rem;
            line-height: 1.4;
          }
          
          .footer {
            margin-top: 2.5rem;
            text-align: center;
            font-size: 0.75rem;
            color: var(--text-secondary);
            border-top: 1px solid var(--border-color);
            padding-top: 1rem;
          }
          @media (max-width: 600px) {
            .resume-card {
              padding: 1.5rem;
            }
            .stats-grid {
              grid-template-columns: 1fr;
            }
          }
        </style>
      </head>
      <body>
        <div class="resume-card">
          <div class="header">
            <img class="avatar" src="${profile.avatar_url || 'https://via.placeholder.com/150'}" alt="${profile.username}">
            <div class="title-area">
              <h1>${cleanName}</h1>
              <p>@${profile.username}</p>
            </div>
          </div>
          
          ${cleanBio ? `
            <h2 class="section-title" style="margin-top: 0;">Professional Summary</h2>
            <p class="bio">${cleanBio}</p>
          ` : ''}
          
          <h2 class="section-title">GitHub Insights</h2>
          <div class="stats-grid">
            <div class="stat-box">
              <div class="stat-value">${profile.public_repos}</div>
              <div class="stat-label">Repositories</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${ageInYears} Years</div>
              <div class="stat-label">Account Age</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${profile.followers}</div>
              <div class="stat-label">Followers</div>
            </div>
            <div class="stat-box">
              <div class="stat-value">${profile.total_stars}</div>
              <div class="stat-label">Total Stars</div>
            </div>
          </div>
          
          <h2 class="section-title">Featured Projects</h2>
          <div class="projects-list">
            ${projectsHtml}
          </div>
          
          <h2 class="section-title">Top Skills</h2>
          <div class="skills-list">
            ${languagesHtml}
          </div>
          
          <div class="footer">
            Generated by GitHub Profile Analyzer API | Analyzed on ${analysisDate}
          </div>
        </div>
      </body>
      </html>
    `;

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(htmlContent);
  } catch (error) {
    console.error('Error generating HTML resume:', error.message);
    return res.status(500).send('<h1>Internal Server Error</h1>');
  }
};
