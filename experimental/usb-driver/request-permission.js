/**
 * vr.js experimental USB driver.
 *
 * @author Ben Vanik <ben.vanik@gmail.com>
 * @license Apache 2.0
 */


var requestPermissionsButton = document.getElementById('requestPermissionsButton');
requestPermissionsButton.onclick = requestPermissions;

function requestPermissions() {
  var permissions = { permissions: [ {
    'usbDevices': [
      {
        'vendorId': TRACKER_DK_VENDOR_ID,
        'productId': TRACKER_DK_PRODUCT_ID
      }
    ]
  } ] };
  chrome.permissions.request(permissions, function(result) {
    if (result) {
      // Permission granted.
    } else {
      // Permission denied.
    }
    window.close();
  });
};
