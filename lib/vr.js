(function(global) {

var vr = global.vr = {
  /**
   * Whether the plugin is initialized.
   * @type {boolean}
   */
  isReady: false
};


/**
 * A list of callbacks waiting for ready.
 * @type {!Array.<!Array>}
 */
var readyWaiters = [];


/**
 * Readies the library and calls back any waiters.
 */
function makeReady() {
  vr.isReady = true;

  while (readyWaiters.length) {
    var waiter = readyWaiters.shift();
    waiter[0].call(waiter[1]);
  }
};


/**
 * Queues a callback that will be called when the plugin is ready.
 * @param {function(this:T)} callback Callback function.
 * @param {T=} opt_scope Optional callback scope.
 * @template T
 */
vr.wait = function(callback, opt_scope) {
  if (vr.isReady) {
    global.setTimeout(function() {
      callback.call(opt_scope);
    }, 0);
  } else {
    readyWaiters.push([callback, opt_scope]);
  }
};


/**
 * Creates the <embed> tag for the plugin.
 * @return {!HTMLEmbedElement} Embed element. Not yet added to the DOM.
 */
function createEmbed() {
  var embed = document.createElement('embed');
  embed.type = 'application/x-vnd-vr';
  embed.width = 4;
  embed.height = 4;
  embed.hidden = true;
  embed.style.visibility = 'hidden';
  embed.style.width = '0';
  embed.style.height = '0';
  embed.style.margin = '0';
  embed.style.padding = '0';
  embed.style.borderStyle = 'none';
  embed.style.borderWidth = '0';
  embed.style.maxWidth = '0';
  embed.style.maxHeight = '0';
  return embed;
};


/**
 * Calls the given function when the DOM is ready for use.
 * @param {!function(this:T)} callback Callback function.
 * @param {T=} opt_scope Optional callback scope.
 * @template T
 */
function waitForDomReady(callback, opt_scope) {
  if (document.readyState == 'complete') {
    window.setTimeout(function() {
      callback.call(opt_scope);
    }, 0);
  } else {
    function initialize() {
      document.removeEventListener('DOMContentLoaded', initialize, false);
      callback.call(opt_scope);
    };
    document.addEventListener('DOMContentLoaded', initialize, false);
  }
};


// Wait for DOM ready and initialize.
waitForDomReady(function() {
  // Create <embed>.
  var embed = createEmbed();

  // Add to DOM. We may be able to just add to a fragment, but I'm not sure.
  document.body.appendChild(embed);

  // Wait until the plugin adds itself to the global.
  function checkReady() {
    if (global._vr_native_) {
      makeReady();
    } else {
      global.setTimeout(checkReady, 10);
    }
  };
  checkReady();
});


/**
 * Executes a command in the plugin and returns the raw result.
 * @param {number} commandId Command ID.
 * @param {string=} opt_commandData Command data string.
 * @return {string} Raw result string.
 */
function execCommand(commandId, opt_commandData) {
  return _vr_native_.exec(commandId, opt_commandData || '') || '';
};


/**
 * Oculus Rift device info.
 * @param {Array.<number>=} opt_values Device values.
 * @constructor
 */
var VROculusInfo = vr.VROculusInfo = function(opt_values) {
  /**
   * Horizontal resolution of the entire screen, in pixels.
   * @type {number}
   */
  this.resolutionHorz = opt_values ? opt_values[0] : 1280;

  /**
   * Vertical resolution of the entire screen, in pixels.
   * @type {number}
   */
  this.resolutionVert =opt_values ?  opt_values[1] : 800;

  /**
   * Horizontal physical size of the screen, in meters.
   * @type {number}
   */
  this.screenSizeHorz = opt_values ? opt_values[2] : 0.14976;

  /**
   * Vertical physical size of the screen, in meters.
   * @type {number}
   */
  this.screenSizeVert = opt_values ? opt_values[3] : 0.0936;

  /**
   * Physical offset from the top of the screen to the eye center, in meters.
   * This will usually, but not necessarily be half of {@see screenSizeVert}.
   * @type {number}
   */
  this.screenCenterVert = opt_values ? opt_values[4] : 800 / 2;

  /**
   * Distance from the eye to screen surface, in meters.
   * Useful for calculating FOV and projection.
   * @type {number}
   */
  this.eyeToScreenDistance = opt_values ? opt_values[5] : 0.041;

  /**
   * Distance between physical lens centers useful for calculating distortion
   * center.
   * @type {number}
   */
  this.lensSeparationDistance = opt_values ? opt_values[6] : 0.064;

  /**
   * Configured distance between the user's eye centers, in meters.
   * Defaults to 0.064.
   * @type {number}
   */
  this.interpupillaryDistance = opt_values ? opt_values[7] : 0.064;

  /**
   * Radial distortion correction coefficients.
   * The distortion assumes that the input texture coordinates will be scaled
   * by the following equation:
   *   uvResult = uvInput * (K0 + K1 * uvLength^2 + K2 * uvLength^4)
   * Where uvInput is the UV vector from the center of distortion in direction
   * of the mapped pixel, uvLength is the magnitude of that vector, and uvResult
   * the corresponding location after distortion.
   * @type {!Float32Array}
   */
  this.distortionK = new Float32Array(opt_values ? [
    opt_values[8], opt_values[9], opt_values[10], opt_values[11]
  ] : [1.0, 0.22, 0.24, 0]);

  /**
   * Desktop coordinate position of the screen (can be negative) along X.
   * @type {number}
   */
  this.desktopX = opt_values ? opt_values[12] : 0;

  /**
   * Desktop coordinate position of the screen (can be negative) along Y.
   * @type {number}
   */
  this.desktopY = opt_values ? opt_values[13] : 0;
};


/**
 * Distorts the given value the same way the shader would.
 * @param {number} r Value to distort.
 * @return {number} Distorted value.
 */
VROculusInfo.prototype.distort = function(r) {
  var rsq = r * r;
  var K = this.distortionK;
  return r * (K[0] + K[1] * rsq + K[2] * rsq * rsq + K[3] * rsq * rsq * rsq);
};


/**
 * Queries the connected Oculus device.
 * @return {VROculusInfo} Device info or null if none attached.
 */
vr.queryOculusInfo = function() {
  var queryData = execCommand(1);
  if (!queryData || !queryData.length) {
    return null;
  }
  var values = queryData.split(',');
  for (var n = 0; n < values.length; n++) {
    values[n] = parseFloat(values[n]);
  }
  return new VROculusInfo(values);
};


/**
 * Resets the current orientation of the headset to be zero.
 */
vr.resetOculusOrientation = function() {
  execCommand(2);
};


/**
 * Bitmask values for the sixense controller buttons field.
 * @enum {number}
 */
vr.SixenseButton = {
  NONE: 0,
  BUTTON_START: 1 << 0,
  BUTTON_1: 1 << 5,
  BUTTON_2: 1 << 6,
  BUTTON_3: 1 << 3,
  BUTTON_4: 1 << 4,
  BUMPER: 1 << 7,
  JOYSTICK: 1 << 8
};


/**
 * Possible values of the sixense controller hand.
 * @enum {number}
 */
vr.SixenseHand = {
  /**
   * Hand has not yet been determined.
   */
  UNKNOWN: 0,
  /**
   * Controller is in the left hand.
   */
  LEFT: 1,
  /**
   * Controller is in the right hand.
   */
  RIGHT: 2
};


/**
 * VR state object.
 * This should be created and cached to enable efficient updates.
 * @constructor
 */
var VRState = function() {
  this.sixense = {
    present: false,
    controllers: [
      {
        position: new Float32Array(3),
        rotation: new Float32Array(4),
        joystick: new Float32Array(2),
        trigger: 0.0,
        buttons: vr.SixenseButton.NONE,
        isDocked: false,
        hand: vr.SixenseHand.UNKNOWN,
        isTrackingHemispheres: false
      },
      {
        position: new Float32Array(3),
        rotation: new Float32Array(4),
        joystick: new Float32Array(2),
        trigger: 0.0,
        buttons: vr.SixenseButton.NONE,
        isDocked: false,
        hand: vr.SixenseHand.UNKNOWN,
        isTrackingHemispheres: false
      }
    ]
  };
  this.oculus = {
    present: false,
    rotation: new Float32Array(4)
  }
};


/**
 * Creates a new state object.
 * @return {!VRState} New state object.
 */
vr.createState = function() {
  return new VRState();
};


/**
 * Polls active devices and fills in the state structure.
 * @param {!VRState} state State structure to fill in. This is the result of
 *     {@see vr#createState}.
 */
vr.poll = function(state) {
  // Data is chunked into devices by |.
  // Data inside the device chunk is split on ,.
  // The first entry inside a chunk is the device type.
  // So:
  // s,1,2,3|r,4,5,6|
  // is:
  //   - sixense with data 1,2,3
  //   - rift with data 4,5,6

  var pollData = _vr_native_.poll();
  var deviceChunks = pollData.split('|');
  for (var n = 0; n < deviceChunks.length; n++) {
    var deviceChunk = deviceChunks[n].split(',');
    if (!deviceChunk.length) {
      continue;
    }
    switch (deviceChunk[0]) {
      case 's':
        // Sixense data.
        parseSixenseChunk(state, deviceChunk, 1);
        break;
      case 'r':
        // Oculus data.
        parseOculusChunk(state, deviceChunk);
        break;
    }
  }

  function parseSixenseChunk(state, data, o) {
    // b,[base#],
    //   c,[controller#],
    //     [x],[y],[z],[q0],[q1],[q2],[q3],[jx],[jy],[tr],[buttons],
    //     [docked],[hand],[hemisphere tracking],
    //   c,[controller#],
    //     [x],[y],[z],[q0],[q1],[q2],[q3],[jx],[jy],[tr],[buttons],
    //     [docked],[hand],[hemisphere tracking],
    //   ...
    // ...

    while (o < data.length) {
      var c = data[o++];
      if (c == 'b') {
        var baseId = data[o++];
        state.sixense.present = true;
      } else if (c == 'c') {
        var controllerId = data[o++];
        var controller = state.sixense.controllers[controllerId];
        controller.position[0] = parseFloat(data[o++]);
        controller.position[1] = parseFloat(data[o++]);
        controller.position[2] = parseFloat(data[o++]);
        controller.rotation[0] = parseFloat(data[o++]);
        controller.rotation[1] = parseFloat(data[o++]);
        controller.rotation[2] = parseFloat(data[o++]);
        controller.rotation[3] = parseFloat(data[o++]);
        controller.joystick[0] = parseFloat(data[o++]);
        controller.joystick[1] = parseFloat(data[o++]);
        controller.trigger = parseFloat(data[o++]);
        controller.buttons = parseInt(data[o++], 10);
        controller.isDocked = data[o++] == '1';
        controller.hand = parseInt(data[o++], 10);
        controller.isTrackingHemispheres = data[o++] == '1';
      } else {
        break;
      }
    }
  };

  function parseOculusChunk(state, data) {
    if (data.length == 5) {
      state.oculus.present = true;
      state.oculus.rotation[0] = parseFloat(data[1]);
      state.oculus.rotation[1] = parseFloat(data[2]);
      state.oculus.rotation[2] = parseFloat(data[3]);
      state.oculus.rotation[3] = parseFloat(data[4]);
    } else {
      state.oculus.present = false;
    }
  }
};


// An array of [x, y, w, h] of the window position before entering fullscreen.
// This will not be set if we were not the ones who initiated the fullscreen
// change.
var oldWindowSize = null;

var fullScreenChange = function(e) {
  if (vr.isFullScreen()) {
    // Entered fullscreen.
  } else {
    // Exited fullscreen.

    // Move the window back.
    if (oldWindowSize) {
      window.moveTo(oldWindowSize[0], oldWindowSize[1]);
      window.resizeTo(oldWindowSize[2], oldWindowSize[3]);
      oldWindowSize = null;
    }
  }
};
document.addEventListener('fullscreenchange', fullScreenChange, false);
document.addEventListener('mozfullscreenchange', fullScreenChange, false);


/**
 * Detects whether the window is currently fullscreen.
 * @return {boolean} True if in full screen mode.
 */
vr.isFullScreen = function() {
  var element =
      document.fullScreenElement ||
      document.mozFullScreenElement ||
      document.webkitFullscreenElement;
  return !!element;
};


/**
 * Enters full screen mode, moving the window to the oculus display if present.
 * @return {boolean} True if the window entered fullscreen.
 */
vr.beginFullScreen = function() {
  var oculusInfo = vr.queryOculusInfo();
  if (!oculusInfo) {
    return false;
  }

  // Stash current window position.
  oldWindowSize = [
    window.screenX, window.screenY,
    window.outerWidth, window.outerHeight
  ];

  // Move to new position.
  window.moveTo(oculusInfo.desktopX, oculusInfo.desktopY);
  window.resizeTo(oculusInfo.resolutionHorz, oculusInfo.resolutionVert);

  // Enter fullscreen.
  var requestFullScreen =
      document.documentElement.requestFullscreen ||
      document.documentElement.mozRequestFullScreen ||
      document.documentElement.webkitRequestFullScreen;
  requestFullScreen.call(
      document.documentElement, Element.ALLOW_KEYBOARD_INPUT);

  return true;
};


/**
 * Exits fullscreen mode and moves the window back to its original position.
 */
vr.exitFullScreen = function() {
  // Exit fullscreen.
  // The {@see fullScreenChange} handler will move the window back.
  var cancelFullScreen =
      document.cancelFullScreen ||
      document.mozCancelFullScreen ||
      document.webkitCancelFullScreen;
  if (cancelFullScreen) {
    cancelFullScreen.call(document);
  }
};


})(window);
