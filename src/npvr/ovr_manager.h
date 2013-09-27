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
