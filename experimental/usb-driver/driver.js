/**
 * vr.js experimental USB driver.
 *
 * @author Ben Vanik <ben.vanik@gmail.com>
 * @license Apache 2.0
 */


// Discovered bugs (to file):
// interrupt transfer does not time out/error if device is unplugged (OSX, +?)
// control transfter does not fail if device is unplugged (OSX, +?)
// sometimes control transfer will fail with an undefined argument (no info)
// claimInterface has no error argument (all)


(function(global) {

var assert = this.assert ||
    function() { console.assert.apply(console, arguments); };
var log = function(var_args) {
  if (global.console && global.console.log) {
    global.console.log.apply(global.console, arguments);
  }
};


/**
 * Oculus Rift device driver and data provider.
 * @constructor
 */
var OculusDriver = function() {
  /**
   * Device instance, if one is present.
   * @type {OculusDevice}
   */
  this.device_ = null;

  /**
   * Timer interval for device scanning.
   * Managed by {@link OculusDriver#beginDeviceScan_}.
   * @type {number|null}
   * @private
   */
  this.deviceScanInterval_ = null;

  // Start scanning for devices.
  this.beginDeviceScan_();
};


/**
 * Disposes the driver and any dependent resources.
 */
OculusDriver.prototype.dispose = function() {
  // Stop any device scans.
  this.endDeviceScan_();

  // Close any open devices.
  if (this.device_) {
    this.device_.dispose();
    this.device_ = null;
  }
};


/**
 * Gets a value indicating whether a device is present.
 * @return {boolean} True if a device is present.
 */
OculusDriver.prototype.isPresent = function() {
  return !!this.device_;
};


/**
 * Time interval for device rescans, in milliseconds.
 * @type {number}
 * @const
 * @private
 */
OculusDriver.SCAN_INTERVAL_MS_ = 1000;


/**
 * Begins periodic scanning for devices.
 * When a device is found the scan is stopped.
 * @private
 */
OculusDriver.prototype.beginDeviceScan_ = function() {
  if (this.deviceScanInterval_ !== null) {
    return;
  }
  var self = this;
  this.deviceScanInterval_ = global.setInterval(function() {
    chrome.usb.findDevices({
      vendorId: TRACKER_DK_VENDOR_ID,
      productId: TRACKER_DK_PRODUCT_ID
    }, function(deviceHandles) {
      if (!deviceHandles.length) {
        // No devices found.
        return;
      }

      // Stop scanning for more.
      self.endDeviceScan_();

      // Close any extra devices besdies the first - we only support one.
      for (var n = 1; n < deviceHandles.length; n++) {
        chrome.usb.closeDevice(deviceHandles[n]);
      }

      // Handle the new device.
      self.deviceFound_(deviceHandles[0]);
    });
  }, OculusDriver.SCAN_INTERVAL_MS_);
};


/**
 * Stops scanning for devices.
 * @private
 */
OculusDriver.prototype.endDeviceScan_ = function() {
  if (this.deviceScanInterval_ === null) {
    return;
  }
  global.clearInterval(this.deviceScanInterval_);
  this.deviceScanInterval_ = null;
};


/**
 * Handles device discovery.
 * @param {!Object} deviceHandle Chrome device handle.
 * @private
 */
OculusDriver.prototype.deviceFound_ = function(deviceHandle) {
  // If we already have a device just replace it.
  if (this.device_) {
    this.device_.dispose();
    this.device_ = null;
  }

  // Create device.
  // We do this asynchronously so that we have a complete device when we mark
  // it present.
  OculusDevice.create(deviceHandle, function(device, opt_error) {
    if (opt_error) {
      log('Error during device creation:', opt_error);

      // Start another device scan.
      this.beginDeviceScan_();
      return;
    }

    // Successful - stash.
    this.device_ = device;
    log(device);
  }, this);
};


/**
 * Fills a vr.js vr.HmdInfo structure with data from the connected evice.
 * @param {!vr.HmdInfo} target Target info.
 * @return {boolean} True if the info was filled.
 */
OculusDriver.prototype.fillHmdInfo = function(target) {
  if (!this.device_) {
    return false;
  }

  var rawDesc = this.device_.deviceDesc_;
  var rawInfo = this.device_.hmdInfo_;
  if (!rawDesc || !rawInfo) {
    return null;
  }
  target.deviceName = rawDesc.productName;
  target.deviceManufacturer = rawDesc.manufacturerName;
  target.deviceVersion = 0;
  target.resolutionHorz = rawInfo.resolutionHorz;
  target.resolutionVert = rawInfo.resolutionVert;
  target.screenSizeHorz = rawInfo.screenSizeHorz;
  target.screenSizeVert = rawInfo.screenSizeVert;
  target.screenCenterVert = rawInfo.screenCenterVert;
  target.eyeToScreenDistance = rawInfo.eyeToScreenDistance[0];
  target.lensSeparationDistance = rawInfo.lensSeparation;
  target.interpupillaryDistance = 0.064;
  target.distortionK = new Float32Array([
    1.0, 0.22, 0.24, 0.0
  ]);
  target.chromaAbCorrection = new Float32Array([
    0.996, -0.004, 1.014, 0.0
  ]);
  return true;
};


/**
 * Resets the orientation value to its default.
 */
OculusDriver.prototype.resetOrientation = function() {
  if (!this.device_) {
    return;
  }
  this.device_.sensorFusion_.reset();
};


/**
 * Gets the current orientation quaternion.
 * @param {!Float32Array} out Quaternion result.
 */
OculusDriver.prototype.getOrientation = function(out) {
  if (!this.device_) {
    return;
  }
  var value = this.device_.sensorFusion_.Q;
  out[0] = value[0];
  out[1] = value[1];
  out[2] = value[2];
  out[3] = value[3];
};



/**
 * Oculus Rift device.
 * @param {!Object} deviceHandle Chrome device handle.
 * @param {!DeviceDescriptor} deviceDesc Device descriptor.
 * @param {!HidReportDescriptor} reportDesc HID report descriptor.
 * @param {!HmdInfo} hmdInfo Raw HMD info.
 * @constructor
 */
var OculusDevice = function(deviceHandle, deviceDesc, reportDesc, hmdInfo) {
  /**
   * Chrome device handle.
   * @type {!Object}
   * @private
   */
  this.handle_ = deviceHandle;

  /**
   * Device descriptor.
   * @type {!DeviceDescriptor}
   * @private
   */
  this.deviceDesc_ = deviceDesc;

  /**
   * HID report descriptor.
   * @type {!HidReportDescriptor}
   * @private
   */
  this.reportDesc_ = reportDesc;

  /**
   * Raw HMD info from the device.
   * @type {!HmdInfo}
   * @private
   */
  this.hmdInfo_ = hmdInfo;

  /**
   * Sensor fusion utility.
   * @type {!SensorFusion}
   * @private
   */
  this.sensorFusion_ = new SensorFusion();

  /**
   * Timer interval used for sending keep alives.
   * These are not within the main input pump so that we can detect device
   * removal. They must be sent more frequently than the device keep alive time
   * otherwise it will shut down.
   * @type {number|null}
   * @private
   */
  this.keepAliveInterval_ = null;

  /**
   * Whether the input pump is running.
   * If set to false the input pump will end on the next pump.
   * @type {boolean}
   * @private
   */
  this.pumping_ = false;

  /**
   * Number of outstanding pump reads.
   * To reduce latency we issue several reads at a time so that we don't have
   * to way for the full round trip on a read-request-complete cycle.
   * @type {number}
   * @private
   */
  this.outstandingReadCount_ = 0;

  /**
   * @type {number}
   * @private
   */
  this.lastTimestamp_ = 0;

  /**
   * @type {number}
   * @private
   */
  this.lastSampleCount_ = 0;

  /**
   * Sensor data from the previous packet.
   * This is used to fill in data holes when packets are dropped.
   * @type {!SensorData}
   * @private
   */
  this.lastSensorData_ = new SensorData();

  /**
   * Cached sensor data.
   * THis is updated each packet. Clone if needed.
   * @type {!SensorData}
   * @private
   */
  this.sensorData_ = new SensorData();

  /**
   * Scratch int32 array.
   * @type {!Int32Array}
   * @private
   */
  this.tempInt32_ = new Int32Array(3);

  // Start getting input.
  this.beginInputPump_();
};


/**
 * Disposes the device and releases the interface.
 */
OculusDevice.prototype.dispose = function() {
  this.endInputPump_();
};


/**
 * Asynchronously creates and initializes a device.
 * @param {!Object} deviceHandle Chrome device handle.
 * @param {!function(this:T, OculusDevice, Error=)} callback Callback function.
 * @param {T=} opt_scope Optional callback scope.
 * @template T
 */
OculusDevice.create = function(deviceHandle, callback, opt_scope) {
  // Woo callback hell!

  // Always start with a device reset.
  chrome.usb.resetDevice(deviceHandle, function(info) {
    if (info.resultCode) {
      var e = new Error('Error resetting the device: ' + info.resultCode);
      e.code = info.resultCode;
      callback.call(opt_scope, null, e);
      return;
    }

    // Grab the device descriptor, which is required for doing everything else.
    DeviceDescriptor.get(deviceHandle, function(deviceDesc, opt_error) {
      if (opt_error) {
        callback.call(opt_scope, null, opt_error);
        return;
      }

      // Activate the default configuration.
      // This is required to enable teh device.
      chrome.usb.controlTransfer(deviceHandle, {
        requestType: 'standard',
        recipient: 'device',
        direction: 'out',
        request: 9, // SET_CONFIGURATION
        value: deviceDesc.configurations[0].configurationValue,
        index: 0,
        data: new Uint8Array(0).buffer
      }, function(info) {
        if (info.resultCode) {
          var e = new Error('Error setting device configuration: ' +
              info.resultCode);
          e.code = info.resultCode;
          callback.call(opt_scope, null, e);
          return;
        }

        // Get the HID report descriptor.
        HidReportDescriptor.get(deviceHandle, deviceDesc, function(
            reportDesc, opt_error) {
          if (opt_error) {
            callback.call(opt_scope, null, opt_error);
            return;
          }

          // Grab the HMD info.
          HmdInfo.get(deviceHandle, deviceDesc, function(hmdInfo, opt_error) {
            if (opt_error) {
              callback.call(opt_scope, null, opt_error);
              return;
            }

            // Create the device.
            // We purposefully don't begin interrupt transfers yet.
            var device = new OculusDevice(deviceHandle, deviceDesc, reportDesc,
                hmdInfo);
            callback.call(opt_scope, device, undefined);
          });
        });
      });
    });
  });
};


/**
 * Interval to send keep-alives to the device.
 * @type {number}
 * @const
 * @private
 */
OculusDevice.KEEP_ALIVE_INTERVAL_MS_ = 5 * 1000;


/**
 * The number of outstanding reads to maintain during pumping.
 * The higher the number the better, until failures happen...
 * @type {number}
 * @const
 * @private
 */
OculusDevice.MAX_OUTSTANDING_READS_ = 100;


/**
 * Begins the input pump.
 * This will claim the interface and hopefully start receiving data.
 * @private
 */
OculusDevice.prototype.beginInputPump_ = function() {
  var self = this;

  if (this.pumping_) {
    return;
  }

  this.pumping_ = true;

  // Start the keep alive timer.
  this.keepAliveInterval_ = global.setInterval(function() {
    setSensorKeepAlive(self.handle_, self.deviceDesc_, 10 * 1000,
        function(opt_error) {
          // On error, device must be disconnected.
          if (opt_error) {
            log('keep alive failed, disconnected?');
            self.endInputPump_();
          }
        });
  }, OculusDevice.KEEP_ALIVE_INTERVAL_MS_);

  // Claim the interface.
  // If this fails, it's likely the user doesn't have the USB hacks installed.
  // Unfortunately there's no error code passed here, so we can't know.
  // TODO(benvanik): file issues/etc
  var configInterface = this.deviceDesc_.configurations[0].interfaces[0];
  var interfaceNumber = configInterface.interfaceNumber;
  chrome.usb.claimInterface(this.handle_, interfaceNumber, function() {
    log('interface claimed, maybe...');

    var endpointAddress = configInterface.endpoints[0].endpointAddress;
    var inputReport = self.reportDesc_.root.application.logical.reports[0];
    var reportSize = inputReport.totalSize + 1;
    function pumpInput() {
      ++self.outstandingReadCount_;
      chrome.usb.interruptTransfer(self.handle_, {
        direction: 'in',
        endpoint: endpointAddress,
        length: reportSize
      }, function(info) {
        --self.outstandingReadCount_;
        if (info.resultCode) {
          var e = new Error('Error during interrupt transfer: ' +
              info.resultCode);
          e.code = resultCode;
          self.inputPump_(null, e);
          return;
        }
        var data = new Uint8Array(info.data);
        if (self.inputPump_(data, undefined)) {
          pumpInput();
        }
      });
    };
    while (self.outstandingReadCount_ < OculusDevice.MAX_OUTSTANDING_READS_) {
      pumpInput();
    }
  });
};


/**
 * Ends the input pump.
 * @private
 */
OculusDevice.prototype.endInputPump_ = function() {
  if (!this.pumping_) {
    return;
  }

  // Clear keep alive timer.
  if (this.keepAliveInterval_ !== null) {
    global.clearInterval(this.keepAliveInterval_);
    this.keepAliveInterval_ = null;
  }

  // The next pump will abort when this is set.
  this.pumping_ = false;
};


/**
 * A single input pump.
 * Called when there is new data from the device.
 * @param {Uint8Array} data Data, if available.
 * @param {Error=} opt_error Error, if any occurred.
 * @return {boolean} True to continue pumping. False to end.
 */
OculusDevice.prototype.inputPump_ = function(data, opt_error) {
  if (!this.pumping_ || opt_error) {
    var configInterface = this.deviceDesc_.configurations[0].interfaces[0];
    var interfaceNumber = configInterface.interfaceNumber;
    chrome.usb.releaseInterface(this.handle_, interfaceNumber, function() {});
    // TODO(benvanik): handle the error better.
    log(opt_error);
    return false;
  }

  var TIME_UNIT = 1 / 1000;

  // Parse incoming message.
  var o = 0;
  // 0 = record id?
  var sampleCount = data[o + 1];
  var timestamp = decodeUint16(data, o + 2);
  var lastCommandId = decodeUint16(data, o + 4);
  var temperature = decodeInt16(data, o + 6);
  var magX = decodeInt16(data, o + 56);
  var magY = decodeInt16(data, o + 58);
  var magZ = decodeInt16(data, o + 60);
  var iterationCount = (sampleCount > 2) ? 3 : sampleCount;

  // Repeat previous sensor data if we dropped some packets.
  if (this.lastTimestamp_) {
    var timestampDelta = (timestamp < this.lastTimestamp_) ?
        (timestamp + 0x10000) - this.lastTimestamp_ :
        timestamp - this.lastTimestamp_;
    if (timestampDelta > this.lastSampleCount_ && timestampDelta <= 254) {
      this.lastSensorData_.timeDelta =
          (timestampDelta - this.lastSampleCount_) * TIME_UNIT;
      this.sensorFusion_.handleSensorData(this.lastSensorData_);
    }
  }
  this.lastTimestamp_ = timestamp;
  this.lastSampleCount_ = sampleCount;

  var tempInt32 = this.tempInt32_;
  function decodeSensorData(data, o, out) {
    out[0] = (data[o + 0] << 13) | (data[o + 1] << 5) |
             ((data[o + 2] & 0xF8) >> 3);
    out[1] = ((data[o + 2] & 0x07) << 18) | (data[o + 3] << 10) |
             (data[o + 4] << 2) | ((data[o + 5] & 0xC0) >> 6);
    out[2] = ((data[o + 5] & 0x3F) << 15) | (data[o + 6] << 7) |
             (data[o + 7] >> 1);
    out[0] = ((out[0] << 11) >> 11);
    out[1] = ((out[1] << 11) >> 11);
    out[2] = ((out[2] << 11) >> 11);
  };
  function accelFromSensorData(data, o, out) {
    decodeSensorData(data, o, tempInt32);
    out[0] = tempInt32[0] * 0.0001;
    out[1] = tempInt32[1] * 0.0001;
    out[2] = tempInt32[2] * 0.0001;
  };
  function eulerFromSensorData(data, o, out) {
    decodeSensorData(data, o, tempInt32);
    out[0] = tempInt32[0] * 0.0001;
    out[1] = tempInt32[1] * 0.0001;
    out[2] = tempInt32[2] * 0.0001;
  };

  // Read all sensor data.
  var sensorData = this.sensorData_;
  // Note the XZY - supposedly future HMDs won't do this.
  sensorData.magneticField[0] = magX * 0.0001;
  sensorData.magneticField[1] = magZ * 0.0001;
  sensorData.magneticField[2] = magY * 0.0001;
  for (var n = 0; n < iterationCount; n++) {
    // Read sensor data.
    sensorData.timeDelta = TIME_UNIT;
    accelFromSensorData(data, o + 8 + 16 * n, sensorData.acceleration);
    eulerFromSensorData(data, o + 16 + 16 * n, sensorData.rotationRate);
    sensorData.temperature = temperature * 0.01;

    // Dispatch data packet.
    this.sensorFusion_.handleSensorData(sensorData);
  }
  // Swap the new data into the last for next callback.
  this.sensorData_ = this.lastSensorData_;
  this.lastSensorData_ = sensorData;

  return true;
};



/**
 * Sensor data from the device.
 * These are cached instances that are overwritten each time new data arrives.
 * If you need to preserve this data, clone it.
 */
var SensorData = function() {
  /**
   * Time elapsed since hte last sensor reading.
   * @type {number}
   */
  this.timeDelta = 0;

  /**
   * Acceleration reading.
   * @type {!Float32Array}
   */
  this.acceleration = new Float32Array(3);

  /**
   * Rotation rate reading.
   * @type {!Float32Array}
   */
  this.rotationRate = new Float32Array(3);

  /**
   * Magnetic field reading.
   * @type {!Float32Array}
   */
  this.magneticField = new Float32Array(3);

  /**
   * Temperature reading.
   * @type {number}
   */
  this.temperature = 0;
};


/**
 * Gets a uint16 from a byte buffer.
 * @param {!Uint8Array} data Source buffer.
 * @param {number} offset Starting offset in the buffer.
 * @return {number} Uint16 value.
 */
function decodeUint16(data, offset) {
  return data[offset + 0] | (data[offset + 1] << 8);
};


/**
 * Gets an int16 from a byte buffer.
 * @param {!Uint8Array} data Source buffer.
 * @param {number} offset Starting offset in the buffer.
 * @return {number} Int16 value.
 */
function decodeInt16(data, offset) {
  var u = (data[offset + 1] << 8) | data[offset + 0];
  return u > 32768 - 1 ? u - 65536 : u;
};


/**
 * Gets a uint32 from a byte buffer.
 * @param {!Uint8Array} data Source buffer.
 * @param {number} offset Starting offset in the buffer.
 * @return {number} Uint32 value.
 */
function decodeUint32(data, offset) {
  return data[offset + 0] | (data[offset + 1] << 8) | (data[offset + 2] << 16) |
      (data[offset + 3] << 24);
};


/**
 * Gets a float32 from a byte buffer.
 * @param {!Uint8Array} data Source buffer.
 * @param {number} offset Starting offset in the buffer.
 * @return {number} Float32 value.
 */
var decodeFloat32 = (function() {
  var tempUint32 = new Uint32Array(1);
  var tempFloat32 = new Float32Array(tempUint32.buffer);
  return function decodeFloat32(data, offset) {
    tempUint32[0] = decodeUint32(data, offset);
    return tempFloat32[0];
  };
})();


/**
 * Formats a BCD value to a string.
 * This is probably right.
 * @param {number} value 16-bit BCD value.
 * @return {string} String form.
 */
function formatBcd(value) {
  return (value >> 8) + '.' + String((value >> 4) & 0xF) + String(value & 0xF);
};


/**
 * IOCTL-like method for reading from a device.
 * @param {!Object} deviceHandle Chrome device handle.
 * @param {string} type Request type.
 * @param {number} request Request number.
 * @param {number} value Value.
 * @param {number} index Index.
 * @param {number} length Expected response length.
 * @param {!function(number, Uint8Array)} callback Callback. Receives a result
 *     code (non-zero for error) and a data buffer.
 */
function ioctl_read(deviceHandle, type, request, value, index, length,
    callback) {
  chrome.usb.controlTransfer(deviceHandle, {
    requestType: type,
    recipient: 'device',
    direction: 'in',
    request: request,
    value: value,
    index: index,
    length: length
  }, function(info) {
    // If we fail really hard (device closed/etc), info will be undefined.
    // TODO(benvanik); file a bug on this.
    if (!info) {
      callback(1, null);
      return;
    }
    callback(
        info.resultCode,
        info.resultCode ? null : new Uint8Array(info.data));
  });
};


/**
 * Gets a device descriptor string.
 * @param {!Object} deviceHandle Chrome device handle.
 * @param {number} index String index.
 * @param {!function(string|null, Error=)} callback Callback that receives a
 *     string and an error object if the get failed.
 */
function getDeviceString(deviceHandle, index, callback) {
  ioctl_read(deviceHandle, 'standard', 6, 0x0300 | index, 0, 256,
      function(resultCode, data) {
        if (resultCode) {
          var e = new Error('Error getting string descriptor: ' + resultCode);
          e.code = resultCode;
          callback(null, e);
          return;
        }

        // bLength / bDescriptorType / bString*
        var chars = new Array(data.length - 2);
        for (var n = 0; n < chars.length; n++) {
          chars[n] = data[n + 2];
        }
        var str = String.fromCharCode.apply(null, chars);
        str = str.trim();
        callback(str, undefined);
      });
};


/**
 * Gets a HID feature report.
 * @param {!Object} device Chrome device handle.
 * @param {!DeviceDescriptor} deviceDesc Device descriptor.
 * @param {number} reportId Report ID.
 * @param {number} length Report length.
 * @param {!function(Uint8Array, Error=)} callback Callback. Receives the report
 *     data or an error.
 */
function getHidFeatureReport(device, deviceDesc, reportId, length, callback) {
  // TODO(benvanik): pass in as an argument?
  var interfaceNumber =
      deviceDesc.configurations[0].interfaces[0].interfaceNumber;
  chrome.usb.controlTransfer(device, {
    requestType: 'class',
    recipient: 'interface',
    direction: 'in',
    request: 0x01,
    value: 0x0300 | reportId,
    index: interfaceNumber,
    length: length
  }, function(info) {
    if (info.resultCode) {
      var e = new Error('Error getting HID feature report: ' + info.resultCode);
      e.code = info.resultCode;
      callback(null, e);
      return;
    }
    callback(new Uint8Array(info.data), undefined);
  });
};


/**
 * Sets a HID feature report.
 * @param {!Object} device Chrome device handle.
 * @param {!DeviceDescriptor} deviceDesc Device descriptor.
 * @param {number} reportId Report ID.
 * @param {!Uint8Array} data Report data.
 * @param {!function(Error=)} callback Callback. Receives an error if one
 *     occurred.
 */
function setHidFeatureReport(device, deviceDesc, reportId, data, callback) {
  // TODO(benvanik): pass in as an argument?
  var interfaceNumber =
      deviceDesc.configurations[0].interfaces[0].interfaceNumber;
  chrome.usb.controlTransfer(device, {
    requestType: 'class',
    recipient: 'interface',
    direction: 'out',
    request: 0x09,
    value: 0x0300 | reportId,
    index: interfaceNumber,
    data: data.buffer
  }, function(info) {
    if (info.resultCode) {
      var e = new Error('Error setting HID feature report: ' + info.resultCode);
      e.code = info.resultCode;
      callback(e);
      return;
    }
    callback(undefined);
  });
};



var EndpointDescriptor = function(data, o) {
  // http://www.beyondlogic.org/usbnutshell/usb5.shtml#EndpointDescriptors
  assert(data[o++] == EndpointDescriptor.LENGTH);       // bLength
  assert(data[o++] == EndpointDescriptor.TYPE);         // bDescriptorType
  this.endpointAddress = data[o++];                     // bEndpointAddress
  this.attributes = data[o++];                          // bmAttributes
  this.maxPacketSize = data[o++] | (data[o++] << 8);    // wMaxPacketSize
  this.interval = data[o++];                            // bInterval
};
EndpointDescriptor.LENGTH = 7;
EndpointDescriptor.TYPE = 5;

var HidDescriptor = function(data, o) {
  assert(data[o++] == HidDescriptor.LENGTH);            // bLength
  assert(data[o++] == HidDescriptor.TYPE);              // bDescriptorType
  this.hid = formatBcd(data[o++] | (data[o++] << 8)); // bcdHID
  this.countryCode = data[o++];                         // bCountryCode
  var descriptorCount = data[o++];                      // bNumDescriptors
  this.descriptorType = data[o++];                      // bDescriptorType
  this.descriptorLength = data[o++] | (data[o++] << 8); // bDescriptorLength
  // extra descriptors are type|length
  assert(descriptorCount == 1);
};
HidDescriptor.LENGTH = 9;
HidDescriptor.TYPE = 33;

var InterfaceDescriptor = function(data, o) {
  // http://www.beyondlogic.org/usbnutshell/usb5.shtml#InterfaceDescriptors
  assert(data[o++] == InterfaceDescriptor.LENGTH);      // bLength
  assert(data[o++] == InterfaceDescriptor.TYPE);        // bDescriptorType
  this.interfaceNumber = data[o++];                     // bInterfaceNumber
  this.alternateSetting = data[o++];                    // bAlternateSetting
  var endpointCount = data[o++];                        // bNumEndpoints
  this.interfaceClass = data[o++];                      // bInterfaceClass
  this.interfaceSubClass = data[o++];                   // bInterfaceSubClass
  this.interfaceProtocol = data[o++];                   // bInterfaceProtocol
  this.extraData_ = {
    interfaceIndex: data[o++]                           // iInterface
  };

  this.interfaceName = '';
  this.endpoints = [];

  this.hidDescriptor = null;
  if (this.interfaceClass == 3) {
    this.hidDescriptor = new HidDescriptor(data, o);
    o += HidDescriptor.LENGTH;
  }

  for (var n = 0; n < endpointCount; n++) {
    var endpointDesc = new EndpointDescriptor(data, o);
    this.endpoints.push(endpointDesc);
    o += EndpointDescriptor.LENGTH;
  }
};
InterfaceDescriptor.LENGTH = 9;
InterfaceDescriptor.TYPE = 4;

var ConfigurationDescriptor = function(data) {
  // http://www.beyondlogic.org/usbnutshell/usb5.shtml#ConfigurationDescriptors
  var o = 0;
  o++;                                                  // bLength
  assert(data[o++] == ConfigurationDescriptor.TYPE);    // bDescriptorType
  var totalLength = data[o++] | (data[o++] << 8);       // wTotalLength
  var interfaceCount = data[o++];                       // bNumInterfaces
  this.configurationValue = data[o++];                  // bConfigurationValue
  var configurationIndex = data[o++];                   // iConfiguration
  this.attributes = data[o++];                          // bmAttributes
  this.maxPower = data[o++];                            // bMaxPower

  this.extraData_ = {
    configurationIndex: configurationIndex
  };

  this.configurationName = '';
  this.interfaces = [];

  for (var n = 0; n < interfaceCount; n++) {
    var interfaceDesc = new InterfaceDescriptor(data, o);
    this.interfaces.push(interfaceDesc);
    o += InterfaceDescriptor.LENGTH +
        interfaceDesc.endpoints.length * EndpointDescriptor.LENGTH;
  }
};
ConfigurationDescriptor.TYPE = 2;
ConfigurationDescriptor.get = function(deviceHandle, index, callback) {
  ioctl_read(deviceHandle, 'standard', 6, 0x0200 | index, 0, 2048,
      function(resultCode, data) {
        if (resultCode) {
          var e = new Error('Error getting ConfigurationDescriptor: ' +
              resultCode);
          e.code = resultCode;
          callback(null, e);
          return;
        }

        var desc = new ConfigurationDescriptor(data);

        var remainingCount = 0;
        function finishCallback(opt_error) {
          if (opt_error) {
            callback(null, opt_error);
            remainingCount = 0;
            return;
          }
          remainingCount--;
          if (remainingCount == 0) {
            callback(desc, undefined);
          }
        };

        remainingCount += 1;
        getDeviceString(deviceHandle, desc.extraData_.configurationIndex,
            function(str, opt_error) {
              desc.configurationName = str || '';
              finishCallback(opt_error);
            });

        remainingCount += desc.interfaces.length;
        desc.interfaces.forEach(function(interfaceDesc) {
          getDeviceString(deviceHandle, interfaceDesc.extraData_.interfaceIndex,
              function(str, opt_error) {
                interfaceDesc.interfaceName = str || '';
                finishCallback(opt_error);
              });
        });
      });
};

var DeviceDescriptor = function(data) {
  // http://www.beyondlogic.org/usbnutshell/usb5.shtml#DeviceDescriptors
  var o = 0;
  o++;                                                  // bLength
  o++;                                                  // bDescriptorType
  this.usbVersion = formatBcd(data[o++] | (data[o++] << 8)); // bcdUSB
  this.deviceClass = data[o++];                         // bDeviceClass
  this.deviceSubClass = data[o++];                      // bDeviceSubClass
  this.deviceProtocol = data[o++];                      // bDeviceProtocol
  this.maxPacketSize = data[o++];                       // bMaxPacketSize
  this.vendorId = data[o++] | (data[o++] << 8);         // idVendor
  this.productId = data[o++] | (data[o++] << 8);        // idProduct
  this.deviceRelease = formatBcd(data[o++] | (data[o++] << 8)); // bcdDevice
  this.extraData_ = {
    manufacturerIndex: data[o++],                       // iManufacturer
    productIndex: data[o++],                            // iProduct
    serialNumberIndex: data[o++],                       // iSerialNumber
    configurationCount: data[o++]                       // bNumConfigurations
  };

  this.manufacturerName = '';
  this.productName = '';
  this.serialNumber = '';
  this.configurations = [];
};
DeviceDescriptor.SIZE = 18;
DeviceDescriptor.get = function(deviceHandle, callback) {
  ioctl_read(deviceHandle, 'standard', 6, 0x0100, 0, DeviceDescriptor.SIZE,
      function(resultCode, data) {
        if (resultCode) {
          var e = new Error('Error getting DeviceDescriptor: ' + resultCode);
          e.code = resultCode;
          callback(null, e);
          return;
        }

        var desc = new DeviceDescriptor(data);

        var remainingCount = 0;
        function finishCallback(opt_error) {
          if (opt_error) {
            callback(null, opt_error);
            remainingCount = 0;
            return;
          }
          remainingCount--;
          if (remainingCount == 0) {
            callback(desc, undefined);
          }
        };

        remainingCount += 3;
        getDeviceString(deviceHandle, desc.extraData_.manufacturerIndex,
            function(str, opt_error) {
              desc.manufacturerName = str || '';
              finishCallback(opt_error);
            });
        getDeviceString(deviceHandle, desc.extraData_.productIndex,
            function(str, opt_error) {
              desc.productName = str || '';
              finishCallback(opt_error);
            });
        getDeviceString(deviceHandle, desc.extraData_.serialNumberIndex,
            function(str, opt_error) {
              desc.serialNumber = str || '';
              finishCallback(opt_error);
            });

        remainingCount += desc.extraData_.configurationCount;
        function configurationCallback(config, opt_error) {
          if (config) {
            desc.configurations.push(config);
          }
          finishCallback(opt_error);
        };
        for (var n = 0; n < desc.extraData_.configurationCount; n++) {
          ConfigurationDescriptor.get(deviceHandle, n, configurationCallback);
        }
      });
};

var HidReportDescriptor = function(data) {
  function readData(itemSize, data, o) {
    switch (itemSize) {
      case 0:
        return 0;
      case 1:
        return data[o];
      case 2:
        return decodeUint16(data, o);
      default:
        return data[o + 0] | (data[o + 1] << 8) | (data[o + 2] << 8);
    }
  };

  var stack = [];
  this.root = {};
  stack.push(this.root);
  var current = stack[0];
  var usagePage = 0;
  var usage = 0;
  var currentReport = null;
  var logicalMin = 0;
  var logicalMax = 0;
  var reportSize = 0;
  var reportCount = 0;
  var allReports = [];
  for (var o = 0; o < data.length;) {
    var b0 = data[o++];
    if (b0 == 0xFE) {
      // Long item.
      assert(false);
    } else {
      // Short item.
      var itemTag = b0 >> 4;
      var itemType = (b0 >> 2) & 0x3;
      var itemSize = b0 & 0x3;
      if (itemType == 0) {
        switch (itemTag) {
          case 0x8: // input
            //console.log('input', itemSize);
            currentReport.inputs.push({
              usage: usage,
              logicalMin: logicalMin,
              logicalMax: logicalMax,
              reportSize: reportSize,
              reportCount: reportCount
            });
            break;
          case 0x9: // output
            //console.log('output', itemSize);
            currentReport.outputs.push({
              usage: usage,
              logicalMin: logicalMin,
              logicalMax: logicalMax,
              reportSize: reportSize,
              reportCount: reportCount
            });
            break;
          case 0xB: // feature
            //console.log('feature', itemSize);
            currentReport.features.push({
              usage: usage,
              logicalMin: logicalMin,
              logicalMax: logicalMax,
              reportSize: reportSize,
              reportCount: reportCount
            });
            break;
          case 0xA: // collection start
            var child = {
              reports: []
            };
            stack.push(child);
            var collectionType = data[o];
            var collectionName = collectionType.toString(16);
            switch (collectionType) {
              case 0x00: collectionName = 'physical'; break;
              case 0x01: collectionName = 'application'; break;
              case 0x02: collectionName = 'logical'; break;
              case 0x03: collectionName = 'report'; break;
              case 0x04: collectionName = 'namedArray'; break;
              case 0x05: collectionName = 'usageSwitch'; break;
              case 0x06: collectionName = 'usageModifier'; break;
            }
            //console.log('collection', collectionName);
            current[collectionName] = child;
            current = child;
            break;
          case 0xC: // end collection
          //console.log('end collection');
            current = stack.pop();
            break;
          default:
            //console.log('unknown type 0', itemTag);
            break;
        }
      } else if (itemType == 1) {
        switch (itemTag) {
          case 0x0: // usage page
            usagePage = readData(itemSize, data, o);
            //console.log('usage page', usagePage.toString(16));
            break;
          case 0x1: // logical minimum
            logicalMin = readData(itemSize, data, o);
            //console.log('logical minimum', logicalMin);
            break;
          case 0x2: // logical maximum
            logicalMax = readData(itemSize, data, o);
            //console.log('logical maximum', logicalMax);
            break;
          case 0x3: // physical minimum
            //console.log('physical minimum', readData(itemSize, data, o));
            break;
          case 0x4: // physical maximum
            //console.log('physical maximum', readData(itemSize, data, o));
            break;
          case 0x5: // unit exponent
            //console.log('unit exponent', readData(itemSize, data, o));
            break;
          case 0x6: // unit
            //console.log('unit', readData(itemSize, data, o));
            break;
          case 0x7: // report size
            reportSize = readData(itemSize, data, o);
            //console.log('report size', reportSize);
            break;
          case 0x8: // report id
            //console.log('report id', readData(itemSize, data, o));
            currentReport = {
              reportId: readData(itemSize, data, o),
              inputs: [],
              outputs: [],
              features: []
            };
            allReports.push(currentReport);
            current.reports.push(currentReport);
            break;
          case 0x9: // report count
            reportCount = readData(itemSize, data, o);
            //console.log('report count', reportCount);
            break;
          case 0xA: // push
            //console.log('push');
            break;
          case 0xB: // pop
            //console.log('pop');
            break;
          default:
            //console.log('unknown type 1', itemTag);
            break;
        }
      } else if (itemType == 2) {
        switch (itemTag) {
          case 0x0: // usage
            usage = (usagePage << 16) | readData(itemSize, data, o);
            //console.log('usage', usage);
            break;
          case 0x1: // usage minimum
            //console.log('usage minimum', readData(itemSize, data, o));
            break;
          case 0x2: // usage maximum
            //console.log('usage maximum', readData(itemSize, data, o));
            break;
          case 0x3: // designator index
            //console.log('designator index', readData(itemSize, data, o));
            break;
          case 0x4: // designator minimum
            //console.log('usage minimum', readData(itemSize, data, o));
            break;
          case 0x5: // designator maximum
            //console.log('usage maximum', readData(itemSize, data, o));
            break;
          case 0x7: // string index
            //console.log('string index', readData(itemSize, data, o));
            break;
          case 0x8: // string minimum
            //console.log('string minimum', readData(itemSize, data, o));
            break;
          case 0x9: // string maximum
            //console.log('string maximum', readData(itemSize, data, o));
            break;
          case 0xA: // delimiter
            //console.log('delimiter', readData(itemSize, data, o));
            break;
          default:
            //console.log('unknown type 2', itemTag);
            break;
        }
      } else {
        //console.log('unknown type ' + itemType);
      }
      o += itemSize;
    }
  }
  assert(stack.length == 1);

  for (var n = 0; n < allReports.length; n++) {
    var report = allReports[n];
    var totalSize = 0;
    for (var m = 0; m < report.inputs.length; m++) {
      var input = report.inputs[m];
      totalSize += (input.reportSize / 8) * input.reportCount;
    }
    report.totalSize = totalSize;
  }
};
HidReportDescriptor.get = function(deviceHandle, deviceDesc, callback) {
  // TODO(benvanik): accept as an argument?
  var configInterface = deviceDesc.configurations[0].interfaces[0];
  var interfaceNumber = configInterface.interfaceNumber;
  var reportLength = configInterface.hidDescriptor.descriptorLength;
  chrome.usb.controlTransfer(deviceHandle, {
    requestType: 'standard',
    recipient: 'interface',
    direction: 'in',
    request: 0x06,
    value: 0x2200,
    index: interfaceNumber,
    length: reportLength
  }, function(info) {
    if (info.resultCode) {
      var e = new Error('Error getting HID report descriptor: ' +
          info.resultCode);
      e.code = info.resultCode;
      callback(null, e);
      return;
    }
    var data = new Uint8Array(info.data);
    var reportDesc = new HidReportDescriptor(data);
    callback(reportDesc, undefined);
  });
};


var HmdInfo = function(data) {
  var o = 0;
  this.commandId = data[o + 1] | (data[o + 2] << 8);
  this.distortionType = data[o + 3];
  this.resolutionHorz = decodeUint16(data, o + 4);
  this.resolutionVert = decodeUint16(data, o + 6);
  this.screenSizeHorz = decodeUint32(data, o + 8) *  (1/1000000);
  this.screenSizeVert = decodeUint32(data, o + 12) * (1/1000000);
  this.screenCenterVert = decodeUint32(data, o + 16) * (1/1000000);
  this.lensSeparation = decodeUint32(data, o + 20) * (1/1000000);
  this.eyeToScreenDistance = new Float32Array([
    decodeUint32(data, o + 24) * (1/1000000),
    decodeUint32(data, o + 28) * (1/1000000)
  ]);
  this.distortionK = new Float32Array([
    decodeFloat32(data, o + 32),
    decodeFloat32(data, o + 36),
    decodeFloat32(data, o + 40),
    decodeFloat32(data, o + 44),
    decodeFloat32(data, o + 48),
    decodeFloat32(data, o + 52)
  ]);
};
HmdInfo.get = function(deviceHandle, deviceDesc, callback) {
  getHidFeatureReport(deviceHandle, deviceDesc, 9, 56,
      function(data, opt_error) {
        if (data) {
          callback(new HmdInfo(data), undefined);
        } else {
          callback(null, opt_error);
        }
      });
};

var SensorRange = function(data) {
  var o = 0;
  this.commandId = data[o + 1] | (data[o + 2] << 8);
  this.accelScale = data[o + 3];
  this.gyroScale = decodeUint16(data, o + 4);
  this.magScale = decodeUint16(data, o + 6);
};
SensorRange.get = function(deviceHandle, deviceDesc, callback) {
  getHidFeatureReport(deviceHandle, deviceDesc, 4, 8,
      function(data, opt_error) {
        if (data) {
          callback(new SensorRange(data), undefined);
        } else {
          callback(null, opt_error);
        }
      });
};

function getSensorConfig(device, deviceDesc, callback) {
  getHidFeatureReport(device, deviceDesc, 2, 8, callback);
};

function setSensorConfig(device, deviceDesc, data, callback) {
  setHidFeatureReport(device, deviceDesc, 2, data, callback);
};

function setSensorKeepAlive(device, deviceDesc, intervalMs, callback) {
  var data = new Uint8Array(4);
  data[0] = 0;
  data[1] = 0;
  data[2] = intervalMs & 0xFF;
  data[3] = intervalMs >> 8;
  setHidFeatureReport(device, deviceDesc, 8, data, callback);
};




// TODO(benvanik): cleanup
// Some of this comes from tojiro's gl-matrix.
var vec3f = {};
vec3f.copy = function(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
};
vec3f.length = function(a) {
  return Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]);
};
vec3f.scale = function(out, a, b) {
  out[0] = a[0] * b;
  out[1] = a[1] * b;
  out[2] = a[2] * b;
};
vec3f.normalize = function(out, a) {
  var length = a[0] * a[0] + a[1] * a[1] + a[2] * a[2];
  if (length > 0) {
    length = 1 / Math.sqrt(length);
    out[0] = a[0] * length;
    out[1] = a[1] * length;
    out[2] = a[2] * length;
  }
};
vec3f.dot = function(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
};
vec3f.angle = function(a, b) {
  return Math.acos(vec3f.dot(a, b) / (vec3f.length(a) * vec3f.length(b)));
};
vec3f.transformQuat = function(out, a, q) {
  var x = a[0], y = a[1], z = a[2];
  var qx = q[0], qy = q[1], qz = q[2], qw = q[3];
  var ix = qw * x + qy * z - qz * y;
  var iy = qw * y + qz * x - qx * z;
  var iz = qw * z + qx * y - qy * x;
  var iw = -qx * x - qy * y - qz * z;
  out[0] = ix * qw + iw * -qx + iy * -qz - iz * -qy;
  out[1] = iy * qw + iw * -qy + iz * -qx - ix * -qz;
  out[2] = iz * qw + iw * -qz + ix * -qy - iy * -qx;
};
var quatf = {};
quatf.set = function(out, x, y, z, w) {
  out[0] = x;
  out[1] = y;
  out[2] = z;
  out[3] = w;
};
quatf.identity = function(out) {
  out[0] = out[1] = out[2] = 0;
  out[3] = 1;
};
quatf.copy = function(out, a) {
  out[0] = a[0];
  out[1] = a[1];
  out[2] = a[2];
  out[3] = a[3];
};
quatf.setAxisAngle = function(out, axis, rad) {
  rad = rad * 0.5;
  var s = Math.sin(rad);
  out[0] = s * axis[0];
  out[1] = s * axis[1];
  out[2] = s * axis[2];
  out[3] = Math.cos(rad);
};
quatf.multiply = function(out, a, b) {
  var ax = a[0], ay = a[1], az = a[2], aw = a[3];
  var bx = b[0], by = b[1], bz = b[2], bw = b[3];
  out[0] = ax * bw + aw * bx + ay * bz - az * by;
  out[1] = ay * bw + aw * by + az * bx - ax * bz;
  out[2] = az * bw + aw * bz + ax * by - ay * bx;
  out[3] = aw * bw - ax * bx - ay * by - az * bz;
};
quatf.normalize = function(out, a) {
  var length = a[0] * a[0] + a[1] * a[1] + a[2] * a[2] + a[3] * a[3];
  if (length > 0) {
    length = 1 / Math.sqrt(length);
    out[0] = a[0] * length;
    out[1] = a[1] * length;
    out[2] = a[2] * length;
    out[3] = a[3] * length;
  }
};



