"use strict";

(function(global) {

/**
 * requestAnimationFrame, if supported.
 * Must be called on the global object.
 * @type {function(function())}
 */
global.requestAnimationFrame =
    global.requestAnimationFrame ||
    global.webkitRequestAnimationFrame ||
    global.mozRequestAnimationFrame ||
    global.oRequestAnimationFrame ||
    global.msRequestAnimationFrame ||
    null;


var tmpVec3 = vec3.create();
var tmpMat4 = mat4.create();


/**
 * WebGL program object.
 * Designed to support async compilation/linking.
 * When creating many programs first call {@see #beginLinking} on all of them
 * followed by a {@see #endLinking} on all of them.
 * @param {!WebGLRenderingContext} gl WebGL context.
 * @param {string} displayName Debug name.
 * @param {string} vertexShaderSource Vertex shader source.
 * @param {string} fragmentShaderSource Fragment shader source.
 * @param {!Array.<string>} attributeNames A list of attribute names.
 * @param {!Array.<string>} uniformNames A list of uniform names.
 * @constructor
 */
var Program = function(gl, displayName,
    vertexShaderSource, fragmentShaderSource,
    attributeNames, uniformNames) {
  /**
   * WebGL context.
   * @type {!WebGLRenderingContext}
   * @private
   */
  this.gl_ = gl;

  /**
   * Attribute names to locations.
   * @type {!Object.<number>}
   */
  this.attributes = {};
  for (var n = 0; n < attributeNames.length; n++) {
    this.attributes[attributeNames[n]] = -1;
  }

  /**
   * Uniform names to locations.
   * @type {!Object.<!WebGLUniformLocation>}
   */
  this.uniforms = {};
  for (var n = 0; n < uniformNames.length; n++) {
    this.uniforms[uniformNames[n]] = null;
  }

  /**
   * WebGL program object.
   * @type {!WebGLProgram}
   * @private
   */
  this.program_ = gl.createProgram();
  this.program_.displayName = displayName;

  // Create shaders and attach to program.
  // The program retains them and we no longer need them.
  var vertexShader = gl.createShader(gl.VERTEX_SHADER);
  vertexShader.displayName = displayName + ':VS';
  gl.shaderSource(vertexShader, vertexShaderSource);
  gl.attachShader(this.program_, vertexShader);
  var fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  fragmentShader.displayName = displayName + ':FS';
  gl.shaderSource(fragmentShader, fragmentShaderSource);
  gl.attachShader(this.program_, fragmentShader);
};


/**
 * Disposes the object.
 */
Program.prototype.dispose = function() {
  var gl = this.gl_;
  gl.deleteProgram(this.program_);
};


/**
 * Compiles the shaders and begins linking.
 * This must be followed by a call to {@see #endLinking}.
 * Shader/program errors will not be queried until then.
 */
Program.prototype.beginLinking = function() {
  var gl = this.gl_;
  var shaders = gl.getAttachedShaders(this.program_);
  for (var n = 0; n < shaders.length; n++) {
    gl.compileShader(shaders[n]);
  }
  gl.linkProgram(this.program_);
};


/**
 * Links the program and throws on any compile/link errors.
 */
Program.prototype.endLinking = function() {
  var gl = this.gl_;

  // Gather shader compilation errors/warnings.
  var shaders = gl.getAttachedShaders(this.program_);
  for (var n = 0; n < shaders.length; n++) {
    var shaderName = shaders[n].displayName;
    var shaderInfoLog = gl.getShaderInfoLog(shaders[n]);
    var compiled = !!gl.getShaderParameter(shaders[n], gl.COMPILE_STATUS);
    if (!compiled) {
      // Error.
      throw 'Shader ' + shaderName + ' compilation errors:\n' +
          shaderInfoLog;
    } else if (shaderInfoLog && shaderInfoLog.length) {
      // Warning.
      console.log('Shader ' + shaderName + ' compilation warnings:\n' +
          shaderInfoLog);
    }
  }

  // Gather link errors/warnings.
  var programName = this.program_.displayName;
  var programInfoLog = gl.getProgramInfoLog(this.program_);
  var linked = !!gl.getProgramParameter(this.program_, gl.LINK_STATUS);
  if (!linked) {
    // Error.
    throw 'Program ' + programName + ' link errors:\n' +
        programInfoLog;
  } else if (programInfoLog && programInfoLog.length) {
    // Warning.
    console.log('Program ' + programName + ' link warnings:\n' +
        programInfoLog);
  }

  // Grab attribute/uniform locations.
  for (var attribName in this.attributes) {
    this.attributes[attribName] =
        gl.getAttribLocation(this.program_, attribName);
  }
  for (var uniformName in this.uniforms) {
    this.uniforms[uniformName] =
        gl.getUniformLocation(this.program_, uniformName);
  }
};


/**
 * Uses the program on the current GL context.
 */
Program.prototype.use = function() {
  this.gl_.useProgram(this.program_);
};



/**
 * An eye.
 * Contains matrices used when rendering the viewport.
 * @param {number} left Left, in [0-1] view coordinates.
 * @param {number} top Top, in [0-1] view coordinates.
 * @param {number} width Width, in [0-1] view coordinates.
 * @param {number} height Height, in [0-1] view coordinates.
 * @constructor
 */
var StereoEye = function(left, top, width, height) {
  /**
   * 2D viewport used when compositing, in [0-1] view coordinates.
   * @type {!Array.<number>}
   */
  this.viewport = [left, top, width, height];

  /**
   * Eye-specific distortion center X.
   * @type {number}
   */
  this.distortionCenterOffsetX = 0;

  /**
   * Eye-specific distortion center Y.
   * @type {number}
   */
  this.distortionCenterOffsetY = 0;

  /**
   * Matrix used for drawing 3D things.
   * @type {!mat4}
   */
  this.projectionMatrix = mat4.create();

  /**
   * Translation to be applied to the view matrix.
   * @type {!mat4}
   */
  this.viewAdjustMatrix = mat4.create();

  /**
   * Matrix used for drawing 2D things, like HUDs.
   * @type {!mat4}
   */
  this.orthoProjectionMatrix = mat4.create();
};



/**
 * Stereo rendering parameters.
 * @constructor
 */
var StereoParams = function() {
  /**
   * Near plane Z.
   * @type {number}
   */
  this.near = 0.01;

  /**
   * Far plane Z.
   * @type {number}
   */
  this.far = 1000;

  /**
   * Scale by which the input render texture is scaled by to make the
   * post-distortion result fit the viewport.
   * @type {number}
   */
  this.distortionScale = 1;

  // Unknown.
  this.distortionFitX = -1;
  this.distortionFitY = 0;

  /**
   * Overridden IPD from the device.
   * Initialized to device value on startup.
   * @type {number}
   */
  this.interpupillaryDistance = 0.064;

  /**
   * Overridden eye to screen distance from device.
   * Initialized to device value on startup.
   * @type {number}
   */
  this.eyeToScreenDistance = 0.041;

  /**
   * Eyes.
   * Each eye contains the matrices and bounding data used when rendering.
   * @type {!Array.<!StereoEye>}
   */
  this.eyes = [
    new StereoEye(0, 0, 0.5, 1),
    new StereoEye(0.5, 0, 0.5, 1)
  ];
};


/**
 * Updates the stereo parameters with the given HMD data.
 * @param {!vr.VROculusInfo} info HMD info.
 */
StereoParams.prototype.update = function(info) {
  var aspect = info.resolutionHorz / info.resolutionVert / 2;

  // -- updateDistortionOffsetAndScale --

  var lensOffset = info.lensSeparationDistance / 2;
  var lensShift = info.screenSizeHorz / 4 - lensOffset;
  var lensViewportShift = 4 * lensShift / info.screenSizeHorz;
  var distortionCenterOffsetX = lensViewportShift;
  if (Math.abs(this.distortionFitX) < 0.0001 &&
      Math.abs(this.distortionFitY) < 0.0001) {
    this.distortionScale = 1;
  } else {
    var stereoAspect = info.resolutionHorz / info.resolutionVert / 2;
    var dx = this.distortionFitX - distortionCenterOffsetX;
    var dy = this.distortionFitY / stereoAspect;
    var fitRadius = Math.sqrt(dx * dx + dy * dy);
    this.distortionScale = info.distort(fitRadius) / fitRadius;
  }

  // -- updateComputedState --

  var percievedHalfRTDistance = info.screenSizeVert / 2 * this.distortionScale;
  var fovY = 2 * Math.atan(percievedHalfRTDistance / this.eyeToScreenDistance);

  // -- updateProjectionOffset --

  var viewCenter = info.screenSizeHorz / 4;
  var eyeProjectionShift = viewCenter - this.interpupillaryDistance / 2;
  var projectionCenterOffset = 4 * eyeProjectionShift / info.screenSizeHorz;

  // -- update2D --

  var eyeDistanceScreenPixels =
      (info.resolutionHorz / info.screenSizeHorz) * this.interpupillaryDistance;
  var offCenterShiftPixels =
      (this.eyeToScreenDistance / 0.8) * eyeDistanceScreenPixels;
  var leftPixelCenter = (info.resolutionHorz / 2) - eyeDistanceScreenPixels / 2;
  var rightPixelCenter = eyeDistanceScreenPixels / 2;
  var pixelDifference = leftPixelCenter - rightPixelCenter;
  var area2dfov = 85 * Math.PI / 180;
  var percievedHalfScreenDistance =
      Math.tan(area2dfov / 2) * this.eyeToScreenDistance;
  var vfovSize = 2.0 * percievedHalfScreenDistance / this.distortionScale;
  var fovPixels = info.resolutionVert * vfovSize / info.screenSizeVert;
  var orthoPixelOffset =
      (pixelDifference + offCenterShiftPixels / this.distortionScale) / 2;
  orthoPixelOffset = orthoPixelOffset * 2 / fovPixels;

  // -- updateEyeParams --

  this.eyes[0].distortionCenterOffsetX = distortionCenterOffsetX;
  this.eyes[0].distortionCenterOffsetY = 0;
  this.eyes[1].distortionCenterOffsetX = -distortionCenterOffsetX;
  this.eyes[1].distortionCenterOffsetY = 0;
  mat4.identity(this.eyes[0].viewAdjustMatrix);
  this.eyes[0].viewAdjustMatrix[12] = this.interpupillaryDistance / 2;
  mat4.identity(this.eyes[1].viewAdjustMatrix);
  this.eyes[1].viewAdjustMatrix[12] = -this.interpupillaryDistance / 2;

  mat4.perspective(tmpMat4, fovY, aspect, this.near, this.far);
  vec3.set(tmpVec3, projectionCenterOffset, 0, 0);
  mat4.translate(this.eyes[0].projectionMatrix, tmpMat4, tmpVec3);
  vec3.set(tmpVec3, -projectionCenterOffset, 0, 0);
  mat4.translate(this.eyes[1].projectionMatrix, tmpMat4, tmpVec3);

  var orthoLeft = this.eyes[0].orthoProjectionMatrix;
  mat4.identity(orthoLeft);
  orthoLeft[0] = fovPixels / (info.resolutionHorz / 2);
  orthoLeft[5] = -fovPixels / info.resolutionVert;
  vec3.set(tmpVec3, orthoPixelOffset, 0, 0);
  mat4.translate(orthoLeft, orthoLeft, tmpVec3);

  var orthoRight = this.eyes[1].orthoProjectionMatrix;
  mat4.identity(orthoRight);
  orthoRight[0] = fovPixels / (info.resolutionHorz / 2);
  orthoRight[5] = -fovPixels / info.resolutionVert;
  vec3.set(tmpVec3, -orthoPixelOffset, 0, 0);
  mat4.translate(orthoRight, orthoRight, tmpVec3);
};



/**
 * Stereo rendering controller.
 * Responsible for setting up stereo rendering and drawing the scene each frame.
 * @param {!WebGLRenderingContext} gl GL context.
 * @param {StereoRenderer.Attributes=} opt_attributes Render target attributes.
 * @constructor
 */
var StereoRenderer = function(gl, opt_attributes) {
  /**
   * WebGL context.
   * @type {!WebGLRenderingContext}
   * @private
   */
  this.gl_ = gl;

  /**
   * Render target attributes.
   * Values may be omitted.
   * @type {!StereoRenderer.Attributes}
   * @private
   */
  this.attributes_ = opt_attributes || {};

  /**
   * Whether the renderer has been initialized yet.
   * Invalid to draw if this is false.
   * @type {boolean}
   * @private
   */
  this.isInitialized_ = false;

  /**
   * Whether a real HMD is present.
   * @type {boolean}
   * @private
   */
  this.hmdPresent_ = false;

  /**
   * Current HMD info.
   * If no HMD is present this is set to the default info used for testing.
   * @type {!vr.VROculusInfo}
   * @private
   */
  this.hmdInfo_ = new vr.VROculusInfo();

  /**
   * 2D quad data buffer.
   * @type {!WebGLBuffer}
   * @private
   */
  this.quadBuffer_ = gl.createBuffer();
  this.quadBuffer_.displayName = 'StereoRendererQuad';
  var previousBuffer = gl.getParameter(gl.ARRAY_BUFFER_BINDING);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer_);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    0, 0, 0, 0, // TL   x-x
    1, 0, 1, 0, // TR   |/
    0, 1, 0, 1, // BL   x
    1, 0, 1, 0, // TR     x
    1, 1, 1, 1, // BR    /|
    0, 1, 0, 1  // BL   x-x
  ]), gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, previousBuffer);

  /**
   * Warp program.
   * Draws a single eye distored to a render target.
   * @type {!Program}
   * @private
   */
  this.warpProgram_ = new Program(gl, 'StereoRendererWarp',
      StereoRenderer.WARP_VERTEX_SOURCE_,
      StereoRenderer.WARP_FRAGMENT_SOURCE_,
      //StereoRenderer.STRAIGHT_FRAGMENT_SOURCE_,
      StereoRenderer.WARP_ATTRIBUTE_NAMES_, StereoRenderer.WARP_UNIFORM_NAMES_);

  /**
   * Whether all uniform values need to be updated for the program.
   * This is used to prevent some redundant uniform calls for values that don't
   * change frequently.
   * @type {boolean}
   * @private
   */
  this.updateAllUniforms_ = true;

  /**
   * Framebuffer used for drawing the scene.
   * Managed by {@see #initialize_}.
   * @type {!WebGLFramebuffer}
   * @private
   */
  this.framebuffer_ = gl.createFramebuffer();
  this.framebuffer_.displayName = 'StereoRendererFB';

  /**
   * Renderbuffers attached to the framebuffer, excluding the render texture.
   * Makes for easier cleanup.
   * @type {!Array.<!WebGLRenderbuffer>}
   * @private
   */
  this.framebufferAttachments_ = [];

  /**
   * Render texture used for drawing the scene.
   * Managed by {@see #initialize_}.
   * @type {!WebGLTexture}
   * @private
   */
  this.renderTexture_ = gl.createTexture();
  this.renderTexture_.displayName = 'StereoRendererRT';

  /**
   * Stereo parameters.
   * These may change at any time, and should be verified each update.
   * @type {!StereoParams}
   * @private
   */
  this.stereoParams_ = new StereoParams();

  // TODO(benvanik): all programs async.
  this.warpProgram_.beginLinking();
  this.warpProgram_.endLinking();
};


