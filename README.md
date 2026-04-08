# PG & Roommate Finder

PG & Roommate Finder is a student-focused accommodation platform with listing discovery, roommate matching, reviews, favorites, dashboard analytics, and a glassmorphism UI with animated gradient and floating bubbles.

## Features

- Register and login with JWT-based authentication
- Browse PG listings with instant search and filters
- Post new PG listings
- View listing details, ratings, reviews, and owner contact
- Save and manage favorites
- Post roommate requirements and discover compatibility matches
- Personal dashboard with saved listings, active posts, and activity stats
- Animated toast notifications and polished glassmorphism design

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js with Express
- Database: JSON persistence fallback stored in `data/`

## Project Structure

```text
pg-finder/
|-- frontend/
|   |-- index.html
|   |-- post.html
|   |-- details.html
|   |-- dashboard.html
|   |-- style.css
|   `-- script.js
|-- backend/
|   |-- server.js
|   |-- middleware/
|   |   `-- auth.js
|   |-- routes/
|   |   |-- auth.js
|   |   |-- dashboard.js
|   |   |-- listings.js
|   |   `-- roommates.js
|   `-- models/
|       |-- dataStore.js
|       `-- storage.js
|-- data/
|   |-- listings.json
|   |-- roommatePosts.json
|   `-- users.json
|-- package.json
`-- README.md
```

## Run Instructions

```bash
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000)

## Notes

- The app uses JSON files as the persistence layer, so it works immediately without additional database setup.
- To use a different port, set the `PORT` environment variable before starting the server.
