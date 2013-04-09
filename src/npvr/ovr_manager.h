// NPVR TEST

#ifndef NPVR_OVR_MANAGER_H_
#define NPVR_OVR_MANAGER_H_

#include <OVR.h>


namespace npvr {

class OVRManager: public OVR::MessageHandler {
public:
  static OVRManager *Instance();
  bool DevicePresent() const;
  OVR::Quatf &GetOrientation() const;
  virtual void OnMessage(const OVR::Message &message);
private:
  OVRManager();
  OVR::DeviceManager *device_manager_;
  OVR::HMDDevice     *hmd_device_;
  OVR::SensorFusion  *sensor_fusion_;
};

}  // namespace npvr


#endif  // NPVR_OVR_MANAGER_H_
