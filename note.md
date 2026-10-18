git status
git remote -v

git remote set-url origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git

git switch -c aws-deployment

git ls-files '.env*'
git rm --cached .env

git add .
git diff --cached --stat
git diff --cached
git commit -m "Prepare property app for AWS deployment"
git push -u origin aws-deployment