/**
 * Sensor value filter.
 * @param {number} size History size.
 * @constructor
 */
var SensorFilter = function(size) {
  /**
   * Last index used.
   * @type {number}
   * @private
   */
  this.lastIndex_ = -1;

  /**
   * Number of history entries.
   * @type {number}
   * @private
   */
  this.size_ = size;

  /**
   * A list of all history entries, each one 3 elements of XYZ.
   * @type {!Float32Array}
   * @private
   */
  this.elements_ = new Float32Array(size * 3);

  /**
   * Scratch vec3 for temp math.
   * @type {!Float32Array}
   * @private
   */
  this.tempVec3_ = new Float32Array(3);
};


/**
 * Adds an element to the sensor filter history.
 * @param {!Float32Array} v Vector element.
 */
SensorFilter.prototype.addElement = function(v) {
  if (this.lastIndex_ == this.size_ - 1) {
    this.lastIndex_ = 0;
  } else {
    this.lastIndex_++;
  }
  this.elements_[this.lastIndex_ * 3 + 0] = v[0];
  this.elements_[this.lastIndex_ * 3 + 1] = v[1];
  this.elements_[this.lastIndex_ * 3 + 2] = v[2];
};


/**
 * Gets a previous history value relative to the current index.
 * @param {number} i Delta from the current index.
 * @param {!Float32Array} out Output vector value.
 */
