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
xcopy /s ..\vr.js\build\docs docs\

rmdir /s /q examples
mkdir examples
xcopy /s ..\vr.js\examples examples\

rmdir /s /q lib
mkdir lib
xcopy /s ..\vr.js\lib lib\

git add --all docs\ examples\ lib\
git commit -m "Updating docs/ to the latest version."

git push origin gh-pages

cd ..
cd vr.js
