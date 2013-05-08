// NPVR TEST

#ifndef NPVR_H_
#define NPVR_H_

#ifdef _WIN32
#define _CRT_SECURE_NO_WARNINGS
#include <windows.h>
#endif  // WIN32

#include <third_party/npapi-sdk/npapi.h>
#include <third_party/npapi-sdk/npfunctions.h>
#include <third_party/npapi-sdk/npruntime.h>

#include <stdio.h>
#include <string.h>
#include <sstream>

extern NPNetscapeFuncs NPNFuncs;

#endif  // NPVR_H_
