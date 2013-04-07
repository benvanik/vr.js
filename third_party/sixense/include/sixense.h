/*
 *
 * SIXENSE CONFIDENTIAL
 *
 * Copyright (C) 2011 Sixense Entertainment Inc.
 * All Rights Reserved
 *
 */

#ifndef _SIXENSE_H_
#define _SIXENSE_H_

#if defined(WIN32)
  #ifdef SIXENSE_STATIC_LIB
    #define SIXENSE_EXPORT 
  #else
    #ifdef SIXENSE_BUILDING_DLL
      #define SIXENSE_EXPORT __declspec(dllexport)
    #else
      #define SIXENSE_EXPORT __declspec(dllimport)
    #endif
  #endif
#else
  #define SIXENSE_EXPORT 
#endif

#define SIXENSE_BUTTON_BUMPER   (0x01<<7)
#define SIXENSE_BUTTON_JOYSTICK (0x01<<8)
#define SIXENSE_BUTTON_1        (0x01<<5)
#define SIXENSE_BUTTON_2        (0x01<<6)
#define SIXENSE_BUTTON_3        (0x01<<3)
#define SIXENSE_BUTTON_4        (0x01<<4)
#define SIXENSE_BUTTON_START    (0x01<<0)

#define SIXENSE_SUCCESS 0
#define SIXENSE_FAILURE -1

#define SIXENSE_MAX_CONTROLLERS 4

typedef struct _sixenseControllerData {
  float pos[3];
  float rot_mat[3][3];
  float joystick_x;
  float joystick_y;
  float trigger;
  unsigned int buttons;
  unsigned char sequence_number;
  float rot_quat[4];
  unsigned short firmware_revision;
  unsigned short hardware_revision;
  unsigned short packet_type;
  unsigned short magnetic_frequency;
  int enabled;
  int controller_index;
  unsigned char is_docked;
  unsigned char which_hand;
  unsigned char hemi_tracking_enabled;
} sixenseControllerData;

typedef struct _sixenseAllControllerData {
  sixenseControllerData controllers[4];
} sixenseAllControllerData;

#if defined(__LANGUAGE_C_PLUS_PLUS)||defined(__cplusplus)||defined(c_plusplus)
extern "C" {
#endif

SIXENSE_EXPORT int sixenseInit( void );
SIXENSE_EXPORT int sixenseExit( void );

SIXENSE_EXPORT int sixenseGetMaxBases();
SIXENSE_EXPORT int sixenseSetActiveBase( int i );
SIXENSE_EXPORT int sixenseIsBaseConnected( int i );

SIXENSE_EXPORT int sixenseGetMaxControllers( void );
SIXENSE_EXPORT int sixenseIsControllerEnabled( int which );
SIXENSE_EXPORT int sixenseGetNumActiveControllers();

SIXENSE_EXPORT int sixenseGetHistorySize();

SIXENSE_EXPORT int sixenseGetData( int which, int index_back, sixenseControllerData * );
SIXENSE_EXPORT int sixenseGetAllData( int index_back, sixenseAllControllerData * );
SIXENSE_EXPORT int sixenseGetNewestData( int which, sixenseControllerData * );
SIXENSE_EXPORT int sixenseGetAllNewestData( sixenseAllControllerData * );

SIXENSE_EXPORT int sixenseSetHemisphereTrackingMode( int which_controller, int state );
SIXENSE_EXPORT int sixenseGetHemisphereTrackingMode( int which_controller, int *state );

SIXENSE_EXPORT int sixenseAutoEnableHemisphereTracking( int which_controller );

SIXENSE_EXPORT int sixenseSetHighPriorityBindingEnabled( int on_or_off );
SIXENSE_EXPORT int sixenseGetHighPriorityBindingEnabled( int *on_or_off );

SIXENSE_EXPORT int sixenseTriggerVibration( int controller_id, int duration_100ms, int pattern_id );

SIXENSE_EXPORT int sixenseSetFilterEnabled( int on_or_off );
SIXENSE_EXPORT int sixenseGetFilterEnabled( int *on_or_off );

SIXENSE_EXPORT int sixenseSetFilterParams( float near_range, float near_val, float far_range, float far_val );
SIXENSE_EXPORT int sixenseGetFilterParams( float *near_range, float *near_val, float *far_range, float *far_val );

SIXENSE_EXPORT int sixenseSetBaseColor( unsigned char red, unsigned char green, unsigned char blue );
SIXENSE_EXPORT int sixenseGetBaseColor( unsigned char *red, unsigned char *green, unsigned char *blue );

#if defined(__LANGUAGE_C_PLUS_PLUS)||defined(__cplusplus)||defined(c_plusplus)
}
#endif

#endif /* _SIXENSE_H_ */
