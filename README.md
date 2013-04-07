EXPERIMENTAL


* Run gyp: run-gyp.bat
* Open the build/npvr/npvr.sln file and build
* Register with FF by running 'regsvr32 npvr.dll' in the output dir
* Copy the sixense.dll from third_party/sixense/bin/win32/release_dll/ to the output dir (alongside npvr.dll)
* Launch FF
* Set dom.ipc.plugins.enabled = false
* Open the test page, look at the console

