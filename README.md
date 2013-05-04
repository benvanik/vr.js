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

NOTE: the Oculus SDK doesn't like sharing devices - you must close other Oculus
apps before using this in your browser and must close your browser if you want
to run another Oculus app. Lame :(

If you want to see something really crazy, check out the [experimental pure Javascript driver for Chrome](https://github.com/benvanik/vr.js/tree/master/experimental/usb-driver). Pure Javascript device drivers, pretty insane, huh?!

![Screenshot](https://github.com/benvanik/vr.js/raw/master/docs/vrjs-threejs-boxes-demo.jpg "Screenshot of a vr.js demo")

## Supported Devices

* [Razer Hydra](http://www.razerzone.com/gaming-controllers/razer-hydra)
* [Oculus Rift Development Kit](https://www.oculusvr.com/)

## Supported Platforms

* Windows
  * Chrome 26+ (surprisingly good performance)
  * Firefox 20

OSX support coming soon!

If using the [experimental Chrome USB driver](https://github.com/benvanik/vr.js/tree/master/experimental/usb-driver) you can run on both OS X and Linux.

## Installing

* Download the [repository ZIP](https://github.com/benvanik/vr.js/archive/master.zip)
* Extract to some path
* Chrome:
  * Open Chrome to `chrome://extensions`
  * Check 'Developer mode' and click 'Load unpacked extension'
  * Select the `bin\` folder in the path you extracted the ZIP into
* Firefox:
  * Open an administrator command prompt
  * cd to `bin\` in the path you extracted the ZIP into
  * Run `install.bat`
  * You should see a successful message box

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

Code is heavily commented - it's best to read that. Everything is in the [vr.js](https://github.com/benvanik/vr.js/blob/master/lib/vr.js) file right now.

If you want fancy HTML docs, see the [Online Documentation](http://benvanik.github.io/vr.js/docs/vr.html).

## Tips

### Calibration

In the future there will likely be a simple calibration tool added to the JS
library, but for now the best way to get your IPD is to run Team Fortress 2's
calibration tool and copy the value out.

### Don't Overlap the WebGL Canvas

If you place any other DOM element on top of the Canvas rendering your content
you may cause extra browser compositing that can slow down your rendering.
Since you have to draw your entire HUD/etc distored anyway, avoid placing
any UI on top of the Canvas or adding any CSS effects to it
(rounded corners, etc).

### Disable Aero on Windows

This removes a frame of latency.

* Right click on desktop
* Personalize
* Choose Windows 7 Basic or Windows Classic

### Write Fast Code

Use `requestAnimationFrame` for your rendering and always render as fast as
possible.

## Future Ideas

### 3D DOM

Using CSS transform and matrix3d it'd be possible to position any DOM content
correctly. Then, once CSS Shaders are available in browsers, the DOM content
could be distorted/color corrected.

### Pure Javascript Drivers

An [experimental pure Javascript driver for Chrome](https://github.com/benvanik/vr.js/tree/master/experimental/usb-driver) is available here. It works on OS X and Linux and requires a small tweak before it can work, but shows the promise!

Chrome apps have the [chrome.usb](http://developer.chrome.com/trunk/apps/usb.html)
API allowing direct access to devices. Implementing the sensor communication
and sensor fusion code in Javascript allows apps to work on any OS
Chrome runs on (ChromeOS too!) without the need for plugins. Unfortunately it's
restricted to packaged apps only, not the general web, and the API does not support HID devices.

Mozilla is also considering a USB API, [WebUSB](https://bugzilla.mozilla.org/show_bug.cgi?id=674718), however it seems to have stalled.

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

## Debugging

Make sure to uninstall the pre-built binary and instead install the plugin
from the Debug build directory. When trying to rebuild the plugin always ensure
the browsers that have loaded it are closed.

### Chrome

Install the Chrome Canary. Running it on its own (instead of your main Chrome
instance) makes it much easier to debug/restart/etc.

Exit all previous instances and launch from a command prompt:

    "%LOCALAPPDATA%\Local\Google\Chrome SxS\Application\chrome.exe" --debug-plugin-loading --enable-logging --v=1 --plugin-startup-dialog

Open a page with the plugin and wait for the popup telling you the process ID.
Switch to Visual Studio, go Debug -> Attach to Process, select the Google plugin
process with the matching process ID, and attach.

### Firefox

Try to run Firefox with no other pages loaded.

Disable the out-of-process plugins to make things easier: open about:config,
find `dom.ipc.plugins.enabled`, and set it to false. Restart Firefox.

Launch, open the page, and attach to firefox.exe in Visual Studio.

## License

BSD, except the np_* code.

Some portions of the code are from the official Oculus SDK and fall under
their license. I hope that's cool :)

## Credits

A lot of the code comes from the official Oculus SDK. Some math snippets from
[Brandon Jones's gl-matrix](https://github.com/toji/gl-matrix).
