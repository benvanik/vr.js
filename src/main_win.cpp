// NPVR TEST

#include <windows.h>


// The registry key that the plugin gets registered under when running regsvr32.
#define MOZILLA_REG_KEY L"Software\\MozillaPlugins\\benvanik/npvr"


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