/**
 * Render target attributes.
 * @typedef {{
 *   alpha: boolean|undefined,
 *   depth: boolean|undefined,
 *   stencil: boolean|undefine
 * }}
 */
StereoRenderer.Attributes;


/**
 * Disposes the object.
 */
StereoRenderer.prototype.dispose = function() {
  var gl = this.gl_;
  for (var n = 0; n < this.framebufferAttachments_.length; n++) {
    gl.deleteRenderbuffer(this.framebufferAttachments_[n]);
  }
  gl.deleteTexture(this.renderTexture_);
  gl.deleteFramebuffer(this.framebuffer_);
  gl.deleteBuffer(this.quadBuffer_);
  this.warpProgram_.dispose();
};


/**
 * Initializes the renderer when the HMD changes.
 * @private
 */
StereoRenderer.prototype.initialize_ = function() {
  var gl = this.gl_;
  var info = this.hmdInfo_;

  // Reset stereo renderer params.
  this.stereoParams_.interpupillaryDistance = info.interpupillaryDistance;
  this.stereoParams_.eyeToScreenDistance = info.eyeToScreenDistance;

  // Resize canvas to HMD resolution.
  // Also ensure device pixel size is 1:1.
  gl.canvas.width = info.resolutionHorz;
  gl.canvas.height = info.resolutionVert;
  gl.canvas.style.width = canvas.width + 'px';
  gl.canvas.style.height = canvas.height + 'px';

  // Resize framebuffer and validate.
  this.setupRenderTarget_(info.resolutionHorz, info.resolutionVert);

  // Update program uniforms next render.
  this.updateAllUniforms_ = true;

  this.isInitialized_ = true;
};


