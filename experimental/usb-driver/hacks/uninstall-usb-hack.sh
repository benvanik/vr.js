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
  echo "Detected Linux, will remove the hack udev rule and restart udev."

  echo "Deleting the udev rule..."
  rm /lib/udev/rules.d/40-oculus.rules

  echo "Restarting the udev service..."
  service udev restart

  echo "Done!"
elif [ "$OS" == "Darwin" ]; then
  # OSX
  echo "Detected OSX, will remove the kernel extension."

  echo "Unloading the extension..."
  kextunload -v /System/Library/Extensions/vr-js-usb-hack.kext/

  echo "Deleting the extension from /System/Library/Extensions/..."
  rm -rf /System/Library/Extensions/vr-js-usb-hack.kext

  echo "Kicking off a extension cache refresh..."
  touch /System/Library/Extensions/

  echo "Done!"
else
  # Unknown
  echo "Unsupported operating system: $OS"
  exit 1
fi

popd > /dev/null
