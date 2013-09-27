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

#include <windows.h>


// The registry key that the plugin gets registered under when running regsvr32.
#define MOZILLA_REG_KEY L"Software\\MozillaPlugins\\google/npvr"


namespace {
// Setup on module load.
HINSTANCE globalInstance_ = NULL;
}

extern "C" BOOL APIENTRY DllMain(
    HINSTANCE hInstance, DWORD dwReason, LPVOID lpReserved) {
  globalInstance_ = hInstance;
  return TRUE;
}

extern "C" STDAPI DllRegisterServer() {
  WCHAR path[MAX_PATH];
  GetModuleFileName(globalInstance_, path, sizeof(path));
  DWORD path_size = (wcslen(path) + 1) * sizeof(WCHAR);
  RegSetKeyValue(
      HKEY_CURRENT_USER, MOZILLA_REG_KEY, L"Path",
      REG_SZ, path, path_size);
  return S_OK;
}

extern "C" STDAPI DllUnregisterServer() {
  RegDeleteKey(HKEY_CURRENT_USER, MOZILLA_REG_KEY);
  return S_OK;
}