/**
 * Sets up the render target for drawing the scene.
 * @param {number} width Render target width.
 * @param {number} height Render target height.
 * @private
 */
StereoRenderer.prototype.setupRenderTarget_ = function(width, height) {
  var gl = this.gl_;

  var previousFramebuffer = gl.getParameter(gl.FRAMEBUFFER_BINDING);
  var previousRenderbuffer = gl.getParameter(gl.RENDERBUFFER_BINDING);
  var previousTexture2d = gl.getParameter(gl.TEXTURE_BINDING_2D);

  gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer_);

  // Resize texture.
  gl.bindTexture(gl.TEXTURE_2D, this.renderTexture_);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texImage2D(gl.TEXTURE_2D, 0,
      this.attributes_.alpha ? gl.RGBA : gl.RGB,
      width, height, 0,
      this.attributes_.alpha ? gl.RGBA : gl.RGB,
      gl.UNSIGNED_BYTE, null);

  // Attach color texture.
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D,
      this.renderTexture_, 0);

  // Cleanup previous attachments.
  for (var n = 0; n < this.framebufferAttachments_.length; n++) {
    gl.deleteRenderbuffer(this.framebufferAttachments_[n]);
  }
  this.framebufferAttachments_ = [];

  // Setup depth/stencil textures.
  var depthBuffer = null;
  if (this.attributes_.depth) {
    depthBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, depthBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16,
        this.width, this.height);
    this.framebufferAttachments_.push(depthBuffer);
  }
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT,
      gl.RENDERBUFFER, null);
  var stencilBuffer = null;
  if (this.attributes_.depth) {
    stencilBuffer = gl.createRenderbuffer();
    gl.bindRenderbuffer(gl.RENDERBUFFER, stencilBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.STENCIL_INDEX8,
        this.width, this.height);
    this.framebufferAttachments_.push(stencilBuffer);
  }
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.STENCIL_ATTACHMENT,
      gl.RENDERBUFFER, null);

  // Verify.
  var status = gl.FRAMEBUFFER_COMPLETE;
  // TODO(benvanik): debug only.
  status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);

  gl.bindFramebuffer(gl.FRAMEBUFFER, previousFramebuffer);
  gl.bindRenderbuffer(gl.RENDERBUFFER, previousRenderbuffer);
  gl.bindTexture(gl.TEXTURE_2D, previousTexture2d);

  if (status != gl.FRAMEBUFFER_COMPLETE) {
    throw 'Invalid framebuffer: ' + status;
  }
};


