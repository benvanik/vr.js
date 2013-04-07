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


vr.hello = function() {
  return execCommand(1);
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
};


})(window);
