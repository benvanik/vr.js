# NPVR
An experimental NPAPI plugin for Chrome and Firefox that exposes fun VR devices.

## Supported Devices

* [Razer Hydra](http://www.razerzone.com/gaming-controllers/razer-hydra)
* [Oculus Rift Development Kit](https://www.oculusvr.com/)

## Installing

* Download the [repository ZIP](https://github.com/benvanik/npvr/archive/master.zip)
* Extract to some path
* Firefox:
  * Open an administrator command prompt
  * cd to `bin\` in the path you extracted the ZIP into
  * Run `install.bat`
  * You should see a successful message box
* Chrome:
  * Open Chrome to `chrome://extensions`
  * Check 'Developer mode' and click 'Load unpacked extension'
  * Select the `bin\` folder in the path you extracted the ZIP into

## Demos

* Raw Data: `examples/raw_data.html`
* Sixense Data Visualization: `examples/sixense_viz.html`
* Rift Data Visualization: `examples/rift_viz.html`
* Three.js Cube Demo: `examples/cube_demo.html`

## Building

### Windows

Visual Studio 2010 or 2012 is required for building on Windows. The Express
editions should work, just make sure to get the VC++ 2012 for Desktop variant.
Other dependencies are included in the repo.

Check out the git repo and generate the Visual Studio projects:

    git clone https://github.com/benvanik/npvr.git
    cd npvr
    git submodule init
    git submodule update
    run-gyp.bat

Open `build\npvr\npvr.sln` and build. The outputs will be placed into
`build\npvr\Debug\`.

Copy the following files into `Debug\`:
* `manifest.json`
* `third_party\sixense\bin\win32\release_dll\sixense.dll`

Uninstall any previous installation before continuing.

#### Installing in Firefox

Open an administrator command prompt and cd to the `Debug\` directory.

    regsvr32 npvr.dll

You'll only need to do this once.

#### Installing in Chrome

Open `chrome://extensions`, choose 'Load unpacked extension', and select the
`Debug\` folder.

### Debugging

Make sure to uninstall the pre-built binary and instead install the plugin
from the Debug build directory. When trying to rebuild the plugin always ensure
the browsers that have loaded it are closed.

#### Chrome

Install the Chrome Canary. Running it on its own (instead of your main Chrome
instance) makes it much easier to debug/restart/etc.

Exit all previous instances and launch from a command prompt:

    "%LOCALAPPDATA%\Local\Google\Chrome SxS\Application\chrome.exe" --debug-plugin-loading --enable-logging --v=1 --plugin-startup-dialog

Open a page with the plugin and wait for the popup telling you the process ID.
Switch to Visual Studio, go Debug -> Attach to Process, select the Google plugin
process with the matching process ID, and attach.

#### Firefox

Try to run Firefox with no other pages loaded.

Disable the out-of-process plugins to make things easier: open about:config,
find `dom.ipc.plugins.enabled`, and set it to false. Restart Firefox.

Launch, open the page, and attach to firefox.exe in Visual Studio.

## License

BSD, except the np_* code.
