// NOTE: this is all super experimental and subject to change!
/**
 *
 *
 * @author Ben Vanik <ben.vanik@gmail.com>
 * @module vr
 */

(function(global) {

/**
 * @namespace vr
 */
var vr = {};



/**
 * VR object.
 * @param {!Document} document HTML document.
 * @constructor
 * @memberof vr
 */
vr.Runtime = function(document) {
  /**
   * HTML document.
   * @type {!Document}
   * @private
   */
  this.document_ = document;

  /**
   * Whether the plugin is installed.
   * @type {boolean}
   * @readonly
   */
  this.isInstalled = this.detectPlugin_();

  /**
   * Whether the plugin is initialized.
   * @type {boolean}
   * @readonly
   */
  this.isLoaded = false;

  /**
   * The error that occurred during initialization, if any.
   * @type {Object}
   * @readonly
   */
  this.error = null;

  /**
   * Whether the plugin is attempting to load.
   * This is set on the first attempt and never cleared to prevent fail loops.
   * @type {boolean}
   * @private
   */
  this.isLoading_ = false;

  /**
   * A list of callbacks waiting for ready.
   * @type {!Array.<!Array>}
   * @private
   */
  this.readyWaiters_ = [];

  /**
   * Native plugin object.
   * @type {Object}
   * @private
   */
  this.native_ = null;

  /**
   * HMD info, if any device is attached.
   * @type {vr.HmdInfo}
   * @private
   */
  this.hmdInfo_ = null;

  /**
   * Sixense info, if any device is attached.
   * @type {vr.SixenseInfo}
   * @private
   */
  this.sixenseInfo_ = null;

  /**
   * An array of [x, y, w, h] of the window position before entering fullscreen.
   * This will not be set if we were not the ones who initiated the fullscreen
   * change.
   * @type {Array.<number>}
   * @private
   */
  this.oldWindowSize_ = null;

  var self = this;
  var fullScreenChange = function(e) {
    self.fullScreenChange_(e);
  };
  document.addEventListener('fullscreenchange', fullScreenChange, false);
  document.addEventListener('mozfullscreenchange', fullScreenChange, false);
};


/**
 * Attempts to detect the plugins availability.
 * This could be called periodically to wait for install.
 * @return {boolean} True if the plugin is installed.
 * @private
 */
vr.Runtime.prototype.detectPlugin_ = function() {
  var plugins = navigator.plugins;
  plugins.refresh();
  for (var n = 0; n < plugins.length; n++) {
    var plugin = plugins[n];
    for (var m = 0; m < plugin.length; m++) {
      var mimeType = plugin[m];
      if (mimeType.type == 'application/x-vnd-vr') {
        return true;
      }
    }
  }
  return false;
};


/**
 * Creates the <embed> tag for the plugin.
 * @return {!HTMLEmbedElement} Embed element. Not yet added to the DOM.
 * @private
 */
vr.Runtime.prototype.createEmbed_ = function() {
  var embed = this.document_.createElement('embed');
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
 * @private
 */
vr.Runtime.prototype.waitForDomReady_ = function(callback, opt_scope) {
  if (this.document_.readyState == 'complete') {
    global.setTimeout(function() {
      callback.call(opt_scope);
    }, 0);
  } else {
    var self = this;
    function initialize() {
      self.document_.removeEventListener('DOMContentLoaded', initialize, false);
      callback.call(opt_scope);
    };
    this.document_.addEventListener('DOMContentLoaded', initialize, false);
  }
};


/**
 * Queues a callback that will be called when the plugin is ready.
 * The callback will receive an error object if an error occurred.
 * If the plugin is already initialized the given callback will be called next
 * tick, so it's always safe to use this.
 * @param {function(this:T, Object)=} opt_callback Callback function.
 * @param {T=} opt_scope Optional callback scope.
 * @template T
 */
vr.Runtime.prototype.load = function(opt_callback, opt_scope) {
  // Fail if not installed.
  if (!this.isInstalled) {
    this.error = new Error('Plugin not installed!');
    if (opt_callback) {
      global.setTimeout(function() {
        opt_callback.call(opt_scope, this.error);
      }, 0);
    }
    return;
  }

  if (this.isLoaded || this.error) {
    // Already loaded or errored, callback.
    if (opt_callback) {
      global.setTimeout(function() {
        opt_callback.call(opt_scope, this.error);
      }, 0);
    }
    return;
  } else {
    // Wait for load...
    if (opt_callback) {
      this.readyWaiters_.push([opt_callback, opt_scope]);
    }

    if (this.isLoading_) {
      // Already loading, ignore the request.
      return;
    }

    // Start loading!
    this.isLoading_ = true;

    // Wait for DOM ready and initialize.
    this.waitForDomReady_(this.loadDomReady_, this);

    return;
  }
};


/**
 * Loading stage once the DOM is readied and the plugin can be loaded.
 * @private
 */
vr.Runtime.prototype.loadDomReady_ = function() {
  // Create <embed>.
  var embed = this.createEmbed_();

  // Add to DOM. We may be able to just add to a fragment, but I'm not
  // sure.
  this.document_.body.appendChild(embed);

  // Wait until the plugin adds itself to the global.
  var startTime = Date.now();
  var self = this;
  function checkLoaded() {
    if (global._vr_native_) {
      self.completeLoad_();
    } else {
      var elapsed = Date.now() - startTime;
      if (elapsed > 1 * 1000) {
        // Waited longer than 5 seconds - timeout.
        self.completeLoad_(new Error('Plugin blocked - enable and reload.'));
      } else {
        // Keep waiting.
        global.setTimeout(checkLoaded, 10);
      }
    }
  };
  checkLoaded();
};


/**
 * Readies the library and calls back any waiters.
 * @param {Object=} opt_error Error, if any.
 * @private
 */
vr.Runtime.prototype.completeLoad_ = function(opt_error) {
  // Set state.
  if (opt_error) {
    this.isLoaded = false;
    this.error = opt_error;
    this.native_ = null;
  } else {
    this.isLoaded = true;
    this.error = null;
    this.native_ = global._vr_native_;
  }

  // Callback all waiters.
  while (this.readyWaiters_.length) {
    var waiter = this.readyWaiters_.shift();
    waiter[0].call(waiter[1], opt_error || null);
  }
};


/**
 * Executes a command in the plugin and returns the raw result.
 * @param {number} commandId Command ID.
 * @param {string=} opt_commandData Command data string.
 * @return {string} Raw result string.
 * @private
 */
vr.Runtime.prototype.execCommand_ = function(commandId, opt_commandData) {
  if (!this.native_) {
    return '';
  }
  return this.native_.exec(commandId, opt_commandData || '') || '';
};


/**
 * Queries the connected HMD device.
 * @return {vr.HmdInfo} Device info or null if none attached.
 * @private
 */
vr.Runtime.prototype.queryHmdInfo_ = function() {
  var queryData = this.execCommand_(1);
  if (!queryData || !queryData.length) {
    return null;
  }
  var values = queryData.split(',');
  for (var n = 0; n < values.length; n++) {
    values[n] = parseFloat(values[n]);
  }
  return new vr.HmdInfo(values);
};


/**
 * Gets the information of the currently connected HMD device, if any.
 * This is populated on demand by calling {@link vr.Runtime#poll}.
 * @return {vr.HmdInfo} HMD info, if any.
 */
vr.Runtime.prototype.getHmdInfo = function() {
  return this.hmdInfo_;
};


/**
 * Resets the current orientation of the headset to be zero.
 */
vr.Runtime.prototype.resetHmdOrientation = function() {
  this.execCommand_(2);
};


/**
 * Queries the connected Sixense device.
 * @return {vr.SixenseInfo} Device info or null if none attached.
 * @private
 */
vr.Runtime.prototype.querySixenseInfo_ = function() {
  // TODO(benvanik): a real query
  return new vr.SixenseInfo();
};


/**
 * Gets the information of the currently connected Sixense device, if any.
 * This is populated on demand by calling {@link vr.Runtime#poll}.
 * @return {vr.SixenseInfo} Sixense info, if any.
 */
vr.Runtime.prototype.getSixenseInfo = function() {
  return this.sixenseInfo_;
};


/**
 * Polls active devices and fills in the state structure.
 * This also takes care of dispatching device notifications/etc.
 * @param {!vr.State} state State structure to fill in. This must be created by
 *     the caller and should be cached across calls to prevent extra garbage.
 * @return {boolean} True if the state query was successful.
 */
vr.Runtime.prototype.poll = function(state) {
  if (!this.native_) {
    return false;
  }

  // Data is chunked into devices by |.
  // Data inside the device chunk is split on ,.
  // The first entry inside a chunk is the device type.
  // So:
  // s,1,2,3|r,4,5,6|
  // is:
  //   - sixense with data 1,2,3
  //   - rift with data 4,5,6

  // Reset.
  state.sixense.present = false;
  state.hmd.present = false;

  // Poll data.
  var pollData = this.native_.poll();
  var deviceChunks = pollData.split('|');
  for (var n = 0; n < deviceChunks.length; n++) {
    var deviceChunk = deviceChunks[n].split(',');
    if (!deviceChunk.length) {
      continue;
    }
    switch (deviceChunk[0]) {
      case 's':
        // Sixense data.
        this.parseSixenseChunk_(state, deviceChunk, 1);
        break;
      case 'r':
        // Oculus data.
        this.parseHmdChunk_(state, deviceChunk, 1);
        break;
    }
  }

  // Query any info if needed.
  if (state.sixense.present && !this.sixenseInfo_) {
    // Sixense connected.
    this.sixenseInfo_ = this.querySixenseInfo_();
    // TODO(benvanik): fire event?
  } else if (!state.sixense.present && this.sixenseInfo_) {
    // Sixense disconnected.
    this.sixenseInfo_ = null;
    // TODO(benvanik): fire event?
  }
  if (state.hmd.present && !this.hmdInfo_) {
    // HMD connected.
    this.hmdInfo_ = this.queryHmdInfo_();
    // TODO(benvanik): fire event?
  } else if (!state.hmd.present && this.hmdInfo_) {
    // HMD disconnected.
    this.hmdInfo_ = null;
    // TODO(benvanik): fire event?
  }

  return true;
};


/**
 * Parses a Sixense data poll chunk and sets the state.
 * @param {!vr.State} state Target state.
 * @param {!Array.<string>} data Data elements.
 * @param {number} o Offset into data elements to start at.
 * @private
 */
vr.Runtime.prototype.parseSixenseChunk_ = function(state, data, o) {
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


/**
 * Parses an HMD data poll chunk and sets the state.
 * @param {!vr.State} state Target state.
 * @param {!Array.<string>} data Data elements.
 * @param {number} o Offset into data elements to start at.
 * @private
 */
vr.Runtime.prototype.parseHmdChunk_ = function(state, data, o) {
  if (data.length == 5) {
    state.hmd.present = true;
    state.hmd.rotation[0] = parseFloat(data[o++]);
    state.hmd.rotation[1] = parseFloat(data[o++]);
    state.hmd.rotation[2] = parseFloat(data[o++]);
    state.hmd.rotation[3] = parseFloat(data[o++]);
  } else {
    state.hmd.present = false;
  }
};


/**
 * Handles full screen change events.
 * @param {!Event} e Event.
 * @private
 */
vr.Runtime.prototype.fullScreenChange_ = function(e) {
  if (this.isFullScreen()) {
    // Entered fullscreen.
  } else {
    // Exited fullscreen.

    // Move the window back.
    if (this.oldWindowSize_) {
      window.moveTo(this.oldWindowSize_[0], this.oldWindowSize_[1]);
      window.resizeTo(this.oldWindowSize_[2], this.oldWindowSize_[3]);
      this.oldWindowSize_ = null;
    }
  }
};


/**
 * Detects whether the window is currently fullscreen.
 * @return {boolean} True if in full screen mode.
 */
vr.Runtime.prototype.isFullScreen = function() {
  var element =
      this.document_.fullScreenElement ||
      this.document_.mozFullScreenElement ||
      this.document_.webkitFullscreenElement;
  return !!element;
};


/**
 * Enters full screen mode, moving the window to the oculus display if present.
 * @return {boolean} True if the window entered fullscreen.
 */
vr.Runtime.prototype.enterFullScreen = function() {
  // Stash current window position.
  this.oldWindowSize_ = [
    global.screenX, global.screenY,
    global.outerWidth, global.outerHeight
  ];

  // Move to new position.
  // TODO(benvanik): make this work. I believe the API only works for popups.
  var hmdInfo = this.hmdInfo_;
  if (hmdInfo) {
    global.moveTo(hmdInfo.desktopX, hmdInfo.desktopY);
    global.resizeTo(hmdInfo.resolutionHorz, hmdInfo.resolutionVert);
  }

  // Enter fullscreen.
  var requestFullScreen =
      this.document_.documentElement.requestFullscreen ||
      this.document_.documentElement.mozRequestFullScreen ||
      this.document_.documentElement.webkitRequestFullScreen;
  requestFullScreen.call(
      this.document_.documentElement, Element.ALLOW_KEYBOARD_INPUT);

  return true;
};


/**
 * Exits fullscreen mode and moves the window back to its original position.
 */
vr.Runtime.prototype.exitFullScreen = function() {
  // Exit fullscreen.
  // The {@link vr.Runtime#fullScreenChange_} handler will move the window back.
  var cancelFullScreen =
      this.document_.cancelFullScreen ||
      this.document_.mozCancelFullScreen ||
      this.document_.webkitCancelFullScreen;
  if (cancelFullScreen) {
    cancelFullScreen.call(this.document_);
  }
};


/**
 * Logs to the console, if one is present.
 * This should be used for critical debugging messages only, as it has a
 * performance cost.
 * @param {...*} var_args Things to log.
 */
vr.Runtime.prototype.log = function(var_args) {
  if (global.console && global.console.log) {
    global.console.log.apply(global.console, arguments);
  }
}


// TODO(benvanik): move state/info to its own file


/**
 * HMD device info.
 * @param {Array.<number>=} opt_values Device values.
 * @constructor
 * @memberof vr
 */
vr.HmdInfo = function(opt_values) {
  /**
   * Horizontal resolution of the entire screen, in pixels.
   * @type {number}
   * @readonly
   */
  this.resolutionHorz = opt_values ? opt_values[0] : 1280;

  /**
   * Vertical resolution of the entire screen, in pixels.
   * @type {number}
   * @readonly
   */
  this.resolutionVert =opt_values ?  opt_values[1] : 800;

  /**
   * Horizontal physical size of the screen, in meters.
   * @type {number}
   * @readonly
   */
  this.screenSizeHorz = opt_values ? opt_values[2] : 0.14976;

  /**
   * Vertical physical size of the screen, in meters.
   * @type {number}
   * @readonly
   */
  this.screenSizeVert = opt_values ? opt_values[3] : 0.0936;

  /**
   * Physical offset from the top of the screen to the eye center, in meters.
   * This will usually, but not necessarily be half of
   * {@link vr.HmdInfo#screenSizeVert}.
   * @type {number}
   * @readonly
   */
  this.screenCenterVert = opt_values ? opt_values[4] : 800 / 2;

  /**
   * Distance from the eye to screen surface, in meters.
   * Useful for calculating FOV and projection.
   * @type {number}
   * @readonly
   */
  this.eyeToScreenDistance = opt_values ? opt_values[5] : 0.041;

  /**
   * Distance between physical lens centers useful for calculating distortion
   * center.
   * @type {number}
   * @readonly
   */
  this.lensSeparationDistance = opt_values ? opt_values[6] : 0.064;

  /**
   * Configured distance between the user's eye centers, in meters.
   * Defaults to 0.064.
   * @type {number}
   * @readonly
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
   * @readonly
   */
  this.distortionK = new Float32Array(opt_values ? [
    opt_values[8], opt_values[9], opt_values[10], opt_values[11]
  ] : [1.0, 0.22, 0.24, 0]);

  /**
   * Desktop coordinate position of the screen (can be negative) along X.
   * @type {number}
   * @readonly
   */
  this.desktopX = opt_values ? opt_values[12] : 0;

  /**
   * Desktop coordinate position of the screen (can be negative) along Y.
   * @type {number}
   * @readonly
   */
  this.desktopY = opt_values ? opt_values[13] : 0;
};


/**
 * Distorts the given value the same way the shader would.
 * @param {number} r Value to distort.
 * @return {number} Distorted value.
 */
vr.HmdInfo.prototype.distort = function(r) {
  var rsq = r * r;
  var K = this.distortionK;
  return r * (K[0] + K[1] * rsq + K[2] * rsq * rsq + K[3] * rsq * rsq * rsq);
};


/**
 * Default HMD info.
 * Do not modify.
 * @type {!vr.HmdInfo}
 */
vr.HmdInfo.DEFAULT = new vr.HmdInfo();



/**
 * HMD state data.
 * @constructor
 * @memberof vr
 */
vr.HmdState = function() {
  /**
   * Whether any HMD data is present in this state update.
   * Do not use any other values on this type if this is false.
   * @type {boolean}
   * @readonly
   */
  this.present = false;

  /**
   * Rotation quaternion.
   * @type {!Float32Array}
   * @readonly
   */
  this.rotation = new Float32Array(4);
};



/**
 * Bitmask values for the sixense controller buttons field.
 * @enum {number}
 * @memberof vr
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
 * @memberof vr
 */
vr.SixenseHand = {
  /** Hand has not yet been determined. */
  UNKNOWN: 0,
  /** Controller is in the left hand. */
  LEFT: 1,
  /** Controller is in the right hand. */
  RIGHT: 2
};



/**
 * Sixense device info.
 * @param {Array.<number>=} opt_values Device values.
 * @constructor
 * @memberof vr
 */
vr.SixenseInfo = function(opt_values) {
};



/**
 * Sixense state data.
 * @constructor
 * @memberof vr
 */
vr.SixenseState = function() {
  /**
   * Whether any sixense data is present in this state update.
   * Do not use any other values on this type if this is false.
   * @type {boolean}
   * @readonly
   */
  this.present = false;

  /**
   * Connected controllers.
   * @type {!Array.<!vr.SixenseControllerState>}
   * @readonly
   */
  this.controllers = [
    new vr.SixenseControllerState(),
    new vr.SixenseControllerState()
  ];
};



/**
 * Sixense controller state data.
 * @constructor
 * @memberof vr
 */
vr.SixenseControllerState = function() {
  /**
   * Position XYZ.
   * @type {!Float32Array}
   * @readonly
   */
  this.position = new Float32Array(3);

  /**
   * Rotation quaternion.
   * @type {!Float32Array}
   * @readonly
   */
  this.rotation = new Float32Array(4);

  /**
   * Joystick XY.
   * @type {!Float32Array}
   * @readonly
   */
  this.joystick = new Float32Array(2);

  /**
   * Trigger press value [0-1].
   * @type {number}
   * @readonly
   */
  this.trigger = 0.0;

  /**
   * A bitmask of {@link vr.SixenseButton} values indicating which buttons
   * are currently pressed.
   * @type {number}
   * @readonly
   */
  this.buttons = vr.SixenseButton.NONE;

  /**
   * Whether the controller is docked in the station.
   * Make the user place the controllers in the dock to get this value.
   * @type {boolean}
   * @readonly
   */
  this.isDocked = false;

  /**
   * The hand the controller represents, if it has been set.
   * Make the user place the controllers in the dock to get this value.
   * @type {vr.SixenseHand}
   * @readonly
   */
  this.hand = vr.SixenseHand.UNKNOWN;

  /**
   * Whether hemisphere tracking is enabled.
   * Make the user place the controllers in the dock to get this value.
   * @type {boolean}
   * @readonly
   */
  this.isTrackingHemispheres = false;
};



/**
 * VR state object.
 * This should be created and cached to enable efficient updates.
 * @constructor
 * @memberof vr
 */
vr.State = function() {
  /**
   * Sixense state.
   * @type {!vr.SixenseState}
   * @readonly
   */
  this.sixense = new vr.SixenseState();

  /**
   * HMD state.
   * @type {!vr.HmdState}
   * @readonly
   */
  this.hmd = new vr.HmdState();
};


// TODO(benvanik): move math to its own file


/**
 * @namespace vr.mat4f
 */
vr.mat4f = {};

/**
 * [ m00 m01 m02 m03    [  0  1  2  3
 *   m10 m11 m12 m13       4  5  6  7
 *   m20 m21 m22 m23       8  9 10 11
 *   m30 m31 m32 m33 ]    12 13 14 15 ]
 * @typedef {!Float32Array}
 */
vr.mat4f.Type;

vr.mat4f.create = function() {
  return new Float32Array(16);
};

vr.mat4f.makeIdentity = function(v) {
  v[0] = v[5] = v[10] = v[15] = 1;
  v[1] = v[2] = v[3] = v[4] = v[6] = v[7] = v[8] = v[9] = v[11] =
      v[12] = v[13] = v[14] = 0;
};

vr.mat4f.makeTranslation = function(v, x, y, z) {
  v[0] = v[5] = v[10] = v[15] = 1;
  v[1] = v[2] = v[3] = v[4] = v[6] = v[7] = v[8] = v[9] = v[11] = 0;
  v[12] = x;
  v[13] = y;
  v[14] = z;
};

vr.mat4f.makeRect = function(v, x, y, w, h) {
  v[0] = w;
  v[5] = h;
  v[10] = v[15] = 1;
  v[1] = v[2] = v[3] = v[4] = v[6] = v[7] = v[8] = v[9] = v[11] = v[14] = 0;
  v[12] = x;
  v[13] = y;
};

vr.mat4f.makePerspective = function(v, fovy, aspect, near, far) {
  var f = 1 / Math.tan(fovy / 2);
  var nf = 1 / (near - far);
  v[0] = f / aspect;
  v[1] = v[2] = v[3] = v[4] = 0;
  v[5] = f;
  v[6] = v[7] = v[8] = v[9] = 0;
  v[10] = (far + near) * nf;
  v[11] = -1;
  v[12] = v[13] = 0;
  v[14] = (2 * far * near) * nf;
  v[15] = 0;
};

vr.mat4f.multiply = function(v, a, b) {
  var a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3];
  var a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7];
  var a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11];
  var a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15];
  var b0, b1, b2, b3;
  b0 = b[0]; b1 = b[1]; b2 = b[2]; b3 = b[3];
  v[0] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  v[1] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  v[2] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  v[3] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[4]; b1 = b[5]; b2 = b[6]; b3 = b[7];
  v[4] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  v[5] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  v[6] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  v[7] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[8]; b1 = b[9]; b2 = b[10]; b3 = b[11];
  v[8] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  v[9] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  v[10] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  v[11] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
  b0 = b[12]; b1 = b[13]; b2 = b[14]; b3 = b[15];
  v[12] = b0 * a00 + b1 * a10 + b2 * a20 + b3 * a30;
  v[13] = b0 * a01 + b1 * a11 + b2 * a21 + b3 * a31;
  v[14] = b0 * a02 + b1 * a12 + b2 * a22 + b3 * a32;
  v[15] = b0 * a03 + b1 * a13 + b2 * a23 + b3 * a33;
};



