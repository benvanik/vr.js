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
 * VR state object.
 * This should be created and cached to enable efficient updates.
 * @constructor
 */
var VRState = function() {
};


/**
 * Parses poll data into a state object.
 * @param {!VRState} state State object.
 * @param {string} pollData Raw poll data from the plugin.
 */
function parsePollData(state, pollData) {
  //
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
  var pollData = _vr_native_.poll();
  parsePollData(state, pollData);
};


})(window);
