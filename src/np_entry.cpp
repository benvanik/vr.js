/* -*- Mode: C++; tab-width: 2; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* ***** BEGIN LICENSE BLOCK *****
 * Version: NPL 1.1/GPL 2.0/LGPL 2.1
 *
 * The contents of this file are subject to the Netscape Public License
 * Version 1.1 (the "License"); you may not use this file except in
 * compliance with the License. You may obtain a copy of the License at
 * http://www.mozilla.org/NPL/
 *
 * Software distributed under the License is distributed on an "AS IS" basis,
 * WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 * for the specific language governing rights and limitations under the
 * License.
 *
 * The Original Code is mozilla.org code.
 *
 * The Initial Developer of the Original Code is
 * Netscape Communications Corporation.
 * Portions created by the Initial Developer are Copyright (C) 1998
 * the Initial Developer. All Rights Reserved.
 *
 * Contributor(s):
 *
 * Alternatively, the contents of this file may be used under the terms of
 * either the GNU General Public License Version 2 or later (the "GPL"), or
 * the GNU Lesser General Public License Version 2.1 or later (the "LGPL"),
 * in which case the provisions of the GPL or the LGPL are applicable instead
 * of those above. If you wish to allow use of your version of this file only
 * under the terms of either the GPL or the LGPL, and not to allow others to
 * use your version of this file under the terms of the NPL, indicate your
 * decision by deleting the provisions above and replace them with the notice
 * and other provisions required by the GPL or the LGPL. If you do not delete
 * the provisions above, a recipient may use your version of this file under
 * the terms of any one of the NPL, the GPL or the LGPL.
 *
 * ***** END LICENSE BLOCK ***** */

//////////////////////////////////////////////////////////////
//
// Main plugin entry point implementation
//
#include <npvr.h>

#ifndef HIBYTE
#define HIBYTE(x) ((((uint32_t)(x)) & 0xff00) >> 8)
#endif

#ifdef XP_WIN
#define EXPORT
#else   // XP_WIN
#define EXPORT __attribute__((visibility("default"))) extern "C"
#endif  // XP_WIN

NPNetscapeFuncs NPNFuncs;

EXPORT NPError OSCALL NP_GetEntryPoints(NPPluginFuncs* pFuncs)
{
    if(pFuncs == NULL)
        return NPERR_INVALID_FUNCTABLE_ERROR;

    NPPluginFuncs ourFuncs;
    memset(&ourFuncs, 0, sizeof(ourFuncs));
    ourFuncs.size          = pFuncs->size;
    ourFuncs.version       = (NP_VERSION_MAJOR << 8) | NP_VERSION_MINOR;
    ourFuncs.newp          = NPP_New;
    ourFuncs.destroy       = NPP_Destroy;
    ourFuncs.setwindow     = NPP_SetWindow;
    ourFuncs.newstream     = NPP_NewStream;
    ourFuncs.destroystream = NPP_DestroyStream;
    ourFuncs.asfile        = NPP_StreamAsFile;
    ourFuncs.writeready    = NPP_WriteReady;
    ourFuncs.write         = NPP_Write;
    ourFuncs.print         = NPP_Print;
    ourFuncs.event         = NPP_HandleEvent;
    ourFuncs.urlnotify     = NPP_URLNotify;
    ourFuncs.getvalue      = NPP_GetValue;
    ourFuncs.setvalue      = NPP_SetValue;
    ourFuncs.javaClass     = NULL;
    memcpy(pFuncs, &ourFuncs, pFuncs->size);

    return NPERR_NO_ERROR;
}

char *NPP_GetMIMEDescription();

const char *
NP_GetMIMEDescription()
{
    return NPP_GetMIMEDescription();
}

NPError
NP_GetValue(void* future, NPPVariable variable, void *value)
{
    return NPP_GetValue((NPP_t *)future, variable, value);
}

#ifndef XP_UNIX
EXPORT NPError OSCALL NP_Initialize(NPNetscapeFuncs* pFuncs)
#else
EXPORT NPError OSCALL NP_Initialize(NPNetscapeFuncs* pFuncs, NPPluginFuncs* pluginFuncs)
#endif
{
    if(pFuncs == NULL)
        return NPERR_INVALID_FUNCTABLE_ERROR;

    if(HIBYTE(pFuncs->version) > NP_VERSION_MAJOR)
        return NPERR_INCOMPATIBLE_VERSION_ERROR;

    size_t ourSize = sizeof(NPNFuncs);
    size_t theirSize = pFuncs->size;
    size_t sizeToCopy = ourSize < theirSize ? ourSize : theirSize;
    memset(&NPNFuncs, 0, ourSize);
    memcpy(&NPNFuncs, pFuncs, sizeToCopy);

#ifdef XP_UNIX
    /*
    * Set up the plugin function table that Netscape will use to
    * call us.  Netscape needs to know about our version and size
    * and have a UniversalProcPointer for every function we
    * implement.
    */
    pluginFuncs->version    = (NP_VERSION_MAJOR << 8) + NP_VERSION_MINOR;
    pluginFuncs->size       = sizeof(NPPluginFuncs);
    pluginFuncs->newp       = NewNPP_NewProc(NPP_New);
    pluginFuncs->destroy    = NewNPP_DestroyProc(NPP_Destroy);
    pluginFuncs->setwindow  = NewNPP_SetWindowProc(NPP_SetWindow);
    pluginFuncs->newstream  = NewNPP_NewStreamProc(NPP_NewStream);
    pluginFuncs->destroystream = NewNPP_DestroyStreamProc(NPP_DestroyStream);
    pluginFuncs->asfile     = NewNPP_StreamAsFileProc(NPP_StreamAsFile);
    pluginFuncs->writeready = NewNPP_WriteReadyProc(NPP_WriteReady);
    pluginFuncs->write      = NewNPP_WriteProc(NPP_Write);
    pluginFuncs->print      = NewNPP_PrintProc(NPP_Print);
    pluginFuncs->urlnotify  = NewNPP_URLNotifyProc(NPP_URLNotify);
    pluginFuncs->event      = NULL;
    pluginFuncs->getvalue   = NewNPP_GetValueProc(NPP_GetValue);
#ifdef OJI
    pluginFuncs->javaClass  = NPP_GetJavaClass();
#endif

    NPP_Initialize();
#endif

    return NPERR_NO_ERROR;
}

EXPORT NPError OSCALL NP_Shutdown()
{
    return NPERR_NO_ERROR;
}
