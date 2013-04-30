# vr.js
An experimental NPAPI plugin for Chrome and Firefox that exposes fun VR devices.

`vr.js`, in conjunction with a required native browser plugin, exposes the
Oculus Rift and Razer Hydra to Javascript in a performant, easy-to-use way. The
library makes it simple to query the device values in just a few lines of code
but also handles more advanced things like computing all the math required for
rendering lens distorted scenes. If you want, it even has a slick API for easily
rendering the distored scene that should be easy to drop into any WebGL
application. There's also an example three.js wrapper under
[examples/js/effects/](https://github.com/benvanik/vr.js/tree/master/examples/js/effects) that works pretty well.

Oh, and though it's possible to use node and WebSockets to get the sensor data
I don't recommend it - the latency is simply too high (~10ms). This plugin
allows for a latency similar to if you were developing a native application
against the Oculus SDK and, when running on a correctly configured computer,
will be pretty darn good.

## Supported Devices

* [Razer Hydra](http://www.razerzone.com/gaming-controllers/razer-hydra)
* [Oculus Rift Development Kit](https://www.oculusvr.com/)

## Supported Platforms

* Windows
  * Chrome 26+
  * Firefox 20

OSX support coming soon!

## Installing

* Download the [repository ZIP](https://github.com/benvanik/vr.js/archive/master.zip)
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

You must have the plugin installed before they will run:

* [Raw Data](http://benvanik.github.io/vr.js/examples/raw_data.html)
  * Source: [examples/raw_data.html](https://github.com/benvanik/vr.js/blob/master/examples/raw_data.html)
* [Sixense Sensor Data Visualization](http://benvanik.github.io/vr.js/examples/sixense_sensor_viz.html)
  * Source: [examples/sixense_sensor_viz.html](https://github.com/benvanik/vr.js/blob/master/examples/sixense_sensor_viz.html)
* [Rift Sensor Data Visualization](http://benvanik.github.io/vr.js/examples/rift_sensor_viz.html)
  * Source: [examples/rift_sensor_viz.html](https://github.com/benvanik/vr.js/blob/master/examples/rift_sensor_viz.html)
* [Simple WebGL Demo](http://benvanik.github.io/vr.js/examples/rift_cube_demo.html)
  * Source: [examples/rift_cube_demo.js](https://github.com/benvanik/vr.js/blob/master/examples/rift_cube_demo.js)
* [Three.js Floating Boxes Demo](http://benvanik.github.io/vr.js/examples/threejs_boxes_demo.html)
  * Source: [examples/threejs_boxes_demo.html](https://github.com/benvanik/vr.js/blob/master/examples/threejs_boxes_demo.html)

## Documentation

Code is heavily commented - it's best to read that.

If you want fancy HTML docs, see the [Online Documentation](http://benvanik.github.io/vr.js/docs/vr.html).

## Tips

### Calibration

In the future there will likely be a simple calibration tool added to the JS
library, but for now the best way to get your IPD is to run Team Fortress 2's
calibration tool and copy the value out.

### Reducing Latency

#### Disable Aero on Windows

This removes a frame of latency.

* Right click on desktop
* Personalize
* Choose Windows 7 Basic or Windows Classic

#### Write Fast Code

Use `requestAnimationFrame` for your rendering and always render as fast as
possible.

## Building

### Windows

Visual Studio 2010 or 2012 is required for building on Windows. The Express
editions should work, just make sure to get the VC++ 2012 for Desktop variant.
Other dependencies are included in the repo.

Uninstall any previous installation of the npvr DLL before continuing.

Check out the git repo and generate the Visual Studio projects:

    git clone https://github.com/benvanik/vr.js.git
    cd vr.js
    git submodule init
    git submodule update
    make-gyp.bat

Open `build\npvr\vs2010\npvr.sln` and build. The outputs will be placed into
`build\npvr\Debug\`.

Run the following to prepare the debug version and register it with Firefox:

    make-debug.bat

To use in Chrome:

* Open Chrome to `chrome://extensions`
* Check 'Developer mode' and click 'Load unpacked extension'
* Select the `build\npvr\debug\` folder

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

## Credits

A lot of the code comes from the official Oculus SDK. Some math snippets from
[Brandon Jones's gl-matrix](https://github.com/toji/gl-matrix).
