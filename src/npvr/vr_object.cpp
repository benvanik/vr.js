// NPVR TEST

#include <npvr/vr_object.h>
#include <npvr/ovr_manager.h>

#ifdef USE_SIXENSE
#include <third_party/sixense/include/sixense.h>
#endif // USE_SIXENSE

using namespace npvr;


namespace {

DECLARE_NPOBJECT_CLASS_WITH_BASE(VRObject, VRObject::Allocate);

#ifdef USE_SIXENSE
// HACK: not thread safe!
static int sixense_init_count_ = 0;
#endif // USE_SIXENSE

}


NPClass* VRObject::np_class() {
  return GET_NPOBJECT_CLASS(VRObject);
}

NPObject* VRObject::Allocate(NPP npp, NPClass* aClass) {
  return new VRObject(npp);
}

VRObject::VRObject(NPP npp) :
    NPObjectBase(npp),
    sixense_ready_(false) {
  exec_id_ = NPN_GetStringIdentifier("exec");
  poll_id_ = NPN_GetStringIdentifier("poll");

#ifdef USE_SIXENSE
  // Initialize sixense library, if needed.
  if (!sixense_init_count_) {
    sixense_ready_ = sixenseInit() == SIXENSE_SUCCESS;
  } else {
    sixense_ready_ = true;
  }
  if (sixense_ready_) {
    sixense_init_count_++;
  }
#endif // USE_SIXENSE
}

VRObject::~VRObject() {
#ifdef USE_SIXENSE
  sixense_init_count_--;
  if (!sixense_init_count_) {
    sixenseExit();
  }
#endif // USE_SIXENSE
}

bool VRObject::InvokeExec(const NPVariant* args, uint32_t arg_count,
                          NPVariant* result) {
  // arg0: command id
  // arg1: command string
  if (arg_count != 2) {
    return false;
  }
  if (!(NPVARIANT_IS_INT32(args[0]) || NPVARIANT_IS_DOUBLE(args[0])) ||
      !NPVARIANT_IS_STRING(args[1])) {
    return false;
  }

  int32_t command_id = 0;
  if (NPVARIANT_IS_INT32(args[0])) {
    command_id = NPVARIANT_TO_INT32(args[0]);
  } else if (NPVARIANT_IS_DOUBLE(args[0])) {
    command_id = (int)NPVARIANT_TO_DOUBLE(args[0]);
  }
  const NPUTF8* command_str = NPVARIANT_TO_STRING(args[1]).UTF8Characters;

  std::ostringstream s;

  switch (command_id) {
    case 0x0001:
      QueryHmdInfo((const char*)command_str, s);
      break;
    case 0x0002:
      ResetHmdOrientation((const char*)command_str, s);
      break;
  }

  // TODO(benvanik): avoid this extra allocation/copy somehow - perhaps
  //     by preallocating a large enough buffer (fixed size 8K or something)
  std::string s_value = s.str();
  size_t s_len = s_value.length();
  NPUTF8* ret_str = (NPUTF8*)NPN_MemAlloc(s_len + 1);
  strcpy(ret_str, s_value.c_str());
  STRINGZ_TO_NPVARIANT(ret_str, *result);

  return true;
}

void VRObject::QueryHmdInfo(const char* command_str, std::ostringstream& s) {
  OVRManager *manager = OVRManager::Instance();
  if (!manager->DevicePresent()) {
    return;
  }

  const OVR::HMDInfo& info = *manager->GetDeviceInfo();

  s << info.ProductName << "," << info.Manufacturer << "," << info.Version << ",";
  s << info.DesktopX << "," << info.DesktopY << ",";
  s << info.HResolution << "," << info.VResolution << ",";
  s << info.HScreenSize << "," << info.VScreenSize << ",";
  s << info.VScreenCenter << ",";
  s << info.EyeToScreenDistance << ",";
  s << info.LensSeparationDistance << ",";
  s << info.InterpupillaryDistance << ",";
  s << info.DistortionK[0] << ",";
  s << info.DistortionK[1] << ",";
  s << info.DistortionK[2] << ",";
  s << info.DistortionK[3] << ",";
  s << info.ChromaAbCorrection[0] << ",";
  s << info.ChromaAbCorrection[1] << ",";
  s << info.ChromaAbCorrection[2] << ",";
  s << info.ChromaAbCorrection[3];
}