SensorFilter.prototype.getPrev = function(i, out) {
  var idx = (this.lastIndex_ - i) % this.size_;
  if (idx < 0) {
    idx += this.size_;
  }
  out[0] = this.elements_[idx * 3 + 0];
  out[1] = this.elements_[idx * 3 + 1];
  out[2] = this.elements_[idx * 3 + 2];
};


/**
 * Gets the mean of the sensor value.
 * @param {!Float32Array} out Output vector value.
 */
SensorFilter.prototype.getMean = function(out) {
  out[0] = out[1] = out[2] = 0;
  for (var n = 0; n < this.size_; n++) {
    out[0] += this.elements_[n * 3 + 0];
    out[1] += this.elements_[n * 3 + 1];
    out[2] += this.elements_[n * 3 + 2];
  }
  out[0] /= this.size_;
  out[1] /= this.size_;
  out[2] /= this.size_;
};


/**
 * Magic.
 * @param {!Float32Array} out Output vector value.
 */
SensorFilter.prototype.getSavitzkyGolaySmooth8 = function(out) {
  var tempVec3 = this.tempVec3_;
  this.getPrev(0, tempVec3);
  out[0] += tempVec3[0] * 0.41667;
  out[1] += tempVec3[1] * 0.41667;
  out[2] += tempVec3[2] * 0.41667;
  this.getPrev(1, tempVec3);
  out[0] += tempVec3[0] * 0.33333;
  out[1] += tempVec3[1] * 0.33333;
  out[2] += tempVec3[2] * 0.33333;
  this.getPrev(2, tempVec3);
  out[0] += tempVec3[0] * 0.25;
  out[1] += tempVec3[1] * 0.25;
  out[2] += tempVec3[2] * 0.25;
  this.getPrev(3, tempVec3);
  out[0] += tempVec3[0] * 0.1667;
  out[1] += tempVec3[1] * 0.1667;
  out[2] += tempVec3[2] * 0.1667;
  this.getPrev(4, tempVec3);
  out[0] += tempVec3[0] * 0.08333;
  out[1] += tempVec3[1] * 0.08333;
  out[2] += tempVec3[2] * 0.08333;
  this.getPrev(6, tempVec3);
  out[0] -= tempVec3[0] * 0.08333;
  out[1] -= tempVec3[1] * 0.08333;
  out[2] -= tempVec3[2] * 0.08333;
  this.getPrev(7, tempVec3);
  out[0] -= tempVec3[0] * 0.1667;
  out[1] -= tempVec3[1] * 0.1667;
  out[2] -= tempVec3[2] * 0.1667;
};



