# NOTE

This is very out of date! There's a new chrome.hid API that may allow a lot of this to be simplified!

# Experimental Oculus Rift USB Driver

This implements a simple, hacky Oculus Rift dev kit driver in pure Javascript using the [chrome.usb](http://developer.chrome.com/trunk/apps/usb.html) APIs. It only runs on Chrome, and only within a Packaged App.

If Mozilla completes their implementation of [WebUSB](https://bugzilla.mozilla.org/show_bug.cgi?id=674718) then this could be made to run there as well.

*This is the future.* The idea of secure, installation-less device drivers is incredibly exciting to me. Because permissions are granted on a per-device basis and the driver code is running within Chrome's sandbox there's effectively zero risk when using them. Of course your video driver won't be written in Javascript but almost all input and simple output devices could be. Imagine if all of your device drivers were secure, always available/zero install, worked on Windows/Mac/Linux/etc, and updatable within hours of new versions being released. For developers, edit-and-continue/edit-reload device drivers with zero compilation? Yessss.

## Preparing the Device

Unfortunately the Rift exposes itself as a HID device and operating systems prevent Chrome from using them. Hopefully future versions of Chrome will expose a HID API that allows easy access to these devices, but for now you must disable the built-in operating system HID control of the device. Once you do this the Rift will not be usable by the official Rift SDK until you disable the hacks.

No reboot is required to install/uninstall the hack, so if you want to experiment with this driver you can install the hack, test it out, and uninstall before using native Oculus SDK applications. In the future this hopefully won't be required.

### Windows

I've been unable to find a way to treat the Rift as a generic USB device. Until Chrome has a native HID API it may remain inaccessible. If you know a workaround please let me know!

### OS X

A codeless kernel extension is required to disable the system HID drivers from taking control of the Rift and preventing its use in Chrome. This extension is safe as it contains no code and is specified to only the Rift dev kit.

Installing:

* Execute `sudo ./experimental/usb-driver/hacks/install-usb-hack.sh`

Uninstalling:

* Execute `sudo ./experimental/usb-driver/hacks/uninstall-usb-hack.sh`

### Linux

A custom device rule that acts to unbind the Rift from the USB HID driver every time its plugged in is required.

Installing:

* Execute `sudo ./experimental/usb-drivers/hacks/install-usb-hack.sh`

Uninstalling:

* Execute `sudo ./experimental/usb-drivers/hacks/uninstall-usb-hack.sh`

## Preparing the Demo

* Execute `./experimental/usb-driver/setup.sh` to copy files.
* Load the `experimental/usb-driver` unpacked extension from chrome://extensions
* Launch!

## Limitations

The chrome.usb APIs (and all of the chrome.* APIs) are implemented very inefficiently right now. The actual time spent in Javascript while using this driver is miniscule and the overhead from the APIs dwarfs it by orders of magnitude (or three...). Hopefully work can be done to optimize the IPC occurring during each API call, as well as adding APIs that more accurately model the use case of USB (for example, overlapping interrupt reads to prevent the round-trip stalls). I don't think many others have exercised the APIs like this does, so it can only get better with feedback!

The Chrome API's only expose raw USB devices and there is no API for HID devices (such as the Rift). This is why the hacks above are required. My hope is that Chrome will expose HID devices through chrome.usb (or some other API) to allow this driver to work on all platforms without any work by the user.

## Ideas

* Refactor and mock out a chrome.usb.hid API, use that instead of random HID code.

## Bugs/Known Issues

### Missing Features

* I'm not currently using the magnetometer data to correct for yaw drift (as added in the official 2.1 SDK).

### chrome.usb Bugs

I still need to file these, but already I've found a few:

* interrupt transfer does not time out/error if device is unplugged (OSX, +?)
* control transfter does not fail if device is unplugged (OSX, +?)
* sometimes control transfer will fail with an undefined argument (no info)
* claimInterface has no error argument (all)