/**
 * Gets the current interpupillary distance value.
 * @return {number} IPD value.
 */
StereoRenderer.prototype.getIPD = function() {
  return this.stereoParams_.interpupillaryDistance;
};


/**
 * Sets a new interpupillary distance value.
 * @param {number} value New IPD value.
 */
StereoRenderer.prototype.setIPD = function(value) {
  this.stereoParams_.interpupillaryDistance = value;
};


/**
 * Gets the current eye to screen distance value.
 * @return {number} Eye to screen distance value, in mm.
 */
StereoRenderer.prototype.getEyeToScreenDistance = function() {
  return this.stereoParams_.eyeToScreenDistance;
};


/**
 * Sets a new eye to screen distance value.
 * @param {number} value New eye to screen distance value, in mm.
 */
StereoRenderer.prototype.setEyeToScreenDistance = function(value) {
  this.stereoParams_.eyeToScreenDistance = value;
};


/**
 * Updates the stereo data and renders the scene.
 * The given callback is used to perform the render and may be called more than
 * once. It receives the width and height of the render target and the eye used
 * to render.
 * @param {function(this:T, number, number, !StereoEye)} callback Callback.
 * @param {T=} opt_scope Scope.
 * @template T
 */
StereoRenderer.prototype.render = function(vrstate, callback, opt_scope) {
  var gl = this.gl_;

  var nowPresent = vrstate.oculus.present;
  if (nowPresent != this.hmdPresent_) {
    this.hmdPresent_ = true;
    if (nowPresent) {
      // HMD connected! Query info.
      this.hmdInfo_ = vr.queryOculusInfo() || new vr.VROculusInfo();
      console.log('oculus detected');
    } else {
      // Disconnected. Reset to defaults.
      this.hmdInfo_ = new vr.VROculusInfo();
    }
    this.initialize_();
  }

  // Update stereo parameters based on VR state.
  this.stereoParams_.update(this.hmdInfo_);

  // Skip drawing if not ready.
  if (!this.isInitialized_) {
    return;
  }

  // Render.
  var eyes = this.stereoParams_.eyes;
  for (var n = 0; n < eyes.length; n++) {
    var eye = eyes[n];

    // Render to the render target.
    // The user will clear if needed.
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer_);
    var fullWidth = this.hmdInfo_.resolutionHorz;
    var fullHeight = this.hmdInfo_.resolutionVert;
    gl.viewport(
        eye.viewport[0] * fullWidth, eye.viewport[1] * fullHeight,
        eye.viewport[2] * fullWidth, eye.viewport[3] * fullHeight);
    callback.call(opt_scope, fullWidth, fullHeight, eye);
    gl.flush();

    // Distort to the screen.
    // TODO(benvanik): allow the user to specify a render target?
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    this.renderEye_(eye);
  }

  // User shouldn't be doing anything after this. Flush now.
  gl.flush();
};


