

Bus 001 Device 003: ID 2833:0001
Device Descriptor:
  bLength                18
  bDescriptorType         1
  bcdUSB               2.00
  bDeviceClass            0 (Defined at Interface level)
  bDeviceSubClass         0
  bDeviceProtocol         0
  bMaxPacketSize0        64
  idVendor           0x2833
  idProduct          0x0001
  bcdDevice            0.16
  iManufacturer           1 Oculus VR, Inc.
  iProduct                2 Tracker DK
  iSerial                 3 AAAAAAAAAAAA
  bNumConfigurations      1
  Configuration Descriptor:
    bLength                 9
    bDescriptorType         2
    wTotalLength           34
    bNumInterfaces          1
    bConfigurationValue     1
    iConfiguration          0
    bmAttributes         0xa0
      (Bus Powered)
      Remote Wakeup
    MaxPower              100mA
    Interface Descriptor:
      bLength                 9
      bDescriptorType         4
      bInterfaceNumber        0
      bAlternateSetting       0
      bNumEndpoints           1
      bInterfaceClass         3 Human Interface Device
      bInterfaceSubClass      0 No Subclass
      bInterfaceProtocol      0 None
      iInterface              0
        HID Device Descriptor:
          bLength                 9
          bDescriptorType        33
          bcdHID               1.10
          bCountryCode            0 Not supported
          bNumDescriptors         1
          bDescriptorType        34 Report
          wDescriptorLength     401
         Report Descriptors:
           ** UNAVAILABLE **
      Endpoint Descriptor:
        bLength                 7
        bDescriptorType         5
        bEndpointAddress     0x81  EP 1 IN
        bmAttributes            3
          Transfer Type            Interrupt
          Synch Type               None
          Usage Type               Data
        wMaxPacketSize     0x0040  1x 64 bytes
        bInterval               1
Device Status:     0x0002
  (Bus Powered)
  Remote Wakeup Enabled


  looking at device '/devices/pci0000:00/0000:00:1a.0/usb1/1-1/1-1.3':
    KERNEL=="1-1.3"
    SUBSYSTEM=="usb"
    DRIVER=="usb"
    ATTR{configuration}==""
    ATTR{bNumInterfaces}==" 1"
    ATTR{bConfigurationValue}=="1"
    ATTR{bmAttributes}=="a0"
    ATTR{bMaxPower}=="100mA"
    ATTR{urbnum}=="35"
    ATTR{idVendor}=="2833"
    ATTR{idProduct}=="0001"
    ATTR{bcdDevice}=="0016"
    ATTR{bDeviceClass}=="00"
    ATTR{bDeviceSubClass}=="00"
    ATTR{bDeviceProtocol}=="00"
    ATTR{bNumConfigurations}=="1"
    ATTR{bMaxPacketSize0}=="64"
    ATTR{speed}=="12"
    ATTR{busnum}=="1"
    ATTR{devnum}=="3"
    ATTR{devpath}=="1.3"
    ATTR{version}==" 2.00"
    ATTR{maxchild}=="0"
    ATTR{quirks}=="0x0"
    ATTR{avoid_reset_quirk}=="0"
    ATTR{authorized}=="1"
    ATTR{manufacturer}=="Oculus VR, Inc."
    ATTR{product}=="Tracker DK"
    ATTR{serial}=="AAAAAAAAAAAA"


http://www.usbmadesimple.co.uk/ums_5.htm
http://www.usbmadesimple.co.uk/ums_4.htm
http://www.beyondlogic.org/usbnutshell/usb6.shtml

http://developer.chrome.com/apps/app_hardware.html
http://developer.chrome.com/apps/usb.html
