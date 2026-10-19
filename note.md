git status
git remote -v

git remote set-url origin https://github.com/SilvaRohit/myProperty.git
git remote add origin https://github.com/SilvaRohit/myProperty.git

git switch -c aws-deployment

git ls-files '.env*'
git rm --cached .env

git add .
git diff --cached --stat
git diff --cached
git commit -m "Prepare property app for AWS deployment"
git push -u origin aws-deployment

git clone --branch aws-deployment --single-branch https://github.com/SilvaRohit/myProperty.git

git pull --ff-only origin aws-deployment

curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

sudo groupadd docker
sudo usermod -aG docker $USER
newgrp docker