// TODO(benvanik): move webgl to its own file

/**
 * WebGL program object.
 * Designed to support async compilation/linking.
 * When creating many programs first call {@link vr.Program#beginLinking} on all
 * of them followed by a {@link vr.Program#endLinking} on all of them.
 * @param {!WebGLRenderingContext} gl WebGL context.
 * @param {string} displayName Debug name.
 * @param {string} vertexShaderSource Vertex shader source.
 * @param {string} fragmentShaderSource Fragment shader source.
 * @param {!Array.<string>} attributeNames A list of attribute names.
 * @param {!Array.<string>} uniformNames A list of uniform names.
 * @constructor
 * @memberof vr
 */
vr.Program = function(gl, displayName,
    vertexShaderSource, fragmentShaderSource,
    attributeNames, uniformNames) {
  /**
   * WebGL context.
   * @type {!WebGLRenderingContext}
   * @private
   */
  this.gl_ = gl;

  /**
   * Attribute names to locations.
   * @type {!Object.<number>}
   * @readonly
   */
  this.attributes = {};
  for (var n = 0; n < attributeNames.length; n++) {
    this.attributes[attributeNames[n]] = -1;
  }

  /**
   * Uniform names to locations.
   * @type {!Object.<!WebGLUniformLocation>}
   * @readonly
   */
  this.uniforms = {};
  for (var n = 0; n < uniformNames.length; n++) {
    this.uniforms[uniformNames[n]] = null;
  }

  /**
   * WebGL program object.
   * @type {!WebGLProgram}
   * @private
   */
  this.program_ = gl.createProgram();
  this.program_.displayName = displayName;

  // Create shaders and attach to program.
  // The program retains them and we no longer need them.
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  vertexShader.displayName = displayName + ':VS';
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.attachShader(this.program_, vertexShader);
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  fragmentShader.displayName = displayName + ':FS';
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.attachShader(this.program_, fragmentShader);
};


