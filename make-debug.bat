@echo off
ECHO TODO: gyp and msbuild

copy manifest.json build\npvr\debug\
copy third_party\sixense\bin\win32\release_dll\sixense.dll build\npvr\debug\

regsvr32 /s /u bin\npvr.dll
regsvr32 /s build\npvr\debug\npvr.dll

