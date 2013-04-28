@echo off
ECHO TODO: gyp and msbuild

copy manifest.json bin\
copy third_party\sixense\bin\win32\release_dll\sixense.dll bin\
copy build\npvr\Release\npvr.dll bin\

regsvr32 /s /u build\npvr\debug\npvr.dll
regsvr32 /s bin\npvr.dll