/**
 * Disposes the object.
 */
vr.Program.prototype.dispose = function() {
  var gl = this.gl_;
  gl.deleteProgram(this.program_);
};


/**
 * Compiles the shaders and begins linking.
 * This must be followed by a call to {@link vr.Program#endLinking}.
 * Shader/program errors will not be queried until then.
 */
vr.Program.prototype.beginLinking = function() {
  var gl = this.gl_;
  var shaders = gl.getAttachedShaders(this.program_);
  for (var n = 0; n < shaders.length; n++) {
    gl.compileShader(shaders[n]);
  }
  gl.linkProgram(this.program_);
};


/**
 * Links the program and throws on any compile/link errors.
 */
vr.Program.prototype.endLinking = function() {
  var gl = this.gl_;

  // Gather shader compilation errors/warnings.
  var shaders = gl.getAttachedShaders(this.program_);
  for (var n = 0; n < shaders.length; n++) {
    var shaderName = shaders[n].displayName;
    var shaderInfoLog = gl.getShaderInfoLog(shaders[n]);
    var compiled = !!gl.getShaderParameter(shaders[n], gl.COMPILE_STATUS);
    if (!compiled) {
      // Error.
      throw 'Shader ' + shaderName + ' compilation errors:\n' +
          shaderInfoLog;
    } else if (shaderInfoLog && shaderInfoLog.length) {
      // Warning.
      vr.log('Shader ' + shaderName + ' compilation warnings:\n' +
          shaderInfoLog);
    }
  }

  // Gather link errors/warnings.
  var programName = this.program_.displayName;
  var programInfoLog = gl.getProgramInfoLog(this.program_);
  var linked = !!gl.getProgramParameter(this.program_, gl.LINK_STATUS);
  if (!linked) {
    // Error.
    throw 'Program ' + programName + ' link errors:\n' +
        programInfoLog;
  } else if (programInfoLog && programInfoLog.length) {
    // Warning.
    vr.log('Program ' + programName + ' link warnings:\n' +
        programInfoLog);
  }

  // Grab attribute/uniform locations.
  for (var attribName in this.attributes) {
    this.attributes[attribName] =
        gl.getAttribLocation(this.program_, attribName);
  }
  for (var uniformName in this.uniforms) {
    this.uniforms[uniformName] =
        gl.getUniformLocation(this.program_, uniformName);
  }
};


