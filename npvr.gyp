# Copyright 2013 Ben Vanik. All Rights Reserved.
{
  'default_configuration': 'Release',

  'variables': {
    'configurations': {
      'Debug': {
      },
      'Release': {
      },
    },

    'third_party_include_paths': [
      'third_party/npapi-sdk/',
      'third_party/sixense/include/',
      'third_party/oculus-sdk/LibOVR/Include',
    ],
    'conditions': [
      ['OS == "win"', {
        'third_party_lib_paths': [
          '../../third_party/sixense/lib/win32/release_dll/',
          '../../third_party/oculus-sdk/LibOVR/Lib/Win32',
        ],
        'third_party_libs': [
          'sixense.lib',
          'libovr.lib',
          'winmm.lib',
        ],
      }],
      ['OS == "mac"', {
        'third_party_lib_paths': [
          'third_party/oculus-sdk/LibOVR/Lib/MacOS/Debug',
        ],
        'third_party_libs': [
          'libovr.a',
        ],
      }],
    ],
  },

  'target_defaults': {
    'include_dirs': [
      'src/',
      '.',
    ],

    'defines': [
      '__STDC_LIMIT_MACROS=1',
      '__STDC_CONSTANT_MACROS=1',
      '_ISOC99_SOURCE=1',
    ],

    'cflags': [
      '-std=c99',
    ],

    'conditions': [
      ['OS == "win"', {
        'defines': [
          '_WIN32=1',
          'USE_SIXENSE=1',
          'XP_WIN=1',
        ],
      }],
      ['OS == "mac"', {
        'defines': [
          'XP_MACOSX=1',
        ],
      }],
    ],

    'configurations': {
      'common_base': {
        'abstract': 1,

        'msvs_configuration_platform': 'Win32',
        'msvs_configuration_attributes': {
          'OutputDirectory': '$(SolutionDir)$(ConfigurationName)',
          'IntermediateDirectory': '$(OutDir)\\obj\\$(ProjectName)',
          'CharacterSet': '1',
        },
        'msvs_disabled_warnings': [],
        'msvs_configuration_platform': 'Win32',
        'msvs_cygwin_shell': '0',
        'msvs_settings': {
          'VCCLCompilerTool': {
            #'MinimalRebuild': 'false',
            'BufferSecurityCheck': 'true',
            'EnableFunctionLevelLinking': 'true',
            'RuntimeTypeInfo': 'false',
            'WarningLevel': '3',
            #'WarnAsError': 'true',
            'DebugInformationFormat': '3',
            'ExceptionHandling': '1', # /EHsc
            'AdditionalOptions': [
              '/MP',
              '/TP', # Compile as C++
            ],
          },
          'VCLinkerTool': {
            'GenerateDebugInformation': 'true',
            #'LinkIncremental': '1', # 1 = NO, 2 = YES
            'AdditionalLibraryDirectories': [
              '<@(third_party_lib_paths)',
            ],
          },
        },

        'scons_settings': {
          'sconsbuild_dir': '<(DEPTH)/build/npvr/',
        },

        'xcode_settings': {
          'SYMROOT': '<(DEPTH)/build/npvr/',
          'ALWAYS_SEARCH_USER_PATHS': 'NO',
          'ARCHS': ['i386'],
          #'CLANG_CXX_LANGUAGE_STANDARD': 'c++0x',
          'COMBINE_HIDPI_IMAGES': 'YES',
          'GCC_C_LANGUAGE_STANDARD': 'gnu99',
          'GCC_SYMBOLS_PRIVATE_EXTERN': 'YES',
          'GCC_SYMBOLS_PRIVATE_EXTERN': 'YES',
          #'GCC_TREAT_WARNINGS_AS_ERRORS': 'YES',
          'GCC_ENABLE_CPP_RTTI': 'NO',
          'GCC_WARN_ABOUT_MISSING_NEWLINE': 'NO',
          'GCC_VERSION': 'com.apple.compilers.llvm.clang.1_0',
          'WARNING_CFLAGS': ['-Wall', '-Wendif-labels'],
          'LIBRARY_SEARCH_PATHS': [
            '<@(third_party_lib_paths)',
          ],
        },

        'defines': [
        ],
      },

      'Debug': {
        'inherit_from': ['common_base',],
        'defines': [
          'DEBUG',
        ],
        'msvs_configuration_attributes': {
          'OutputDirectory': '<(DEPTH)\\build\\npvr\\Debug',
        },
        'msvs_settings': {
          'VCCLCompilerTool': {
            'Optimization': '0',
            'BasicRuntimeChecks': '0',  # disable /RTC1 when compiling /O2
            'DebugInformationFormat': '3',
            'ExceptionHandling': '0',
            'RuntimeTypeInfo': 'false',
            'OmitFramePointers': 'false',
          },
          'VCLinkerTool': {
            'LinkIncremental': '2',
            'GenerateDebugInformation': 'true',
            'StackReserveSize': '2097152',
          },
        },
        'xcode_settings': {
          'GCC_OPTIMIZATION_LEVEL': '0',
        },
      },
      'Debug_x64': {
        'inherit_from': ['Debug',],
      },

      'Release': {
        'inherit_from': ['common_base',],
        'defines': [
          'RELEASE',
          'NDEBUG',
        ],
        'msvs_configuration_attributes': {
          'OutputDirectory': '<(DEPTH)\\build\\npvr\\Release',
        },
        'msvs_settings': {
          'VCCLCompilerTool': {
            'Optimization': '2',
            'InlineFunctionExpansion': '2',
            'EnableIntrinsicFunctions': 'true',
            'FavorSizeOrSpeed': '0',
            'ExceptionHandling': '0',
            'RuntimeTypeInfo': 'false',
            'OmitFramePointers': 'false',
            'StringPooling': 'true',
          },
          'VCLinkerTool': {
            'LinkIncremental': '1',
            'GenerateDebugInformation': 'true',
            'OptimizeReferences': '2',
            'EnableCOMDATFolding': '2',
            'StackReserveSize': '2097152',
          },
        },
      },
      'Release_x64': {
        'inherit_from': ['Release',],
      },
    },
  },

  'targets': [
    {
      'target_name': 'npvr',
      'product_name': 'npvr',
      'type': 'shared_library',

      'mac_bundle': 1,
      'xcode_settings': {
        'INFOPLIST_FILE': 'src/Info.plist',
      },
      'product_extension': 'plugin',

      'libraries': [
        '<@(third_party_libs)',
      ],
      'conditions': [
        ['OS != "win"', {
          'sources!': [
            'src/main_win.cpp',
          ],
        }],
        ['OS == "mac"', {
          'libraries': [
            '$(SDKROOT)/System/Library/Frameworks/CoreFoundation.framework',
            '$(SDKROOT)/System/Library/Frameworks/CoreGraphics.framework',
            '$(SDKROOT)/System/Library/Frameworks/IOKit.framework',
          ],
        }],
      ],

      'cflags': [
      ],

      'include_dirs': [
        '.',
        'src/',
        '<@(third_party_include_paths)'
      ],

      'sources': [
        'src/np_entry.cpp',
        'src/npn_gate.cpp',
        'src/npp_gate.cpp',
        'src/np_object_base.cpp',
        'src/np_object_base.h',

        'src/npvr.h',
        'src/npvr/plugin.cpp',
        'src/npvr/plugin.h',
        'src/npvr/vr_object.cpp',
        'src/npvr/vr_object.h',
        'src/npvr/ovr_manager.cpp',
        'src/npvr/ovr_manager.h',

        'src/main_win.cpp',

        'src/resource.h',
        'src/npvr.rc',
        'src/npvr.def',
      ],
    },
  ],
}
