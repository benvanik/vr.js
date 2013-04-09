// NPVR TEST

#include <npvr/ovr_manager.h>


using namespace npvr;

OVRManager *OVRManager::Instance() {
  static OVRManager instance;
  return &instance;
}

OVRManager::OVRManager() {
  OVR::System::Init();
  sensor_fusion_ = new OVR::SensorFusion();
  device_manager_ = OVR::DeviceManager::Create();
  hmd_device_ = device_manager_->EnumerateDevices<OVR::HMDDevice>().CreateDevice();
  if (hmd_device_) {
    sensor_fusion_->AttachToSensor(hmd_device_->GetSensor());
  }
  device_manager_->SetMessageHandler(this);
}

void OVRManager::OnMessage(const OVR::Message &message) {
  switch(message.Type) {
  case OVR::MessageType::Message_DeviceRemoved:
    // TODO: Verify that the removed device is the one we're using.
    if (hmd_device_) {
      hmd_device_->Release();
      hmd_device_ = NULL;
    }
    break;
  case OVR::MessageType::Message_DeviceAdded:
    if (!hmd_device_) {
      // TODO: This doesn't work for some reason.
      hmd_device_ = device_manager_->EnumerateDevices<OVR::HMDDevice>().CreateDevice();
      if (hmd_device_) {
        sensor_fusion_->AttachToSensor(hmd_device_->GetSensor());
      }
    }
    break;
  default:
    break;
  }
}

bool OVRManager::DevicePresent() const {
  return hmd_device_;
}

OVR::Quatf &OVRManager::GetOrientation() const {
  return sensor_fusion_->GetOrientation();
}
