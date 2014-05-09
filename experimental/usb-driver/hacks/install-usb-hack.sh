#!/usr/bin/env bash

# Script must be run as root.
if [ "$(id -u)" != "0" ]; then
   echo "This script must be run as root; try sudo!" 1>&2
   exit 1
fi

pushd `dirname $0` > /dev/null

# Request device unplug.
read -p "Unplug your Rift and hit enter to continue..."

# Switch on OS.
OS="`uname -s`"
if [ "$OS" == "Linux" ]; then
  # Linux
  echo "Detected Linux, will attempt to install udev rule."

  echo "Copying 40-oculus.rules to /lib/udev/rules.d/..."
  cp 40-oculus.rules /lib/udev/rules.d/

  echo "Restarting the udev service..."
  service udev restart

  read -p "Done! Plug your device in and hit enter to continue..."

  # TODO(benvanik): verify using usb-devices, confirm Driver=(none).
  echo "Verify by using 'usb-devices'; look for Tracker and confirm that it"
  echo "has a Driver=(none) tag."
elif [ "$OS" == "Darwin" ]; then
  # OSX
  echo "Detected OSX, will attempt to install a codeless kernel extension."

  echo "Copying vr-js-usb-hack.kext to /System/Library/Extensions/..."
  cp -r vr-js-usb-hack.kext vr-js-usb-hack.kext1
  chown -R root:wheel vr-js-usb-hack.kext1
  rm -rf /System/Library/Extensions/vr-js-usb-hack.kext
  mv vr-js-usb-hack.kext1 /System/Library/Extensions/vr-js-usb-hack.kext

  echo "Loading the extension..."
  kextutil -t -v /System/Library/Extensions/vr-js-usb-hack.kext/

  echo "Kicking off a extension cache refresh..."
  touch /System/Library/Extensions/

  read -p "Done! Plug your device in and hit enter to continue..."

  # TODO(benvanik): verify using ioreg -b -f, look for tracker, ensure not HID.
  ioreg -b -f | grep -n5 Tracker
  echo "You should *NOT* see an HID device information in the Tracker output"
  echo "above. If you do, this failed!"
else
  # Unknown
  echo "Unsupported operating system: $OS"
  exit 1
fi

popd > /dev/null
