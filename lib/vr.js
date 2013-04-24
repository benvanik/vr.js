// NOTE: this is all super experimental and subject to change!


(function(global) {


/**
 * VR object.
 * @param {!Document} document HTML document.
 * @constructor
 */
var VR = function(document) {
  /**
   * HTML document.
   * @type {!Document}
   * @private
   */
  this.document_ = document;

  /**
   * Whether the plugin is installed.
   * @type {boolean}
   */
  this.isInstalled = this.detectPlugin_();

  /**
   * Whether the plugin is initialized.
   * @type {boolean}
   */
  this.isLoaded = false;

  /**
   * The error that occurred during initialization, if any.
   * @type {Object}
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
VR.prototype.detectPlugin_ = function() {
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
VR.prototype.createEmbed_ = function() {
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
VR.prototype.waitForDomReady_ = function(callback, opt_scope) {
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
VR.prototype.load = function(opt_callback, opt_scope) {
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
VR.prototype.loadDomReady_ = function() {
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
VR.prototype.completeLoad_ = function(opt_error) {
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
VR.prototype.execCommand_ = function(commandId, opt_commandData) {
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
VR.prototype.queryHmdInfo_ = function() {
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
 * This is populated on demand by calling {@see #poll}.
 * @return {vr.HmdInfo} HMD info, if any.
 */
VR.prototype.getHmdInfo = function() {
  return this.hmdInfo_;
};


/**
 * Resets the current orientation of the headset to be zero.
 */
VR.prototype.resetHmdOrientation = function() {
  this.execCommand_(2);
};


/**
 * Queries the connected Sixense device.
 * @return {vr.SixenseInfo} Device info or null if none attached.
 * @private
 */
VR.prototype.querySixenseInfo_ = function() {
  // TODO(benvanik): a real query
  return new vr.SixenseInfo();
};


/**
 * Gets the information of the currently connected Sixense device, if any.
 * This is populated on demand by calling {@see #poll}.
 * @return {vr.SixenseInfo} Sixense info, if any.
 */
VR.prototype.getSixenseInfo = function() {
  return this.sixenseInfo_;
};


/**
 * Polls active devices and fills in the state structure.
 * This also takes care of dispatching device notifications/etc.
 * @param {!vr.State} state State structure to fill in. This is the result of
 *     a call to {@see #createState}.
 * @return {boolean} True if the state query was successful.
 */
VR.prototype.poll = function(state) {
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
VR.prototype.parseSixenseChunk_ = function(state, data, o) {
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
VR.prototype.parseHmdChunk_ = function(state, data, o) {
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
 * @type {!Event} e Event.
 * @private
 */
VR.prototype.fullScreenChange_ = function(e) {
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
VR.prototype.isFullScreen = function() {
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
VR.prototype.enterFullScreen = function() {
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
VR.prototype.exitFullScreen = function() {
  // Exit fullscreen.
  // The {@see fullScreenChange} handler will move the window back.
  var cancelFullScreen =
      this.document_.cancelFullScreen ||
      this.document_.mozCancelFullScreen ||
      this.document_.webkitCancelFullScreen;
  if (cancelFullScreen) {
    cancelFullScreen.call(this.document_);
  }
};


// Shared object.
global.vr = new VR(global.document);



/**
 * HMD device info.
 * @param {Array.<number>=} opt_values Device values.
 * @constructor
 */
vr.HmdInfo = function(opt_values) {
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
vr.HmdInfo.prototype.distort = function(r) {
  var rsq = r * r;
  var K = this.distortionK;
  return r * (K[0] + K[1] * rsq + K[2] * rsq * rsq + K[3] * rsq * rsq * rsq);
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
 */
vr.SixenseInfo = function(opt_values) {
};



/**
 * VR state object.
 * This should be created and cached to enable efficient updates.
 * @constructor
 */
vr.State = function() {
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
  this.hmd = {
    present: false,
    rotation: new Float32Array(4)
  }
};



/**
 * [ m00 m01 m02 m03    [  0  1  2  3
 *   m10 m11 m12 m13       4  5  6  7
 *   m20 m21 m22 m23       8  9 10 11
 *   m30 m31 m32 m33 ]    12 13 14 15 ]
 * @typedef {!Float32Array}
 */
vr.mat4f = {};

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

var tmpMat4f0 = new Float32Array(16);
var tmpMat4f1 = new Float32Array(16);



/**
 * An eye.
 * Contains matrices used when rendering the viewport.
 * @param {number} left Left, in [0-1] view coordinates.
 * @param {number} top Top, in [0-1] view coordinates.
 * @param {number} width Width, in [0-1] view coordinates.
 * @param {number} height Height, in [0-1] view coordinates.
 * @constructor
 */
vr.StereoEye = function(left, top, width, height) {
  /**
   * 2D viewport used when compositing, in [0-1] view coordinates.
   * Stored as [left, top, width, height].
   * @type {!Array.<number>}
   */
  this.viewport = [left, top, width, height];

  /**
   * Eye-specific distortion center X.
   * @type {number}
   */
  this.distortionCenterOffsetX = 0;

  /**
   * Eye-specific distortion center Y.
   * @type {number}
   */
  this.distortionCenterOffsetY = 0;

  /**
   * Matrix used for drawing 3D things.
   * @type {!vr.mat4f}
   */
  this.projectionMatrix = new Float32Array(16);

  /**
   * Translation to be applied to the view matrix.
   * @type {!vr.mat4f}
   */
  this.viewAdjustMatrix = new Float32Array(16);

  /**
   * Matrix used for drawing 2D things, like HUDs.
   * @type {!vr.mat4f}
   */
  this.orthoProjectionMatrix = new Float32Array(16);
};



/**
 * Stereo rendering parameters.
 * @constructor
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
   */
  this.eyes_ = [
    new vr.StereoEye(0, 0, 0.5, 1),
    new vr.StereoEye(0.5, 0, 0.5, 1)
  ];
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
 * {@see #update}.
 * @return {number} Distortion scale.
 */
vr.StereoParams.prototype.getDistortionScale = function() {
  return this.distortionScale_;
};


/**
 * Gets a list of eyes.
 * The data in the eyes must be updated for the frame with a call to
 * {@see #update}.
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
  var aspect = info.resolutionHorz / info.resolutionVert / 2;
  vr.mat4f.makePerspective(tmpMat4f0, fovY, aspect, this.zNear_, this.zFar_);
  vr.mat4f.makeTranslation(tmpMat4f1, projectionCenterOffset, 0, 0);
  vr.mat4f.multiply(eyeL.projectionMatrix, tmpMat4f1, tmpMat4f0);
  vr.mat4f.makeTranslation(tmpMat4f1, -projectionCenterOffset, 0, 0);
  vr.mat4f.multiply(eyeR.projectionMatrix, tmpMat4f1, tmpMat4f0);

  // eye ortho = ortho center * ortho offset
  vr.mat4f.makeIdentity(tmpMat4f0);
  tmpMat4f0[0] = fovPixels / (info.resolutionHorz / 2);
  tmpMat4f0[5] = -fovPixels / info.resolutionVert;
  vr.mat4f.makeTranslation(tmpMat4f1, orthoPixelOffset, 0, 0);
  vr.mat4f.multiply(eyeL.orthoProjectionMatrix, tmpMat4f0, tmpMat4f1);
  vr.mat4f.makeTranslation(tmpMat4f1, -orthoPixelOffset, 0, 0);
  vr.mat4f.multiply(eyeR.orthoProjectionMatrix, tmpMat4f0, tmpMat4f1);
};


})(window);
