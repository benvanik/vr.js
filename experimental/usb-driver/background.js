/**
 * vr.js experimental USB driver.
 *
 * @author Ben Vanik <ben.vanik@gmail.com>
 * @license Apache 2.0
 */


/**
 * Requests extended permissions to USB devices, if required.
 * @param {!function(boolean)} callback Callback receiving a boolean indicating
 *     whether permissions were granted.
 */
function requestPermissions(callback) {
  var permissions = { permissions: [ {
    'usbDevices': [
      {
        'vendorId': TRACKER_DK_VENDOR_ID,
        'productId': TRACKER_DK_PRODUCT_ID
      }
    ]
  } ] };
  chrome.permissions.contains(permissions, function(result) {
    if (result) {
      // Have permissions.
      callback(true);
    } else {
      // Require permissions.
      chrome.app.window.create('request-permission.html', {
        'width': 400,
        'height': 300
      }, function(childWindow) {
        childWindow.onClosed.addListener(function() {
          // We either have permissions or we don't.
          chrome.permissions.contains(permissions, function(result) {
            callback(!!result);
          });
        });
      });
    }
  });
};


chrome.app.runtime.onLaunched.addListener(function() {
  // Require permissions before launching.
  requestPermissions(function(granted) {
    if (!granted) {
      console.log('USB permissions denied - aborting');
      return;
    }

    // Spin up the demo.
    chrome.app.window.create('demo/demo.html', {
      'width': 1280,
      'height': 800
    }, function(childWindow) {
      //
    });
  });
});


