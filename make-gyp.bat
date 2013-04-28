@echo off
call third_party\gyp\gyp.bat ^
      -f msvs ^
      -G msvs_version=2010 ^
      --depth=. ^
      --generator-output=build/vs2010/ ^
      npvr.gyp
call third_party\gyp\gyp.bat ^
      -f msvs ^
      -G msvs_version=2012 ^
      --depth=. ^
      --generator-output=build/vs2012/ ^
      npvr.gyp
