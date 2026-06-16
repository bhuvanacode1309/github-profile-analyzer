# GitHub Profile Analyzer API

A backend API built with Node.js, Express.js, and MySQL that analyzes GitHub user profiles, stores insights in a database, and generates professional profile summaries.

## Features

* Fetch GitHub profile data using GitHub API
* Analyze repositories, followers, and following
* Calculate account age
* Count total stars and forks
* Identify top programming languages
* Store analyzed profiles in MySQL
* Retrieve all analyzed profiles
* Retrieve a specific analyzed profile
* Generate a profile resume page

## Tech Stack

* Node.js
* Express.js
* MySQL
* GitHub REST API

## Installation

1. Clone the repository
2. Install dependencies

```bash
npm install
```

3. Create a `.env` file

```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=
DB_NAME=github_analyzer
```

4. Start the server

```bash
node server.js
```

## API Endpoints

### Analyze Profile

POST `/api/profiles`

```json
{
  "username": "google"
}
```

### Get All Profiles

GET `/api/profiles`

### Get Single Profile

GET `/api/profiles/:username`

### Get Resume Page

GET `/api/profiles/:username/resume`

## Author

Bhuvana