/**
 * Sensor fusion utility.
 * @constructor
 */
var SensorFusion = function() {
  // TODO(benvanik): remove unused/etc
  // TODO(benvanik): cleanup
  this.Q = new Float32Array([0, 0, 0, 1]);
  this.A = new Float32Array(3);
  this.AngV = new Float32Array(3);
  this.Mag = new Float32Array(3);
  this.RawMag = new Float32Array(3);
  this.Stage = 0;
  this.Gain = 0.05;
  this.YawMult = 1;
  this.EnableGravity = true;

  this.EnablePrediction = false;
  this.PredictionDT = 0.03;
  this.QP = new Float32Array([0, 0, 0, 1]);

  this.FMag = new SensorFilter(10);
  this.FAccW = new SensorFilter(20);
  this.FAngV = new SensorFilter(20);

  this.TiltCondCount = 0;
  this.TiltErrorAngle = 0;
  this.TiltErrorAxis = new Float32Array([0, 1, 0]);

  /**
   * Scratch quaternion for temp math.
   * @type {Float32Array}
   */
  this.tempQuat_ = new Float32Array(4);

  /**
   * Scratch vec3s for temp math.
   * @type {!Array.<!Float32Array>}
   * @private
   */
  this.tempVec3s_ = [
    new Float32Array(3), new Float32Array(3),
    new Float32Array(3), new Float32Array(3)
  ];
};