/**
 * Renders the given eye to the target framebuffer with distortion.
 * @param {!StereoEye} eye Eye to render.
 * @private
 */
StereoRenderer.prototype.renderEye_ = function(eye) {
  var gl = this.gl_;

  // Source the input texture.
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, this.renderTexture_);

  this.warpProgram_.use();

  // Update all uniforms, if needed.
  if (this.updateAllUniforms_) {
    this.updateAllUniforms_ = false;
    gl.uniform1i(this.warpProgram_.uniforms['u_tex0'], 0);
    gl.uniform4fv(this.warpProgram_.uniforms['u_hmdWarpParam'],
        this.hmdInfo_.distortionK);
  }

  // Calculate eye uniforms for offset.
  var fullWidth = this.hmdInfo_.resolutionHorz;
  var fullHeight = this.hmdInfo_.resolutionVert;
  var x = eye.viewport[0];
  var y = eye.viewport[1];
  var w = eye.viewport[2];
  var h = eye.viewport[3];
  var aspect = (w * fullWidth) / (h * fullHeight);
  var scale = 1 / this.stereoParams_.distortionScale;

  // Texture matrix used to scale the input render target.
  mat4.identity(tmpMat4);
  tmpMat4[0] = w;
  tmpMat4[5] = h;
  tmpMat4[12] = x;
  tmpMat4[13] = y;
  gl.uniformMatrix4fv(this.warpProgram_.uniforms['u_texMatrix'], false,
      tmpMat4);

  gl.uniform2f(this.warpProgram_.uniforms['u_lensCenter'],
      x + (w + eye.distortionCenterOffsetX / 2) / 2, y + h / 2);
  gl.uniform2f(this.warpProgram_.uniforms['u_screenCenter'],
      x + w / 2, y + h / 2);
  gl.uniform2f(this.warpProgram_.uniforms['u_scale'],
      w / 2 * scale, h / 2 * scale * aspect);
  gl.uniform2f(this.warpProgram_.uniforms['u_scaleIn'],
      2 / w, 2 / h / aspect);

  // Viewport (in screen coordinates).
  gl.viewport(x * fullWidth, 0, w * fullWidth, fullHeight);

  // Setup attribs.
  var a_xy = this.warpProgram_.attributes.a_xy;
  var a_uv = this.warpProgram_.attributes.a_uv;
  gl.enableVertexAttribArray(a_xy);
  gl.enableVertexAttribArray(a_uv);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuffer_);
  gl.vertexAttribPointer(a_xy, 2, gl.FLOAT, false, 4 * 4, 0);
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 4 * 4, 2 * 4);

  // Draw the quad.
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // NOTE: the user must cleanup attributes themselves.
  gl.bindBuffer(gl.ARRAY_BUFFER, null);
  gl.bindTexture(gl.TEXTURE_2D, null);
};


/**
 * Attribute names for the warp program.
 * @type {!Array.<string>}
 * @private
 */
StereoRenderer.WARP_ATTRIBUTE_NAMES_ = [
  'a_xy', 'a_uv'
];


/**
 * Uniform names for the warp program.
 * @type {!Array.<string>}
 * @private
 */
StereoRenderer.WARP_UNIFORM_NAMES_ = [
  'u_texMatrix',
  'u_tex0',
  'u_lensCenter', 'u_screenCenter', 'u_scale', 'u_scaleIn', 'u_hmdWarpParam'
];


/**
 * Source code for the warp vertex shader.
 * @type {string}
 * @const
 * @private
 */
StereoRenderer.WARP_VERTEX_SOURCE_ = [
  'attribute vec2 a_xy;',
  'attribute vec2 a_uv;',
  'varying vec2 v_uv;',
  'uniform mat4 u_texMatrix;',
  'void main() {',
  '  gl_Position = vec4(2.0 * a_xy - 1.0, 0.0, 1.0);',
  '  v_uv = (u_texMatrix * vec4(a_uv, 0.0, 1.0)).xy;',
  '}'
].join('\n');