/**
 * Uses the program on the current GL context.
 */
vr.Program.prototype.use = function() {
  this.gl_.useProgram(this.program_);
};




// TODO(benvanik): move stereo eye/params its own file


/**
 * An eye.
 * Contains matrices used when rendering the viewport.
 * @param {number} left Left, in [0-1] view coordinates.
 * @param {number} top Top, in [0-1] view coordinates.
 * @param {number} width Width, in [0-1] view coordinates.
 * @param {number} height Height, in [0-1] view coordinates.
 * @constructor
 * @memberof vr
 */
vr.StereoEye = function(left, top, width, height) {
  /**
   * 2D viewport used when compositing, in [0-1] view coordinates.
   * Stored as [left, top, width, height].
   * @type {!Array.<number>}
   * @readonly
   */
  this.viewport = [left, top, width, height];

  /**
   * Eye-specific distortion center X.
   * @type {number}
   * @readonly
   */
  this.distortionCenterOffsetX = 0;

  /**
   * Eye-specific distortion center Y.
   * @type {number}
   * @readonly
   */
  this.distortionCenterOffsetY = 0;

  /**
   * Matrix used for drawing 3D things.
   * @type {!vr.mat4f.Type}
   * @readonly
   */
  this.projectionMatrix = new Float32Array(16);

  /**
   * Translation to be applied to the view matrix.
   * @type {!vr.mat4f.Type}
   * @readonly
   */
  this.viewAdjustMatrix = new Float32Array(16);

  /**
   * Matrix used for drawing 2D things, like HUDs.
   * @type {!vr.mat4f.Type}
   * @readonly
   */
  this.orthoProjectionMatrix = new Float32Array(16);
};



