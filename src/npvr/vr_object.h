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

#ifndef NPVR_VR_OBJECT_H_
#define NPVR_VR_OBJECT_H_

#include <npvr.h>
#include <np_object_base.h>

namespace npvr {

class VRObject : public NPObjectBase {
public:
  static NPClass* np_class();
  static NPObject* Allocate(NPP npp, NPClass* aClass);
  VRObject(NPP npp);
  virtual ~VRObject();

public:
  virtual bool HasMethod(NPIdentifier name);
  virtual bool Invoke(NPIdentifier name, const NPVariant* args,
                      uint32_t argCount, NPVariant* result);
  virtual bool InvokeDefault(const NPVariant* args, uint32_t argCount,
                             NPVariant* result);
  virtual bool HasProperty(NPIdentifier name);
  virtual bool GetProperty(NPIdentifier name, NPVariant* result);
  virtual bool SetProperty(NPIdentifier name, const NPVariant* value);
  virtual bool Enumerate(NPIdentifier** identifier, uint32_t* count);

private:
  bool InvokeExec(const NPVariant* args, uint32_t arg_count, NPVariant* result);
  void QueryHmdInfo(const char* command_str, std::ostringstream& s);
  void ResetHmdOrientation(const char* command_str, std::ostringstream& s);

  bool InvokePoll(const NPVariant* args, uint32_t arg_count, NPVariant* result);
  void PollSixenseState(std::ostringstream& s);
  void PollHmdState(std::ostringstream& s);

private:
  NPIdentifier    exec_id_;
  NPIdentifier    poll_id_;

  bool            sixense_ready_;
};

}  // namespace npvr


#endif  // NPVR_VR_OBJECT_H_
