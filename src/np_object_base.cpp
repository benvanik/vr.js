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

#include <np_object_base.h>


NPObjectBase::NPObjectBase(NPP npp) :
    npp_(npp) {
}

NPObjectBase::~NPObjectBase() {
}

void NPObjectBase::Invalidate() {
}

bool NPObjectBase::HasMethod(NPIdentifier name) {
  return false;
}

bool NPObjectBase::Invoke(NPIdentifier name, const NPVariant* args,
                          uint32_t argCount, NPVariant* result) {
  return false;
}

bool NPObjectBase::InvokeDefault(const NPVariant* args,
                                 uint32_t argCount, NPVariant* result) {
  return false;
}

bool NPObjectBase::HasProperty(NPIdentifier name) {
  return false;
}

bool NPObjectBase::GetProperty(NPIdentifier name, NPVariant* result) {
  return false;
}

bool NPObjectBase::SetProperty(NPIdentifier name, const NPVariant* value) {
  return false;
}

bool NPObjectBase::RemoveProperty(NPIdentifier name) {
  return false;
}

bool NPObjectBase::Enumerate(NPIdentifier** identifiers, uint32_t* count) {
  return false;
}

bool NPObjectBase::Construct(const NPVariant* args, uint32_t argCount,
                             NPVariant* result) {
  return false;
}

void NPObjectBase::_Deallocate(NPObject* npobj) {
  delete (NPObjectBase*)npobj;
}

void NPObjectBase::_Invalidate(NPObject* npobj) {
  ((NPObjectBase*)npobj)->Invalidate();
}

bool NPObjectBase::_HasMethod(NPObject* npobj, NPIdentifier name) {
  return ((NPObjectBase*)npobj)->HasMethod(name);
}

bool NPObjectBase::_Invoke(NPObject* npobj, NPIdentifier name,
                           const NPVariant* args, uint32_t argCount,
                           NPVariant* result) {
  return ((NPObjectBase*)npobj)->Invoke(name, args, argCount, result);
}

bool NPObjectBase::_InvokeDefault(NPObject* npobj, const NPVariant* args,
                                  uint32_t argCount, NPVariant* result) {
  return ((NPObjectBase*)npobj)->InvokeDefault(args, argCount, result);
}

bool NPObjectBase::_HasProperty(NPObject* npobj, NPIdentifier name) {
  return ((NPObjectBase*)npobj)->HasProperty(name);
}

bool NPObjectBase::_GetProperty(NPObject* npobj, NPIdentifier name,
                                NPVariant* result) {
  return ((NPObjectBase*)npobj)->GetProperty(name, result);
}

bool NPObjectBase::_SetProperty(NPObject* npobj, NPIdentifier name,
                                const NPVariant* value) {
  return ((NPObjectBase*)npobj)->SetProperty(name, value);
}

bool NPObjectBase::_RemoveProperty(NPObject* npobj, NPIdentifier name) {
  return ((NPObjectBase*)npobj)->RemoveProperty(name);
}

bool NPObjectBase::_Enumerate(NPObject* npobj, NPIdentifier** identifiers,
                              uint32_t* count) {
  return ((NPObjectBase*)npobj)->Enumerate(identifiers, count);
}

bool NPObjectBase::_Construct(NPObject* npobj, const NPVariant* args,
                              uint32_t argCount, NPVariant* result) {
  return ((NPObjectBase*)npobj)->Construct(args, argCount, result);
}
