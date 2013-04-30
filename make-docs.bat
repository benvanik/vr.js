@echo off

del /s /q build\docs
node_modules\.bin\jsdoc -c .jsdoc.json lib -d build\docs