void VRObject::ResetHmdOrientation(const char* command_str, std::ostringstream& s) {
  OVRManager *manager = OVRManager::Instance();
  if (!manager->DevicePresent()) {
    return;
  }

  manager->ResetOrientation();
}

bool VRObject::InvokePoll(const NPVariant* args, uint32_t arg_count,
                          NPVariant* result) {
  std::ostringstream s;

  PollSixenseState(s);
  PollHmdState(s);

  // TODO(benvanik): avoid this extra allocation/copy somehow - perhaps
  //     by preallocating a large enough buffer (fixed size 8K or something)
  std::string s_value = s.str();
  size_t s_len = s_value.length();
  NPUTF8* ret_str = (NPUTF8*)NPN_MemAlloc(s_len + 1);
  strcpy(ret_str, s_value.c_str());
  STRINGZ_TO_NPVARIANT(ret_str, *result);

  return true;
}

void VRObject::PollSixenseState(std::ostringstream& s) {
  if (!sixense_ready_) {
    return;
  }

#ifdef USE_SIXENSE
  s << "s,";

  sixenseAllControllerData acd;
  int max_bases = sixenseGetMaxBases();
  for (int base = 0; base < max_bases; base++) {
    if (!sixenseIsBaseConnected(base)) {
      continue;
    }
    sixenseSetActiveBase(base);

    // TODO(benvanik): stash sequence numbers and get all recent data
    sixenseGetAllNewestData(&acd);

    s << "b," << base << ",";

    int max_conts = sixenseGetMaxControllers();
    for (int cont = 0; cont < max_conts; cont++) {
      if (!sixenseIsControllerEnabled(cont)) {
        continue;
      }

      s << "c," << cont << ",";

      s << acd.controllers[cont].pos[0] << ",";
      s << acd.controllers[cont].pos[1] << ",";
      s << acd.controllers[cont].pos[2] << ",";
      s << acd.controllers[cont].rot_quat[0] << ",";
      s << acd.controllers[cont].rot_quat[1] << ",";
      s << acd.controllers[cont].rot_quat[2] << ",";
      s << acd.controllers[cont].rot_quat[3] << ",";
      s << acd.controllers[cont].joystick_x << ",";
      s << acd.controllers[cont].joystick_y << ",";
      s << acd.controllers[cont].trigger << ",";
      s << acd.controllers[cont].buttons << ",";
      s << (acd.controllers[cont].is_docked ? "1," : "0,");
      s << (int)acd.controllers[cont].which_hand << ",";
      s << (int)acd.controllers[cont].hemi_tracking_enabled << ",";
    }
  }

  s << "|";
#endif // USE_SIXENSE
}

void VRObject::PollHmdState(std::ostringstream& s) {
  OVRManager *manager = OVRManager::Instance();
  if (manager->DevicePresent()) {
    s << "r,";
    OVR::Quatf o = manager->GetOrientation();
    s << o.x << "," << o.y << "," << o.z << "," << o.w;
    s << "|";
  }
}

bool VRObject::HasMethod(NPIdentifier name) {
  if (name == exec_id_ ||
      name == poll_id_) {
    return true;
  }
  return false;
}

bool VRObject::Invoke(NPIdentifier name, const NPVariant* args,
                      uint32_t argCount, NPVariant* result) {
  if (name == exec_id_) {
    return InvokeExec(args, argCount, result);
  } else if (name == poll_id_) {
    return InvokePoll(args, argCount, result);
  }
  return false;
}

bool VRObject::InvokeDefault(const NPVariant* args, uint32_t argCount,
                             NPVariant *result) {
  return false;
}

bool VRObject::HasProperty(NPIdentifier name) {
  return false;
}

bool VRObject::GetProperty(NPIdentifier name, NPVariant *result) {
  return false;
}

bool VRObject::SetProperty(NPIdentifier name, const NPVariant* value) {
  return false;
}

bool VRObject::Enumerate(NPIdentifier** identifiers, uint32_t* count) {
  static NPIdentifier all_ids[] = {
    exec_id_,
    poll_id_,
  };
  int id_count = (int)(sizeof(all_ids) / sizeof(NPIdentifier));
  NPIdentifier* ids = (NPIdentifier*)NPN_MemAlloc(id_count);
  memcpy(ids, all_ids, sizeof(all_ids));
  *identifiers = ids;
  *count = id_count;
  return true;
}
