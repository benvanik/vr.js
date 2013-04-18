// NPVR TEST

#ifndef NPVR_OVR_MANAGER_H_
#define NPVR_OVR_MANAGER_H_

#include <OVR.h>


namespace npvr {

class OVRManager: public OVR::MessageHandler {
public:
  virtual ~OVRManager();
  static OVRManager *Instance();
  OVR::HMDDevice* GetDevice() const;
  const OVR::HMDInfo* GetDeviceInfo() const;
  bool DevicePresent() const;
  OVR::Quatf GetOrientation() const;
  void ResetOrientation();
  virtual void OnMessage(const OVR::Message &message);
private:
  OVRManager();
  void SetDevice(OVR::HMDDevice* device);
  OVR::DeviceManager *device_manager_;
  OVR::HMDDevice     *hmd_device_;
  OVR::HMDInfo       hmd_device_info_;
  OVR::SensorFusion  *sensor_fusion_;
};

}  // namespace npvr


#endif  // NPVR_OVR_MANAGER_H_