/**
 * Handles incoming sensor data from the device.
 * @param {!Object} sensors Sensor data.
 */
SensorFusion.prototype.handleSensorData = function(sensors) {
  var deltaT = sensors.timeDelta;
  var angVel = sensors.rotationRate;
  var rawAccel = sensors.acceleration;
  var mag = sensors.magneticField;

  vec3f.copy(this.AngV, sensors.rotationRate);
  this.AngV[1] *= this.YawMult;
  this.A = rawAccel;

  vec3f.copy(this.RawMag, mag);
  // if has mag cal, mult mag matrix
  vec3f.copy(this.Mag, mag);

  var angVelLength = vec3f.length(angVel);
  var accLength = vec3f.length(rawAccel);

  var accWorld = this.tempVec3s_[0];
  vec3f.transformQuat(accWorld, rawAccel, this.Q);

  this.Stage++;
  var currentTime = this.State * deltaT;

  this.FMag.addElement(mag);
  this.FAccW.addElement(accWorld);
  this.FAngV.addElement(angVel);

  if (angVelLength > 0) {
    var rotAxis = this.tempVec3s_[0];
    vec3f.scale(rotAxis, angVel, 1 / angVelLength);
    var halfRotAngle = angVelLength * deltaT * 0.5;
    var sinHRA = Math.sin(halfRotAngle);
    var deltaQ = this.tempQuat_;
    deltaQ[0] = rotAxis[0] * sinHRA;
    deltaQ[1] = rotAxis[1] * sinHRA;
    deltaQ[2] = rotAxis[2] * sinHRA;
    deltaQ[3] = Math.cos(halfRotAngle);

    quatf.multiply(this.Q, this.Q, deltaQ);

    quatf.copy(this.QP, this.Q);
    if (this.EnablePrediction) {
      var angVelF = this.tempVec3s_[1];
      this.FAngV.getSavitzkyGolaySmooth8(angVelF);
      var angVelFL = vec3f.length(angVelF);
      if (angVelFL > 0.001) {
        var rotAxisP = angVelF;
        vec3f.scale(rotAxisP, angVelF, 1 / angVelFL);
        var halfRotAngleP = angVelFL * this.PredictionDT * 0.5;
        var sinaHRAP = Math.sin(halfRotAngleP);
        quatf.set(this.tempQuat_,
            rotAxisP[0] * sinaHRAP, rotAxisP[1] * sinaHRAP,
            rotAxisP[2] * sinaHRAP, Math.cos(halfRotAngleP));
        quatf.multiply(this.QP, this.Q, this.tempQuat_);
      }
    }
  }

  if (this.Stage % 5000 == 0) {
    quatf.normalize(this.Q, this.Q);
  }

  if (this.EnableGravity) {
    var gravityEpsilon = 0.4;
    var angVelEpsilon = 0.1;
    var tiltPeriod = 50;
    var maxTiltError = 0.05;
    var minTiltError = 0.01;
    if ((Math.abs(accLength - 9.81) < gravityEpsilon) &&
        (angVelLength < angVelEpsilon)) {
      this.TiltCondCount++;
    } else {
      this.TiltCondCount = 0;
    }

    if (this.TiltCondCount >= tiltPeriod) {
      this.TiltCondCount = 0;
      var accWMean = this.tempVec3s_[0];
      this.FAccW.getMean(accWMean);
      var xzAcc = this.tempVec3s_[1];
      xzAcc[0] = accWMean[0];
      xzAcc[1] = 0;
      xzAcc[2] = accWMean[2];
      var tiltAxis = this.tempVec3s_[2];
      tiltAxis[0] = xzAcc[2];
      tiltAxis[1] = 0;
      tiltAxis[2] = -xzAcc[0];
      vec3f.normalize(tiltAxis, tiltAxis);
      var yUp = this.tempVec3s_[3];
      yUp[0] = 0;
      yUp[1] = 1;
      yUp[2] = 0;
      var tiltAngle = vec3f.angle(yUp, accWMean);
      if (tiltAngle > maxTiltError) {
        this.TiltErrorAngle = tiltAngle;
        this.TiltErrorAxis = tiltAxis;
      }
    }

    if (this.TiltErrorAngle > minTiltError) {
      if (this.TiltErrorAngle > 0.4 && this.Stage < 2000) {
        quatf.setAxisAngle(this.tempQuat_, this.TiltErrorAxis, -this.TiltErrorAngle);
        quatf.multiply(this.Q, this.tempQuat_, this.Q);
        this.TiltErrorAngle = 0;
      } else {
        var deltaTiltAngle = -this.Gain * this.TiltErrorAngle * 0.005 * (5 * angVelLength + 1);
        quatf.setAxisAngle(this.tempQuat_, this.TiltErrorAxis, deltaTiltAngle);
        quatf.multiply(this.Q, this.tempQuat_, this.Q);
        this.TiltErrorAngle += deltaTiltAngle;
      }
    }
  }
};


/**
 * Resets the current orientation to the identity.
 */
SensorFusion.prototype.reset = function() {
  quatf.identity(this.Q);
};


/**
 * Shared driver instance.
 * @type {!OculusDriver}
 * @global
 */
global.__vr_driver__ = new OculusDriver();

})(window);