/**
 * Stereo rendering parameters.
 * @constructor
 * @memberof vr
 */
vr.StereoParams = function() {
  /**
   * Near plane Z.
   * @type {number}
   * @private
   */
  this.zNear_ = 0.01;

  /**
   * Far plane Z.
   * @type {number}
   * @private
   */
  this.zFar_ = 1000;

  /**
   * Overridden IPD from the device.
   * If this is undefined the value from the HMD info will be used instead.
   * @type {number|undefined}
   * @private
   */
  this.interpupillaryDistance_ = undefined;

  /**
   * Scale by which the input render texture is scaled by to make the
   * post-distortion result fit the viewport.
   * @type {number}
   * @private
   */
  this.distortionScale_ = 1;

  // Constants for now.
  this.distortionFitX_ = -1;
  this.distortionFitY_ = 0;

  /**
   * Eyes.
   * Each eye contains the matrices and bounding data used when rendering.
   * @type {!Array.<!vr.StereoEye>}
   * @private
   */
  this.eyes_ = [
    new vr.StereoEye(0, 0, 0.5, 1),
    new vr.StereoEye(0.5, 0, 0.5, 1)
  ];

  /**
   * Cached matrices used for temporary math.
   * @type {!Array.<!vr.mat4f>}
   * @private
   */
  this.tmpMat4s_ = [vr.mat4f.create(), vr.mat4f.create()];
};


/**
 * Sets the value of the near Z plane.
 * @param {number} value New value.
 */
vr.StereoParams.prototype.setZNear = function(value) {
  this.zNear_ = value;
};


/**
 * Sets the value of the far Z plane.
 * @param {number} value New value.
 */
vr.StereoParams.prototype.setZFar = function(value) {
  this.zFar_ = value;
};


/**
 * Gets the current value of the interpupillary distance, if overriden.
 * @return {number|undefined} Current value or undefined if not set.
 */
vr.StereoParams.prototype.getInterpupillaryDistance = function() {
  return this.interpupillaryDistance_;
};


/**
 * Sets the value of the interpupillary distance override.
 * Use a value of undefined to clear the override and use device defaults.
 * @param {number|undefined} value New value or undefined to disable override.
 */
vr.StereoParams.prototype.setInterpupillaryDistance = function(value) {
  this.interpupillaryDistance_ = value;
};


/**
 * Gets the distortion scale.
 * The data in the eyes must be updated for the frame with a call to
 * {@link vr.StereoParams#update}.
 * @return {number} Distortion scale.
 */
vr.StereoParams.prototype.getDistortionScale = function() {
  return this.distortionScale_;
};


/**
 * Gets a list of eyes.
 * The data in the eyes must be updated for the frame with a call to
 * {@link vr.StereoParams#update}.
 * @return {!Array.<!vr.StereoEye>}
 */
vr.StereoParams.prototype.getEyes = function() {
  return [this.eyes_[0], this.eyes_[1]];
};


/**
 * Updates the stereo parameters with the given HMD data.
 * @param {!vr.HmdInfo} info HMD info.
 */
