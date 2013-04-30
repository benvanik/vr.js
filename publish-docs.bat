REM @echo off

call make-docs.bat

cd ..
git clone git@github.com:benvanik/vr.js.git vr.js-gh-pages
cd vr.js-gh-pages

git checkout gh-pages
git reset --hard
git pull
git merge origin/gh-pages

rmdir /s /q docs
mkdir docs
copy ..\vr.js\build\docs docs\
copy ..\vr.js\build\docs\scripts docs\scripts\
copy ..\vr.js\build\docs\styles docs\styles\
git add --all docs\
git commit -m "Updating docs/ to the latest version."

git push origin gh-pages

cd ..
cd vr.js
