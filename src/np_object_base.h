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

#ifndef NP_OBJECT_BASE_H_
#define NP_OBJECT_BASE_H_

#include <npvr.h>


class NPObjectBase : public NPObject {
public:
  NPObjectBase(NPP npp);
  virtual ~NPObjectBase();

  virtual void Invalidate();
  virtual bool HasMethod(NPIdentifier name);
  virtual bool Invoke(NPIdentifier name, const NPVariant* args,
                      uint32_t argCount, NPVariant* result);
  virtual bool InvokeDefault(const NPVariant* args, uint32_t argCount,
                             NPVariant* result);
  virtual bool HasProperty(NPIdentifier name);
  virtual bool GetProperty(NPIdentifier name, NPVariant* result);
  virtual bool SetProperty(NPIdentifier name, const NPVariant* value);
  virtual bool RemoveProperty(NPIdentifier name);
  virtual bool Enumerate(NPIdentifier** identifiers, uint32_t* count);
  virtual bool Construct(const NPVariant* args, uint32_t argCount,
                         NPVariant* result);

public:
  static void _Deallocate(NPObject* npobj);
  static void _Invalidate(NPObject* npobj);
  static bool _HasMethod(NPObject* npobj, NPIdentifier name);
  static bool _Invoke(NPObject* npobj, NPIdentifier name,
                      const NPVariant* args, uint32_t argCount,
                      NPVariant* result);
  static bool _InvokeDefault(NPObject* npobj, const NPVariant* args,
                             uint32_t argCount, NPVariant* result);
  static bool _HasProperty(NPObject* npobj, NPIdentifier name);
  static bool _GetProperty(NPObject* npobj, NPIdentifier name,
                           NPVariant* result);
  static bool _SetProperty(NPObject* npobj, NPIdentifier name,
                           const NPVariant* value);
  static bool _RemoveProperty(NPObject* npobj, NPIdentifier name);
  static bool _Enumerate(NPObject* npobj, NPIdentifier** identifiers,
                         uint32_t* count);
  static bool _Construct(NPObject* npobj, const NPVariant* args,
                         uint32_t argCount, NPVariant* result);

protected:
  NPP npp_;
};


#define DECLARE_NPOBJECT_CLASS_WITH_BASE(_class, ctor)            \
    static NPClass s##_class##_NPClass = {                        \
    NP_CLASS_STRUCT_VERSION_CTOR,                                 \
    ctor,                                                         \
    NPObjectBase::_Deallocate,                                    \
    NPObjectBase::_Invalidate,                                    \
    NPObjectBase::_HasMethod,                                     \
    NPObjectBase::_Invoke,                                        \
    NPObjectBase::_InvokeDefault,                                 \
    NPObjectBase::_HasProperty,                                   \
    NPObjectBase::_GetProperty,                                   \
    NPObjectBase::_SetProperty,                                   \
    NPObjectBase::_RemoveProperty,                                \
    NPObjectBase::_Enumerate,                                     \
    NPObjectBase::_Construct                                      \
}

#define GET_NPOBJECT_CLASS(_class) &s##_class##_NPClass


#endif  // NP_OBJECT_BASE_H_