/**
 * Source code for the warp fragment shader.
 * @type {string}
 * @const
 * @private
 */
StereoRenderer.WARP_FRAGMENT_SOURCE_ = [
  'precision highp float;',
  'varying vec2 v_uv;',
  'uniform sampler2D u_tex0;',
  'uniform vec2 u_lensCenter;',
  'uniform vec2 u_screenCenter;',
  'uniform vec2 u_scale;',
  'uniform vec2 u_scaleIn;',
  'uniform vec4 u_hmdWarpParam;',
  'vec2 hmdWarp(vec2 texIn) {',
  '  vec2 theta = (texIn - u_lensCenter) * u_scaleIn;',
  '  float rSq = theta.x * theta.x + theta.y * theta.y;',
  '  vec2 theta1 = theta * (u_hmdWarpParam.x + u_hmdWarpParam.y * rSq + ',
  '      u_hmdWarpParam.z * rSq * rSq + u_hmdWarpParam.w * rSq * rSq * rSq);',
  '  return u_lensCenter + u_scale * theta1;',
  '}',
  'void main() {',
  '  vec2 tc = hmdWarp(v_uv);',
  '  if (any(notEqual(clamp(tc, u_screenCenter - vec2(0.25, 0.5), ',
  '      u_screenCenter + vec2(0.25, 0.5)) - tc, vec2(0.0, 0.0)))) {',
  '    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);',
  '  } else {',
  //'    gl_FragColor = vec4(0.0, tc.xy, 1.0);',
  '    gl_FragColor = texture2D(u_tex0, tc);',
  '  }',
  '}'
].join('\n');


/**
 * Source code for the warp fragment shader in debug mode.
 * This just passes the texture right through.
 * @type {string}
 * @const
 * @private
 */
StereoRenderer.STRAIGHT_FRAGMENT_SOURCE_ = [
  'precision highp float;',
  'varying vec2 v_uv;',
  'uniform sampler2D u_tex0;',
  'void main() {',
  '  gl_FragColor = texture2D(u_tex0, v_uv);',
  '}'
].join('\n');



/**
 * Simple camera.
 * @constructor
 */
var Camera = function() {
  /**
   * Movement speed, in m/s.
   * @type {number}
   */
  this.moveSpeed = 3;

  /**
   * Current eye position.
   * @type {!vec3}
   */
  this.eyePosition = vec3.fromValues(0, 0, 0);

  /**
   * Yaw.
   * @type {number}
   */
  this.eyeYaw = 0;

  /**
   * Pitch.
   * @type {number}
   */
  this.eyePitch = 0;

  /**
   * Roll.
   * @type {number}
   */
  this.eyeRoll = 0;

  /**
   * Previous yaw reading to support delta.
   * @type {number}
   * @private
   */
  this.lastSensorYaw_ = 0;

  /**
   * View matrix.
   * @type {!mat4}
   */
  this.viewMatrix = mat4.create();
};


/**
 * Updates the camera based on the current state.
 * @param {number} time Current time.
 * @param {number} timeDelta time since last frame.
 * @param {!vr.VRState} vrstate Current vr state.
 */
Camera.prototype.update = function(time, timeDelta, vrstate) {
  // Read sensor data, if present.
  var rollPitchYaw = mat4.create();
  if (vrstate.oculus.present) {
    // TODO(benvanik): real work
    mat4.fromQuat(rollPitchYaw, vrstate.oculus.rotation);
  } else {
    mat4.identity(rollPitchYaw);
  }

  // Simple head modeling from tiny world demo.
  var HEAD_BASE_TO_EYE_HEIGHT = 0.15;
  var HEAD_BASE_TO_EYE_PROTRUSION = 0.09;
  var EYE_CENTER_IN_HEAD_FRAME =
      vec3.fromValues(0, HEAD_BASE_TO_EYE_HEIGHT, -HEAD_BASE_TO_EYE_PROTRUSION);
  vec3.transformMat4(tmpVec3, EYE_CENTER_IN_HEAD_FRAME, rollPitchYaw);
  var shiftedEyePosition = vec3.create();
  vec3.add(shiftedEyePosition, this.eyePosition, tmpVec3);
  shiftedEyePosition[1] -= EYE_CENTER_IN_HEAD_FRAME[1];

  var UP = vec3.fromValues(0, 1, 0);
  var FORWARD = vec3.fromValues(0, 0, -1);

  var up = vec3.create();
  var forward = vec3.create();
  vec3.transformMat4(up, UP, rollPitchYaw);
  vec3.transformMat4(forward, FORWARD, rollPitchYaw);
  var targetPosition = vec3.create();
  vec3.add(targetPosition, shiftedEyePosition, forward);
  mat4.lookAt(this.viewMatrix, shiftedEyePosition, targetPosition, up);
};



/**
 * Demo app.
 * @param {!Element} statusEl Element that will get status text.
 * @param {!HTMLCanvasElement} canvas Target render canvas.
 * @constructor
 */
