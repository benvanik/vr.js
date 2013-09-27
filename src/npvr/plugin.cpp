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

#include <npvr/plugin.h>
#include <npvr/vr_object.h>


using namespace npvr;


Plugin::Plugin(NPP np_instance) :
    np_instance_(np_instance), np_window_(NULL),
    initialized_(false), vr_object_(NULL) {
}

Plugin::~Plugin() {
  if (vr_object_) {
    NPN_ReleaseObject(vr_object_);
  }
}

bool Plugin::Init(NPWindow* np_window) {
  if (initialized_) {
    return true;
  }
  if (!np_window) {
    return false;
  }

  np_window_ = np_window;

  NPError r;

  NPObject* window_obj = NULL;
  r = NPN_GetValue(np_instance_, NPNVWindowNPObject, &window_obj);
  if (r != NPERR_NO_ERROR) {
    // Unable to get Window object.
    return false;
  }

  // Create vr object.
  vr_object_ = NPN_CreateObject(np_instance_, VRObject::np_class());
  if (!vr_object_) {
    // Unable to create object.
    NPN_ReleaseObject(window_obj);
    return false;
  }
  NPN_RetainObject(vr_object_);

  // Expose the vr object onto the window object.
  NPIdentifier vr_id = NPN_GetStringIdentifier("_vr_native_");
  NPVariant v;
  OBJECT_TO_NPVARIANT(vr_object_, v);
  r = NPN_SetProperty(np_instance_, window_obj, vr_id, &v);

  NPN_ReleaseObject(window_obj);

  initialized_ = true;
  return true;
}

void Plugin::Destroy() {
  if (!initialized_) {
    return;
  }
  initialized_ = false;
}

bool Plugin::is_initialized() {
  return initialized_;
}

NPObject* Plugin::vr_object() {
  return vr_object_;
}
