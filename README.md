# 1. Save schema.json and generator.js
# 2. Create templates/ with all files from previous messages
# 3. Install generator deps
npm i fs-extra ejs commander

# 4. Generate
node generator.js --schema schema.json --output blog-app

# 5. Run locally
cd blog-app
docker-compose up --build

# Open: http://localhost:4200/pages/dashboard
# Login: Use POST /api/auth/register → { email, password, fullName }