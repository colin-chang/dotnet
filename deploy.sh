#!/usr/bin/env sh

set -e
# GitHub Pages
rm -rf docs/.vuepress/dist
npm run build
cd docs/.vuepress/dist
git init
git add -A
git commit -m 'deploy'
git push -f git@github.com:colin-chang/dotnet.git master:gh-pages
cd -

# Standalone
rm -rf docs/.vuepress/dist
# sed -i "" "s/base: '\/dotnet\/'/base: '\/'/g" docs/.vuepress/config.js
npm run build
# sed -i "" "s/base: '\/'/base: '\/dotnet\/'/g" docs/.vuepress/config.js
cd docs/.vuepress/dist
# echo 'dotnet.ccstudio.org' > CNAME
git init
git add -A
git commit -m 'deploy'
git push -f git@github.com:colin-chang/dotnet.git master:gh-pages
cd -