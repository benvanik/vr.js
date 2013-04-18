// NPVR TEST

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
  void QueryOculusInfo(const char* command_str, std::ostringstream& s);
  void ResetOculusOrientation(const char* command_str, std::ostringstream& s);

  bool InvokePoll(const NPVariant* args, uint32_t arg_count, NPVariant* result);
  void PollSixense(std::ostringstream& s);
  void PollOculus(std::ostringstream& s);

private:
  NPIdentifier    exec_id_;
  NPIdentifier    poll_id_;

  bool            sixense_ready_;
};

}  // namespace npvr


#endif  // NPVR_VR_OBJECT_H_