var Demo = function(statusEl, canvas) {
  /**
   * Element that will get status text.
   * @type {!Element}
   * @private
   */
  this.statusEl_ = statusEl;

  /**
   * Target canvas.
   * @type {!HTMLCanvasElement}
   * @private
   */
  this.canvas_ = canvas;

  /**
   * WebGL context.
   * @type {!WebGLRenderingContext}
   * @private
   */
  this.gl_ = this.createWebGL_(canvas);
  var gl = this.gl_;

  /**
   * Camera.
   * @type {!Camera}
   * @private
   */
  this.camera_ = new Camera();

  /**
   * Stereo renderer.
   * @type {!StereoRenderer}
   * @private
   */
  this.stereoRenderer_ = new StereoRenderer(this.gl_, {
    alpha: false,
    depth: true,
    stencil: false
  });

  /**
   * VR state.
   * @type {!vr.VRState}
   * @private
   */
  this.vrstate_ = vr.createState();

  /**
   * Time of the previous tick.
   * Used to calculate frame deltas for animation.
   * @type {number}
   * @private
   */
  this.lastTick_ = 0;

  this.cubeProgram_ = new Program(gl, 'CubeProgram',
      [
        'attribute vec3 a_xyz;',
        'attribute vec2 a_uv;',
        'varying vec2 v_uv;',
        'uniform mat4 u_projectionMatrix;',
        'uniform mat4 u_modelViewMatrix;',
        'void main() {',
        '  gl_Position = u_projectionMatrix * u_modelViewMatrix * ',
        '      vec4(a_xyz, 1.0);',
        '  v_uv = a_uv;',
        '}'
      ].join('\n'),
      [
        'precision highp float;',
        'varying vec2 v_uv;',
        'void main() {',
        '  gl_FragColor = vec4(v_uv, 0.0, 1.0);',
        '}'
      ].join('\n'),
      ['a_xyz', 'a_uv'],
      ['u_projectionMatrix', 'u_modelViewMatrix']);
  this.cubeProgram_.beginLinking();
  this.cubeProgram_.endLinking();
  this.cubeBuffer_ = gl.createBuffer();
  this.cubeBuffer_.displayName = 'CubeVertexBuffer';
  gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffer_);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
    -1.0, -1.0,  1.0, 0.0, 0.0, // Front face
     1.0, -1.0,  1.0, 1.0, 0.0,
     1.0,  1.0,  1.0, 1.0, 1.0,
    -1.0,  1.0,  1.0, 0.0, 1.0,
    -1.0, -1.0, -1.0, 1.0, 0.0, // Back face
    -1.0,  1.0, -1.0, 1.0, 1.0,
     1.0,  1.0, -1.0, 0.0, 1.0,
     1.0, -1.0, -1.0, 0.0, 0.0,
    -1.0,  1.0, -1.0, 0.0, 1.0, // Top face
    -1.0,  1.0,  1.0, 0.0, 0.0,
     1.0,  1.0,  1.0, 1.0, 0.0,
     1.0,  1.0, -1.0, 1.0, 1.0,
    -1.0, -1.0, -1.0, 1.0, 1.0, // Bottom face
     1.0, -1.0, -1.0, 0.0, 1.0,
     1.0, -1.0,  1.0, 0.0, 0.0,
    -1.0, -1.0,  1.0, 1.0, 0.0,
     1.0, -1.0, -1.0, 1.0, 0.0, // Right face
     1.0,  1.0, -1.0, 1.0, 1.0,
     1.0,  1.0,  1.0, 0.0, 1.0,
     1.0, -1.0,  1.0, 0.0, 0.0,
    -1.0, -1.0, -1.0, 0.0, 0.0, // Left face
    -1.0, -1.0,  1.0, 1.0, 0.0,
    -1.0,  1.0,  1.0, 1.0, 1.0,
    -1.0,  1.0, -1.0, 0.0, 1.0,
  ]), gl.STATIC_DRAW);
  this.cubeIndexBuffer_ = gl.createBuffer();
  this.cubeIndexBuffer_.displayName = 'CubeIndexBuffer';
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeIndexBuffer_);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array([
    0, 1, 2,      0, 2, 3,    // Front face
    4, 5, 6,      4, 6, 7,    // Back face
    8, 9, 10,     8, 10, 11,  // Top face
    12, 13, 14,   12, 14, 15, // Bottom face
    16, 17, 18,   16, 18, 19, // Right face
    20, 21, 22,   20, 22, 23  // Left face
  ]), gl.STATIC_DRAW);

  // Common key handlers.
  var self = this;
  document.addEventListener('keydown', function(e) {
    if (self.keyPressed_(e)) {
      e.preventDefault();
    }
  }, false);

  // Kickoff the demo.
  this.tick_();
};


/**
 * Attempts to create a new WebGL context.
 * An error will be thrown if the context cannot be created.
 * @param {!HTMLCanvasElement} canvas Target canvas.
 * @return {!WebGLRenderingContext} New context.
 * @private
 */
Demo.prototype.createWebGL_ = function(canvas) {
  if (!global.WebGLRenderingContext) {
    throw 'WebGL not supported by this browser.';
  }

  var attributes = {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false, // need to use custom antialiasing
    premultipliedAlpha: true,
    preserveDrawingBuffer: false
  };

  var names = ['webgl', 'experimental-webgl'];
  var gl = null;
  for (var n = 0; n < names.length; n++) {
    gl = canvas.getContext(names[n], attributes);
    if (gl) {
      break;
    }
  }
  if (!gl) {
    throw 'Unable to get a WebGL context.';
  }

  // TODO(benvanik): extra setup? context loss? etc?

  return gl;
};