vr.StereoParams.prototype.update = function(info) {
  var interpupillaryDistance = info.interpupillaryDistance;
  if (this.interpupillaryDistance_ !== undefined) {
    interpupillaryDistance = this.interpupillaryDistance_;
  }

  // -- updateDistortionOffsetAndScale --

  var lensOffset = info.lensSeparationDistance / 2;
  var lensShift = info.screenSizeHorz / 4 - lensOffset;
  var lensViewportShift = 4 * lensShift / info.screenSizeHorz;
  var distortionCenterOffsetX = lensViewportShift;
  if (Math.abs(this.distortionFitX_) < 0.0001 &&
      Math.abs(this.distortionFitY_) < 0.0001) {
    this.distortionScale_ = 1;
  } else {
    var stereoAspect = info.resolutionHorz / info.resolutionVert / 2;
    var dx = this.distortionFitX_ - distortionCenterOffsetX;
    var dy = this.distortionFitY_ / stereoAspect;
    var fitRadius = Math.sqrt(dx * dx + dy * dy);
    this.distortionScale_ = info.distort(fitRadius) / fitRadius;
  }

  // -- updateComputedState --

  var percievedHalfRTDistance = info.screenSizeVert / 2 * this.distortionScale_;
  var fovY = 2 * Math.atan(percievedHalfRTDistance / info.eyeToScreenDistance);

  // -- updateProjectionOffset --

  var viewCenter = info.screenSizeHorz / 4;
  var eyeProjectionShift = viewCenter - interpupillaryDistance / 2;
  var projectionCenterOffset = 4 * eyeProjectionShift / info.screenSizeHorz;

  // -- update2D --

  var eyeDistanceScreenPixels =
      (info.resolutionHorz / info.screenSizeHorz) * interpupillaryDistance;
  var offCenterShiftPixels =
      (info.eyeToScreenDistance / 0.8) * eyeDistanceScreenPixels;
  var leftPixelCenter = (info.resolutionHorz / 2) - eyeDistanceScreenPixels / 2;
  var rightPixelCenter = eyeDistanceScreenPixels / 2;
  var pixelDifference = leftPixelCenter - rightPixelCenter;
  var area2dfov = 85 * Math.PI / 180;
  var percievedHalfScreenDistance =
      Math.tan(area2dfov / 2) * info.eyeToScreenDistance;
  var vfovSize = 2.0 * percievedHalfScreenDistance / this.distortionScale_;
  var fovPixels = info.resolutionVert * vfovSize / info.screenSizeVert;
  var orthoPixelOffset =
      (pixelDifference + offCenterShiftPixels / this.distortionScale_) / 2;
  orthoPixelOffset = orthoPixelOffset * 2 / fovPixels;

  // -- updateEyeParams --
  var eyeL = this.eyes_[0];
  var eyeR = this.eyes_[1];

  eyeL.distortionCenterOffsetX = distortionCenterOffsetX;
  eyeL.distortionCenterOffsetY = 0;
  eyeR.distortionCenterOffsetX = -distortionCenterOffsetX;
  eyeR.distortionCenterOffsetY = 0;

  vr.mat4f.makeIdentity(eyeL.viewAdjustMatrix);
  eyeL.viewAdjustMatrix[12] = interpupillaryDistance / 2;
  vr.mat4f.makeIdentity(eyeR.viewAdjustMatrix);
  eyeR.viewAdjustMatrix[12] = -interpupillaryDistance / 2;

  // eye proj = proj offset * proj center
  var projMatrix = this.tmpMat4s_[0];
  var projOffsetMatrix = this.tmpMat4s_[1];
  var aspect = info.resolutionHorz / info.resolutionVert / 2;
  vr.mat4f.makePerspective(projMatrix, fovY, aspect, this.zNear_, this.zFar_);
  vr.mat4f.makeTranslation(projOffsetMatrix, projectionCenterOffset, 0, 0);
  vr.mat4f.multiply(eyeL.projectionMatrix, projOffsetMatrix, projMatrix);
  vr.mat4f.makeTranslation(projOffsetMatrix, -projectionCenterOffset, 0, 0);
  vr.mat4f.multiply(eyeR.projectionMatrix, projOffsetMatrix, projMatrix);

  // eye ortho = ortho center * ortho offset
  var orthoMatrix = this.tmpMat4s_[0];
  var orthoOffsetMatrix = this.tmpMat4s_[1];
  vr.mat4f.makeIdentity(orthoMatrix);
  orthoMatrix[0] = fovPixels / (info.resolutionHorz / 2);
  orthoMatrix[5] = -fovPixels / info.resolutionVert;
  vr.mat4f.makeTranslation(orthoOffsetMatrix, orthoPixelOffset, 0, 0);
  vr.mat4f.multiply(eyeL.orthoProjectionMatrix, orthoMatrix, orthoOffsetMatrix);
  vr.mat4f.makeTranslation(orthoOffsetMatrix, -orthoPixelOffset, 0, 0);
  vr.mat4f.multiply(eyeR.orthoProjectionMatrix, orthoMatrix, orthoOffsetMatrix);
};



// TODO(benvanik): move stereo renderer to its own file


/**
 * Stereo rendering controller.
 * Responsible for setting up stereo rendering and drawing the scene each frame.
 * @param {!WebGLRenderingContext} gl GL context.
 * @param {vr.StereoRenderer.Attributes=} opt_attributes Render target
 *     attributes.
 * @constructor
 * @memberof vr
 */
vr.StereoRenderer = function(gl, opt_attributes) {
  /**
   * WebGL context.
   * @type {!WebGLRenderingContext}
   * @private
   */
  this.gl_ = gl;

  /**
   * Render target attributes.
   * Values may be omitted.
   * @type {!vr.StereoRenderer.Attributes}
   * @private
   */
  this.attributes_ = opt_attributes || {};

  /**
   * Whether the renderer has been initialized yet.
   * Invalid to draw if this is false.
   * @type {boolean}
   * @private
   */
  this.isInitialized_ = false;

  /**
   * Whether a real HMD is present.
   * @type {boolean}
   * @private
   */
  this.hmdPresent_ = false;

  /**
   * Current HMD info.
   * If no HMD is present this is set to the default info used for testing.
   * @type {!vr.HmdInfo}
   * @private
   */
  this.hmdInfo_ = new vr.HmdInfo();

  /**
   * 2D quad data buffer.
   * @type {!WebGLBuffer}
   * @private
   */
  this.quadBuffer_ = gl.createBuffer();
  this.quadBuffer_.displayName = 'vr.StereoRendererQuad';
  var previousBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer_);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0, 0, 0, // TL   x-x
    1, 0, 1, 0, // TR   |/
    0, 1, 0, 1, // BL   x
    1, 0, 1, 0, // TR     x
    1, 1, 1, 1, // BR    /|
    0, 1, 0, 1  // BL   x-x
  ]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, previousBuffer);

  /**
   * Warp program.
   * Draws a single eye distored to a render target.
   * @type {!Program}
   * @private
   */
  this.warpProgram_ = new vr.Program(gl, 'vr.StereoRendererWarp',
      vr.StereoRenderer.WARP_VERTEX_SOURCE_,
      vr.StereoRenderer.WARP_FRAGMENT_SOURCE_,
      //vr.StereoRenderer.STRAIGHT_FRAGMENT_SOURCE_,
      vr.StereoRenderer.WARP_ATTRIBUTE_NAMES_,
      vr.StereoRenderer.WARP_UNIFORM_NAMES_);

  /**
   * Whether all uniform values need to be updated for the program.
   * This is used to prevent some redundant uniform calls for values that don't
   * change frequently.
   * @type {boolean}
   * @private
   */
  this.updateAllUniforms_ = true;

  /**
   * Framebuffer used for drawing the scene.
   * Managed by {@link vr.StereoRenderer#initialize_}.
   * @type {!WebGLFramebuffer}
   * @private
   */
  this.framebuffer_ = gl.createFramebuffer();
  this.framebuffer_.displayName = 'vr.StereoRendererFB';

  /**
   * Renderbuffers attached to the framebuffer, excluding the render texture.
   * Makes for easier cleanup.
   * @type {!Array.<!WebGLRenderbuffer>}
   * @private
   */
  this.framebufferAttachments_ = [];

  /**
   * The width of the render target used for drawing the scene.
   * Managed by {@link vr.StereoRenderer#initialize_}.
   * @type {number}
   * @private
   */
  this.renderTargetWidth_ = 0;

  /**
   * The height of the render target used for drawing the scene.
   * Managed by {@link vr.StereoRenderer#initialize_}.
   * @type {number}
   * @private
   */
  this.renderTargetHeight_ = 0;

  /**
   * Render texture used for drawing the scene.
   * Managed by {@link vr.StereoRenderer#initialize_}.
   * @type {!WebGLTexture}
   * @private
   */
  this.renderTexture_ = gl.createTexture();
  this.renderTexture_.displayName = 'vr.StereoRendererRT';

  /**
   * Stereo parameters.
   * These may change at any time, and should be verified each update.
   * @type {!StereoParams}
   * @private
   */
  this.stereoParams_ = new vr.StereoParams();

  /**
   * Cached matrix used for temporary math.
   * @type {!vr.mat4f.Type}
   * @private
   */
  this.tmpMat4_ = vr.mat4f.create();

  // TODO(benvanik): all programs async.
  this.warpProgram_.beginLinking();
  this.warpProgram_.endLinking();
};


