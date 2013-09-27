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

#ifndef NPVR_PLUGIN_H_
#define NPVR_PLUGIN_H_

#include <npvr.h>


namespace npvr {

class Plugin {
public:
  Plugin(NPP np_instance);
  ~Plugin();

  bool Init(NPWindow* np_window);
  void Destroy();

  bool is_initialized();
  NPObject* vr_object();

private:
  NPP         np_instance_;
  NPWindow*   np_window_;
  bool        initialized_;
  NPObject*   vr_object_;
};

}  // namespace npvr


#endif  // NPVR_PLUGIN_H_