/**
 * Updates the status message.
 * @param {string?} value New value, if any.
 */
Demo.prototype.setStatus = function(value) {
  this.statusEl_.innerHTML = value || '';
};


/**
 * Handles key press events.
 * @param {!Event} e Browser event.
 * @return {boolean} Whether the key press was handled.
 * @private
 */
Demo.prototype.keyPressed_ = function(e) {
  switch (e.keyCode) {
    case 32: // space
      // Reset sensors to their default state.
      vr.resetOculusOrientation();
      return true;

    case 70: // f
      // Toggle fullscreen mode.
      if (!vr.isFullScreen()) {
        vr.beginFullScreen();
      } else {
        vr.exitFullScreen();
      }
      return true;

    case 78: // n
      var ipd = this.stereoRenderer_.getIPD();
      ipd -= 0.001;
      this.stereoRenderer_.setIPD(ipd);
      this.setStatus('ipd: ' + ipd);
      break;
    case 77: // m
      var ipd = this.stereoRenderer_.getIPD();
      ipd += 0.001;
      this.stereoRenderer_.setIPD(ipd);
      this.setStatus('ipd: ' + ipd);
      break;

    case 86: // v
      var eyeToScreenDistance = this.stereoRenderer_.getEyeToScreenDistance();
      eyeToScreenDistance -= 0.0001;
      this.stereoRenderer_.setEyeToScreenDistance(eyeToScreenDistance);
      this.setStatus('eyeToScreenDistance: ' + eyeToScreenDistance);
      break;
    case 66: // b
      var eyeToScreenDistance = this.stereoRenderer_.getEyeToScreenDistance();
      eyeToScreenDistance += 0.0001;
      this.stereoRenderer_.setEyeToScreenDistance(eyeToScreenDistance);
      this.setStatus('eyeToScreenDistance: ' + eyeToScreenDistance);
      break;
  }
  return false;
};


/**
 * Processes a single frame.
 * @private
 */
Demo.prototype.tick_ = function() {
  // Schedule the next frame.
  var self = this;
  global.requestAnimationFrame(function() {
    self.tick_();
  });

  // Poll VR, if it's ready.
  if (vr.isReady) {
    vr.poll(this.vrstate_);
  }

  // TODO(benvanik): now(), if possible.
  var time = Date.now();
  var timeDelta = this.lastTick_ ? time - this.lastTick_ : 0;
  this.lastTick_ = time;

  // Update scene animation/etc.
  // This should all happen once, where {@see #renderScene_} may be called
  // multiple times.
  this.updateScene_(time, timeDelta);

  // Update the stereo renderer.
  this.stereoRenderer_.render(this.vrstate_, this.renderScene_, this);
};


/**
 * Updates the scene.
 * This will only be called once per frame.
 * @param {number} time Current time.
 * @param {number} timeDelta time since last frame.
 * @private
 */
Demo.prototype.updateScene_ = function(time, timeDelta) {
  // Update camera.
  // TODO(benvanik): plumb keyboard input down.
  this.camera_.update(time, timeDelta, this.vrstate_);

  // TODO(benvanik): animate scene.
};


/**
 * Renders the entire scene.
 * This may be called multiple times per frame.
 * @param {number} width Render target width.
 * @param {number} height Render target height.
 * @param {!StereoEye} eye Eye being rendered.
 * @private
 */
Demo.prototype.renderScene_ = function(width, height, eye) {
  var gl = this.gl_;

  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  this.cubeProgram_.use();

  var modelViewMatrix = mat4.create();
  mat4.identity(modelViewMatrix);
  vec3.set(tmpVec3, 50, 25, 50);
  mat4.scale(modelViewMatrix, modelViewMatrix, tmpVec3);
  mat4.multiply(modelViewMatrix, modelViewMatrix, this.camera_.viewMatrix);
  mat4.multiply(modelViewMatrix, modelViewMatrix, eye.viewAdjustMatrix);

  gl.uniformMatrix4fv(this.cubeProgram_.uniforms['u_projectionMatrix'], false,
      eye.projectionMatrix);
  gl.uniformMatrix4fv(this.cubeProgram_.uniforms['u_modelViewMatrix'], false,
      modelViewMatrix);

  var a_xyz = this.cubeProgram_.attributes['a_xyz'];
  var a_uv = this.cubeProgram_.attributes['a_uv'];
  gl.enableVertexAttribArray(a_xyz);
  gl.enableVertexAttribArray(a_uv);
  gl.bindBuffer(gl.ARRAY_BUFFER, this.cubeBuffer_);
  gl.vertexAttribPointer(a_xyz, 3, gl.FLOAT, false, (3 + 2) * 4, 0);
  gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, (3 + 2) * 4, 3 * 4);
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.cubeIndexBuffer_);
  gl.drawElements(gl.TRIANGLES, 36, gl.UNSIGNED_SHORT, 0);
};


/**
 * Launches the demo.
 * @param {!Element} statusEl Element that will get status text.
 * @param {!HTMLCanvasElement} canvas Target render canvas.
 * @return {Object} Demo object, useful for debugging only.
 */
global.launchDemo = function(statusEl, canvas) {
  try {
    return new Demo(statusEl, canvas);
  } catch (e) {
    statusEl.innerText = e.toString();
    console.log(e);
    return null;
  }
};

})(window);

