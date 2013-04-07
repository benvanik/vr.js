// NPVR TEST

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