/**
 * Render target attributes.
 * @typedef {{
 *   alpha: boolean|undefined,
 *   depth: boolean|undefined,
 *   stencil: boolean|undefine
 * }}
 */
vr.StereoRenderer.Attributes;


/**
 * The render target used for rendering the scene will be this much larger
 * than the HMD's resolution, to compensate for the resolution loss from the
 * warping shader.
 * @type {number}
 * @const
 * @private
 */
vr.StereoRenderer.RENDER_TARGET_SCALE_ = 2;


/**
 * Disposes the object.
 */
vr.StereoRenderer.prototype.dispose = function() {
  var gl = this.gl_;
  for (var n = 0; n < this.framebufferAttachments_.length; n++) {
    gl.deleteRenderbuffer(this.framebufferAttachments_[n]);
  }
  gl.deleteTexture(this.renderTexture_);
  gl.deleteFramebuffer(this.framebuffer_);
  gl.deleteBuffer(this.quadBuffer_);
  this.warpProgram_.dispose();
};


/**
 * Gets the parameters used for stereo rendering.
 * @return {!vr.StereoParams} Stereo params.
 */
vr.StereoRenderer.prototype.getParams = function() {
  return this.stereoParams_;
};


/**
 * Initializes the renderer when the HMD changes.
 * @private
 */
vr.StereoRenderer.prototype.initialize_ = function() {
  var gl = this.gl_;
  var info = this.hmdInfo_;

  // Resize canvas to HMD resolution.
  // Also ensure device pixel size is 1:1.
  gl.canvas.width = info.resolutionHorz;
  gl.canvas.height = info.resolutionVert;
  gl.canvas.style.width = gl.canvas.width + 'px';
  gl.canvas.style.height = gl.canvas.height + 'px';

  // Resize framebuffer and validate.
  this.setupRenderTarget_(
      info.resolutionHorz * vr.StereoRenderer.RENDER_TARGET_SCALE_,
      info.resolutionVert * vr.StereoRenderer.RENDER_TARGET_SCALE_);

  // Update program uniforms next render.
  this.updateAllUniforms_ = true;

  this.isInitialized_ = true;
};


/**
 * Sets up the render target for drawing the scene.
 * @param {number} width Render target width.
 * @param {number} height Render target height.
 * @private
 */
vr.StereoRenderer.prototype.setupRenderTarget_ = function(width, height) {
  var gl = this.gl_;

  width = Math.floor(width) || 4;
  height = Math.floor(height) || 4;
  this.renderTargetWidth_ = width;
  this.renderTargetHeight_ = height;

  var previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  var previousRenderbuffer = gl.getParameter(gl.RENDERBUFFER_BINDING);
  var previousTexture2d = gl.getParameter(gl.TEXTURE_BINDING_2D);

  gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer_);

  // Resize texture.
  gl.bindTexture(gl.TEXTURE_2D, this.renderTexture_);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0,
      this.attributes_.alpha ? gl.RGBA : gl.RGB,
      width, height, 0,
      this.attributes_.alpha ? gl.RGBA : gl.RGB,
      gl.UNSIGNED_BYTE, null);

  // Attach color texture.
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
      this.renderTexture_, 0);

  // Cleanup previous attachments.
  for (var n = 0; n < this.framebufferAttachments_.length; n++) {
    gl.deleteRenderbuffer(this.framebufferAttachments_[n]);
  }
  this.framebufferAttachments_ = [];

  // Setup depth/stencil textures.
  var depthBuffer = null;
  if (this.attributes_.depth) {
    depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
        width, height);
    this.framebufferAttachments_.push(depthBuffer);
  }
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER, depthBuffer);
  var stencilBuffer = null;
  if (this.attributes_.stencil) {
    stencilBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, stencilBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8, width, height);
    this.framebufferAttachments_.push(stencilBuffer);
  }
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT,
      gl.RENDERBUFFER, stencilBuffer);

  // Verify.
  var status = gl.FRAMEBUFFER_COMPLETE;
  // TODO(benvanik): debug only.
  status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

  gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
  gl.bindRenderbuffer(gl.RENDERBUFFER, previousRenderbuffer);
  gl.bindTexture(gl.TEXTURE_2D, previousTexture2d);

  if (status != gl.FRAMEBUFFER_COMPLETE) {
    throw 'Invalid framebuffer: ' + status;
  }
};


/**
 * Gets the current interpupillary distance value.
 * @return {number} IPD value.
 */
vr.StereoRenderer.prototype.getInterpupillaryDistance = function() {
  var info = this.hmdInfo_;
  var ipd = this.stereoParams_.getInterpupillaryDistance();
  return (ipd !== undefined) ? ipd : info.interpupillaryDistance;
};


/**
 * Sets a new interpupillary distance value.
 * @param {number} value New IPD value.
 */
vr.StereoRenderer.prototype.setInterpupillaryDistance = function(value) {
  this.stereoParams_.setInterpupillaryDistance(value);
};


/**
 * Updates the stereo data and renders the scene.
 * The given callback is used to perform the render and may be called more than
 * once. It receives the width and height of the render target and the eye used
 * to render.
 * @param {function(this:T, number, number, !StereoEye)} callback Callback.
 * @param {T=} opt_scope Scope.
 * @template T
 */
