/**
 * Copyright 2013 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <npvr/ovr_manager.h>


using namespace npvr;

OVRManager *OVRManager::Instance() {
  static OVRManager instance;
  return &instance;
}

OVRManager::OVRManager() :
    hmd_device_(NULL),
    sensor_fusion_(NULL) {
  OVR::System::Init();
  device_manager_ = OVR::DeviceManager::Create();
  device_manager_->SetMessageHandler(this);
  OVR::HMDDevice* hmd_device = device_manager_->EnumerateDevices<OVR::HMDDevice>().CreateDevice();
  if (hmd_device) {
    SetDevice(hmd_device);
  }
}

OVRManager::~OVRManager() {
  SetDevice(NULL);
  device_manager_->Release();

  // TODO(benvanik): figure out why we cannot call this. It blocks forever in
  // Thread::FinishAllThreads(), waiting for a thread that seems to have already
  // been killed. This is likely a bug in the SDK. In FF, though, this only ever
  // gets called when shutting down the browser, so the leak isn't bad.
  //OVR::System::Destroy();
}

void OVRManager::OnMessage(const OVR::Message &message) {
  switch(message.Type) {
  case OVR::Message_DeviceAdded:
    break;
  case OVR::Message_DeviceRemoved:
    break;
  default:
    break;
  }
}

OVR::HMDDevice* OVRManager::GetDevice() const {
  return hmd_device_;
}

const OVR::HMDInfo* OVRManager::GetDeviceInfo() const {
  return &hmd_device_info_;
}

void OVRManager::SetDevice(OVR::HMDDevice* device) {
  if (hmd_device_ == device) {
    return;
  }
  if (hmd_device_) {
    // Release existing device.
    hmd_device_->Release();
    delete sensor_fusion_;
  }
  if (!device) {
    return;
  }

  hmd_device_ = device;
  if (!hmd_device_->GetDeviceInfo(&hmd_device_info_)) {
    hmd_device_ = NULL;
    hmd_device_->Release();
    return;
  }

  sensor_fusion_ = new OVR::SensorFusion();
  sensor_fusion_->AttachToSensor(hmd_device_->GetSensor());
  sensor_fusion_->SetDelegateMessageHandler(this);
}

bool OVRManager::DevicePresent() const {
  return hmd_device_ != NULL;
}

OVR::Quatf OVRManager::GetOrientation() const {
  if (sensor_fusion_) {
    return sensor_fusion_->GetOrientation();
  } else {
    return OVR::Quatf(0, 0, 0, 1);
  }
}

void OVRManager::ResetOrientation() {
  if (sensor_fusion_) {
    sensor_fusion_->Reset();
  }
}
