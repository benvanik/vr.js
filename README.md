EXPERIMENTAL


* Build in Debug config with VS2010
* Register with FF by running 'regsvr32 npvr.dll' in the output dir
* Copy the sixense.dll from third_party/sixense/bin/win32/release_dll/ to the output dir (alongside npvr.dll)
* Launch FF
* Set dom.ipc.plugins.enabled = false
* Open the test page, look at the console