vr.StereoRenderer.prototype.render = function(vrstate, callback, opt_scope) {
  var gl = this.gl_;

  var nowPresent = vrstate.hmd.present;
  if (nowPresent != this.hmdPresent_) {
    this.hmdPresent_ = true;
    if (nowPresent) {
      // HMD connected! Query info.
      this.hmdInfo_ = vr.getHmdInfo();
    } else {
      // Disconnected. Reset to defaults.
      this.hmdInfo_ = new vr.HmdInfo();
    }
    this.initialize_();
  }

  // Update stereo parameters based on VR state.
  this.stereoParams_.update(this.hmdInfo_);

  // Skip drawing if not ready.
  if (!this.isInitialized_) {
    return;
  }

  // Render.
  var eyes = this.stereoParams_.getEyes();
  for (var n = 0; n < eyes.length; n++) {
    var eye = eyes[n];

    // Render to the render target.
    // The user will clear if needed.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer_);
    gl.viewport(
        eye.viewport[0] * this.renderTargetWidth_,
        eye.viewport[1] * this.renderTargetHeight_,
        eye.viewport[2] * this.renderTargetWidth_,
        eye.viewport[3] * this.renderTargetHeight_);
    callback.call(opt_scope,
        this.renderTargetWidth_, this.renderTargetHeight_, eye);

    // Distort to the screen.
    // TODO(benvanik): allow the user to specify a render target?
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.renderEye_(eye);
  }

  // User shouldn't be doing anything after this. Flush now.
  gl.flush();
};


/**
 * Renders the given eye to the target framebuffer with distortion.
 * @param {!StereoEye} eye Eye to render.
 * @private
 */
vr.StereoRenderer.prototype.renderEye_ = function(eye) {
  var gl = this.gl_;

  // Source the input texture.
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.renderTexture_);

  this.warpProgram_.use();

  // Update all uniforms, if needed.
  if (this.updateAllUniforms_) {
    this.updateAllUniforms_ = false;
    gl.uniform1i(this.warpProgram_.uniforms['u_tex0'], 0);
    gl.uniform4fv(this.warpProgram_.uniforms['u_hmdWarpParam'],
        this.hmdInfo_.distortionK);
  }

  // Calculate eye uniforms for offset.
  var fullWidth = this.hmdInfo_.resolutionHorz;
  var fullHeight = this.hmdInfo_.resolutionVert;
  var x = eye.viewport[0];
  var y = eye.viewport[1];
  var w = eye.viewport[2];
  var h = eye.viewport[3];
  var aspect = (w * fullWidth) / (h * fullHeight);
  var scale = 1 / this.stereoParams_.getDistortionScale();

  // Texture matrix used to scale the input render target.
  var texMatrix = this.tmpMat4_;
  vr.mat4f.makeRect(texMatrix, x, y, w, h);
  gl.uniformMatrix4fv(this.warpProgram_.uniforms['u_texMatrix'], false,
      texMatrix);

  gl.uniform2f(this.warpProgram_.uniforms['u_lensCenter'],
      x + (w + eye.distortionCenterOffsetX / 2) / 2, y + h / 2);
  gl.uniform2f(this.warpProgram_.uniforms['u_screenCenter'],
      x + w / 2, y + h / 2);
  gl.uniform2f(this.warpProgram_.uniforms['u_scale'],
      w / 2 * scale, h / 2 * scale * aspect);
  gl.uniform2f(this.warpProgram_.uniforms['u_scaleIn'],
      2 / w, 2 / h / aspect);

  // Viewport (in screen coordinates).
  gl.viewport(x * fullWidth, 0, w * fullWidth, fullHeight);

  // Setup attribs.
  var a_xy = this.warpProgram_.attributes.a_xy;
  var a_uv = this.warpProgram_.attributes.a_uv;
  gl.enableVertexAttribArray(a_xy);
  gl.enableVertexAttribArray(a_uv);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer_);
  gl.vertexAttribPointer(a_xy, 2, gl.FLOAT, false, 4 * 4, 0);
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

  // Draw the quad.
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // NOTE: the user must cleanup attributes themselves.
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
};


/**
 * Attribute names for the warp program.
 * @type {!Array.<string>}
 * @private
 */
vr.StereoRenderer.WARP_ATTRIBUTE_NAMES_ = [
  'a_xy', 'a_uv'
];


/**
 * Uniform names for the warp program.
 * @type {!Array.<string>}
 * @private
 */
vr.StereoRenderer.WARP_UNIFORM_NAMES_ = [
  'u_texMatrix',
  'u_tex0',
  'u_lensCenter', 'u_screenCenter', 'u_scale', 'u_scaleIn', 'u_hmdWarpParam'
];


/**
 * Source code for the warp vertex shader.
 * @type {string}
 * @const
 * @private
 */
vr.StereoRenderer.WARP_VERTEX_SOURCE_ = [
  'attribute vec2 a_xy;',
  'attribute vec2 a_uv;',
  'varying vec2 v_uv;',
  'uniform mat4 u_texMatrix;',
  'void main() {',
  '  gl_Position = vec4(2.0 * a_xy - 1.0, 0.0, 1.0);',
  '  v_uv = (u_texMatrix * vec4(a_uv, 0.0, 1.0)).xy;',
  '}'
].join('\n');


/**
 * Source code for the warp fragment shader.
 * @type {string}
 * @const
 * @private
 */
vr.StereoRenderer.WARP_FRAGMENT_SOURCE_ = [
  'precision highp float;',
  'varying vec2 v_uv;',
  'uniform sampler2D u_tex0;',
  'uniform vec2 u_lensCenter;',
  'uniform vec2 u_screenCenter;',
  'uniform vec2 u_scale;',
  'uniform vec2 u_scaleIn;',
  'uniform vec4 u_hmdWarpParam;',
  'vec2 hmdWarp(vec2 texIn) {',
  '  vec2 theta = (texIn - u_lensCenter) * u_scaleIn;',
  '  float rSq = theta.x * theta.x + theta.y * theta.y;',
  '  vec2 theta1 = theta * (u_hmdWarpParam.x + u_hmdWarpParam.y * rSq + ',
  '      u_hmdWarpParam.z * rSq * rSq + u_hmdWarpParam.w * rSq * rSq * rSq);',
  '  return u_lensCenter + u_scale * theta1;',
  '}',
  'void main() {',
  '  vec2 tc = hmdWarp(v_uv);',
  '  if (any(notEqual(clamp(tc, u_screenCenter - vec2(0.25, 0.5), ',
  '      u_screenCenter + vec2(0.25, 0.5)) - tc, vec2(0.0, 0.0)))) {',
  '    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
  '  } else {',
  //'    gl_FragColor = vec4(0.0, tc.xy, 1.0);',
  '    gl_FragColor = texture2D(u_tex0, tc);',
  '  }',
  '}'
].join('\n');


/**
 * Source code for the warp fragment shader in debug mode.
 * This just passes the texture right through.
 * @type {string}
 * @const
 * @private
 */
vr.StereoRenderer.STRAIGHT_FRAGMENT_SOURCE_ = [
  'precision highp float;',
  'varying vec2 v_uv;',
  'uniform sampler2D u_tex0;',
  'void main() {',
  '  gl_FragColor = texture2D(u_tex0, v_uv);',
  '}'
].join('\n');



/**
 * @type {!vr.Runtime}
 * @global
 * @alias module:vr
 */
global.vr = new vr.Runtime(global.document);

})(window);
