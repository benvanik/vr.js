/**
 * Portions come from the Oculus SDK.
 * @author benvanik
 */


/**
 * Oculus Rift effect.
 * @param {!(THREE.CanvasRenderer|THREE.WebGLRenderer)} renderer Target.
 * @constructor
 */
THREE.OculusRiftEffect = function(renderer) {
  /**
   * Target renderer.
   * @type {!(THREE.CanvasRenderer|THREE.WebGLRenderer)}
   * @private
   */
  this.renderer_ = renderer;

  /**
   * Whether a real device is attached.
   * @type {boolean}
   * @private
   */
  this.present_ = false;

  /**
   * Device information about the Oculus Rift headset.
   * This will either be the default values (for testing) or the device values
   * once a device is attached.
   * @type {!vr.VROculusInfo}
   * @private
   */
  this.oculusInfo_ = new vr.VROculusInfo();

  /**
   * Stereo parameters.
   * @type {!THREE.OculusRiftEffect.StereoParams}
   * @private
   */
  this.stereoParams_ = new THREE.OculusRiftEffect.StereoParams();

  /**
   * Eye camera.
   * @type {!THREE.Camera}
   * @private
   */
  this.eyeCamera_ = new THREE.PerspectiveCamera();
  this.eyeCamera_.matrixAutoUpdate = false;
  this.eyeCamera_.target = new THREE.Vector3();

  /**
   * Orthographic scene used for compositing.
   * @type {!THREE.Scene}
   * @private
   */
  this.orthoScene_ = new THREE.Scene();

  /**
   * Orthographic camera used for compositing.
   * @type {!THREE.Camera}
   * @private
   */
  this.orthoCamera_ = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 1000);
  this.orthoCamera_.position.z = 1;
  this.orthoScene_.add(this.orthoCamera_);

  /**
   * Distortion shader material.
   * @type {!THREE.ShaderMaterial}
   * @private
   */
  this.distortionMaterial_ = new THREE.ShaderMaterial({
    uniforms: {
      'tex': {
        type: 't',
        value: null
      },
      'LensCenter': {
        type: 'v2',
        value: new THREE.Vector2(0, 0)
      },
      'ScreenCenter': {
        type: 'v2',
        value: new THREE.Vector2(0, 0)
      },
      'Scale': {
        type: 'v2',
        value: new THREE.Vector2(0, 0)
      },
      'ScaleIn': {
        type: 'v2',
        value: new THREE.Vector2(0, 0)
      },
      'HmdWarpParam': {
        type: 'v4',
        value: new THREE.Vector4(0, 0, 0, 0)
      }
    },
    vertexShader: [
      'varying vec2 v_uv;',
      'void main() {',
      '  v_uv = uv;',
      '  gl_Position =',
      //'     vec4((uv.xy * 2.0) - 1.0, 0.0, 1.0);' +
      '      projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform sampler2D tex;',
      'uniform vec2 LensCenter;',
      'uniform vec2 ScreenCenter;',
      'uniform vec2 Scale;',
      'uniform vec2 ScaleIn;',
      'uniform vec4 HmdWarpParam;',
      'varying vec2 v_uv;',
      'vec2 HmdWarp(vec2 texIn) {',
      '  vec2 theta = (texIn - LensCenter) * ScaleIn;',
      '  float rSq = theta.x * theta.x + theta.y * theta.y;',
      '  vec2 theta1 = theta * (HmdWarpParam.x + HmdWarpParam.y * rSq + ',
      '      HmdWarpParam.z * rSq * rSq + HmdWarpParam.w * rSq * rSq * rSq);',
      '  return LensCenter + Scale * theta1;',
      '}',
      'void main() {',
      '  vec2 tc = HmdWarp(v_uv);',
      '  if (any(notEqual(clamp(tc, ScreenCenter - vec2(0.25, 0.5), ',
      '      ScreenCenter + vec2(0.25, 0.5)) - tc, vec2(0.0, 0.0)))) {',
      '    gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0);',
      '  } else {',
      //'    gl_FragColor = vec4(0.0, tc.xy, 1.0);',
      '    gl_FragColor = texture2D(tex, tc);',
      '  }',
      '}'
    ].join('\n')
  });
  var mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2), this.distortionMaterial_);
  this.orthoScene_.add(mesh);

  /**
   * A render target the size of the display that will receive both eye views.
   * @type {THREE.WebGLRenderTarget}
   * @private
   */
  this.renderTarget_ = null;

  // Initialize the renderer (with defaults).
  this.init_();
};


/**
 * Eyes.
 */
THREE.OculusRiftEffect.Eye = {
  LEFT: 0,
  RIGHT: 1
};


/**
 * Initializes the scene for rendering.
 * This is called whenever the device changes.
 * @private
 */
THREE.OculusRiftEffect.prototype.init_ = function() {
  var info = this.oculusInfo_;

  this.renderer_.autoClear = false;
  this.renderer_.setSize(info.resolutionHorz, info.resolutionVert);

  this.renderTarget_ = new THREE.WebGLRenderTarget(
      info.resolutionHorz, info.resolutionVert, {
        minFilter: THREE.LinearFilter,
        magFilter: THREE.NearestFilter,
        format: THREE.RGBFormat
      });
  this.distortionMaterial_.uniforms['tex'].value = this.renderTarget_;

  this.distortionMaterial_.uniforms['HmdWarpParam'].value =
      new THREE.Vector4(
          info.distortionK[0], info.distortionK[1],
          info.distortionK[2], info.distortionK[3]);

  this.stereoParams_.update(info);
};


/**
 * Renders the scene to both eyes.
 * @param {!THREE.Scene} scene Three.js scene.
 * @param {!THREE.Camera} camera User camera. This is treated as the neck base.
 * @param {vr.VRState} vrstate VR state, if active.
 */
THREE.OculusRiftEffect.prototype.render = function(scene, camera, vrstate) {
  var nowPresent = vrstate ? vrstate.oculus.present : false;
  if (nowPresent != this.present_) {
    if (nowPresent) {
      // Connected.
      this.present_ = true;
      this.oculusInfo_ = vr.queryOculusInfo() || new vr.VROculusInfo();
      console.log('oculus detected');
      console.log(this.oculusInfo_);

      // Initialize the renderer/etc.
      this.init_();
    } else {
      // Disconnected.
      this.present_ = false;
    }
  }
  var info = this.oculusInfo_;

  // Prep camera.
  var eyeCamera = this.eyeCamera_;
  eyeCamera.fov = 80;
  eyeCamera.aspect = info.resolutionHorz / info.resolutionVert;
  eyeCamera.near = camera.near;
  eyeCamera.far = camera.far;
  eyeCamera.updateProjectionMatrix();

  // Grab camera matrix from user.
  // This is interpreted as the head base.
  if (camera.matrixAutoUpdate) {
    camera.updateMatrix();
  }
  eyeCamera.matrix.copy(camera.matrixWorld);
  eyeCamera.matrixWorldNeedsUpdate = true;

  /*
   * Simple head simulation:
   *
   *    Leye <--IPD--> Reye
   *             ^
   *             |
   *   baseToEyeX/baseToEyeY
   *             |
   *           base
   *
   */

  // Rotate by Oculus data.
  if (vrstate) {
    var quat = new THREE.Quaternion(
        vrstate.oculus.rotation[0],
        vrstate.oculus.rotation[1],
        vrstate.oculus.rotation[2],
        vrstate.oculus.rotation[3]);
    var rotMat = new THREE.Matrix4();
    rotMat.setRotationFromQuaternion(quat);
    //rotMat.rotateY(0);
    eyeCamera.matrix.multiply(rotMat);
  }

  // Shift around to the the eye center.

  // Prep scene.
  this.renderer_.setClearColorHex(0xFF0000, 1);
  this.renderer_.clear();

  // Render eyes.
  this.stereoParams_.update(info);
  var m = eyeCamera.matrix.clone();
  this.renderEye_(scene, THREE.OculusRiftEffect.Eye.LEFT, m);
  this.renderEye_(scene, THREE.OculusRiftEffect.Eye.RIGHT, m);
};


/**
 * Renders a single eye.
 * @param {!THREE.Scene} scene Three.js scene.
 * @param {THREE.OculusRiftEffect.Eye} eye Which eye.
 * @private
 */
THREE.OculusRiftEffect.prototype.renderEye_ = function(scene, eyeType, m) {
  var info = this.oculusInfo_;
  var eye =  this.stereoParams_.eyes[eyeType];

  var x, y, w, h;
  var sx, sy, sw, sh;
  switch (eyeType) {
    case THREE.OculusRiftEffect.Eye.LEFT:
      x = 0;
      y = 0;
      w = 0.5;
      h = 1.0;
      sx = 0;
      sy = 0;
      sw = info.resolutionHorz / 2;
      sh = info.resolutionVert;
      break;
    case THREE.OculusRiftEffect.Eye.RIGHT:
      x = 0.5;
      y = 0;
      w = 0.5;
      h = 1.0;
      sx = info.resolutionHorz / 2;
      sy = 0;
      sw = info.resolutionHorz / 2;
      sh = info.resolutionVert;
      break;
  }
  var aspect = w / h;
  var scale = 1 / this.stereoParams_.distortionScale;

  this.distortionMaterial_.uniforms['LensCenter'].value =
      new THREE.Vector2(x + (w + eye.distortionCenterOffsetX / 2) / 2, y + h / 2);
  this.distortionMaterial_.uniforms['ScreenCenter'].value =
      new THREE.Vector2(x + w / 2, y + h / 2);
  this.distortionMaterial_.uniforms['Scale'].value =
      new THREE.Vector2(w / 2 * scale, h / 2 * scale * aspect);
  this.distortionMaterial_.uniforms['ScaleIn'].value =
      new THREE.Vector2(2 / w, 2 / h / aspect);

  this.eyeCamera_.matrix.copy(m);
  this.eyeCamera_.matrixWorld.multiply(eye.viewAdjust);
  this.eyeCamera_.projectionMatrix = eye.projection;

  this.orthoCamera_.projectionMatrix = eye.orthoProjection;

  // Draw the scene to the render target.
  this.renderer_.setViewport(sx, sy, sw, sh);
  this.renderer_.render(scene, this.eyeCamera_, this.renderTarget_, true);

  // Draw the distorted eye.
  this.renderer_.setViewport(0, 0, info.resolutionHorz, info.resolutionVert);
  this.renderer_.enableScissorTest(true);
  this.renderer_.setScissor(sx, sy, sw, sh);
  this.renderer_.render(this.orthoScene_, this.orthoCamera_);
  this.renderer_.enableScissorTest(false);
};





THREE.OculusRiftEffect.EyeParams = function() {
  this.viewAdjust = new THREE.Matrix4();
  this.projection = new THREE.Matrix4();
  this.orthoProjection = new THREE.Matrix4();
  this.distortionCenterOffsetX = 0;
};

THREE.OculusRiftEffect.EyeParams.prototype.update = function(
    vofs, projection, orthoProjection, distortionCenterOffsetX) {
  this.viewAdjust.makeTranslation(vofs, 0, 0);
  this.projection = projection;
  this.orthoProjection = orthoProjection;
  this.distortionCenterOffsetX = distortionCenterOffsetX;
};

THREE.OculusRiftEffect.StereoParams = function() {
  this.distortionCenterOffsetX = 0;
  this.distortionCenterOffsetY = 0;
  this.distortionScale = 1;
  this.distortionFitX = -1;
  this.distortionFitY = 0;

  this.interpupillaryDistance = 0.064;

  this.projectionCenterOffset = 0;

  this.aspect = 1;
  this.fovY = 80 * Math.PI / 180;
  this.fovPixels = 0;
  this.orthoCenter = new THREE.Matrix4();
  this.orthoPixelOffset = 0;
  this.projCenter = new THREE.Matrix4();

  this.eyes = [
    new THREE.OculusRiftEffect.EyeParams(),
    new THREE.OculusRiftEffect.EyeParams()
  ];
};

THREE.OculusRiftEffect.StereoParams.prototype.update = function(info) {
  this.interpupillaryDistance = window.IPD;

  this.aspect = info.resolutionHorz / info.resolutionVert / 2;

  // updateDistortionOffsetAndScale
  var lensOffset = info.lensSeparationDistance / 2;
  var lensShift = info.screenSizeHorz / 4 - lensOffset;
  var lensViewportShift = 4 * lensShift / info.screenSizeHorz;
  this.distortionCenterOffsetX = lensViewportShift;
  if (Math.abs(this.distortionFitX) < 0.0001 &&
      Math.abs(this.distortionFitY) < 0.0001) {
    this.distortionScale = 1;
  } else {
    var stereoAspect = info.resolutionHorz / info.resolutionVert / 2;
    var dx = this.distortionFitX - this.distortionCenterOffsetX;
    var dy = this.distortionFitY / stereoAspect;
    var fitRadius = Math.sqrt(dx * dx + dy * dy);
    this.distortionScale = info.distort(fitRadius) / fitRadius;
  }

  // updateComputedState
  var percievedHalfRTDistance = info.screenSizeVert / 2 * this.distortionScale;
  this.fovY = 2 * Math.atan(percievedHalfRTDistance / info.eyeToScreenDistance);

  // updateProjectionOffset
  var viewCenter = info.screenSizeHorz / 4;
  var eyeProjectionShift = viewCenter - this.interpupillaryDistance / 2;
  this.projectionCenterOffset = 4 * eyeProjectionShift / info.screenSizeHorz;

  // update2D
  var eyeDistanceScreenPixels = (info.resolutionHorz / info.screenSizeHorz) * this.interpupillaryDistance;
  var offCenterShiftPixels = (info.eyeToScreenDistance / 0.8) * eyeDistanceScreenPixels;
  var leftPixelCenter = (info.resolutionHorz / 2) - eyeDistanceScreenPixels / 2;
  var rightPixelCenter = eyeDistanceScreenPixels / 2;
  var pixelDifference = leftPixelCenter - rightPixelCenter;
  var area2dfov = 85 * Math.PI / 180;
  var percievedHalfScreenDistance = Math.tan(area2dfov / 2) * info.eyeToScreenDistance;
  var vfovSize = 2.0 * percievedHalfScreenDistance / this.distortionScale;
  this.fovPixels = info.resolutionVert * vfovSize / info.screenSizeVert;
  this.orthoCenter.set(
      // this.fovPixels / (info.resolutionHorz / 2), 0, 0, 0,
      // 0, -this.fovPixels / info.resolutionVert, 0, 0,
      // 0, 0, 1, 0,
      // 0, 0, 0, 1);
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, 0, 1);
  var orthoPixelOffset = (pixelDifference + offCenterShiftPixels / this.distortionScale) / 2;
  this.orthoPixelOffset = orthoPixelOffset * 2 / this.fovPixels;

  // updateEyeParams

  this.projCenter.makePerspective(this.fovY / Math.PI * 180, this.aspect, 0.01, 1000);
  var projectionLeft = new THREE.Matrix4();
  // Matrix4f::Translation(ProjectionCenterOffset, 0, 0) * projCenter,
  projectionLeft.makeTranslation(this.projectionCenterOffset, 0, 0);
  projectionLeft.multiply(this.projCenter);
  var projectionRight = new THREE.Matrix4();
  // Matrix4f::Translation(-ProjectionCenterOffset, 0, 0) * projCenter;
  projectionRight.makeTranslation(-this.projectionCenterOffset, 0, 0);
  projectionRight.multiply(this.projCenter);

  var orthoLeft = this.orthoCenter.clone();
  //OrthoCenter * Matrix4f::Translation(OrthoPixelOffset, 0, 0),
  //orthoLeft.translate(new THREE.Vector3(this.orthoPixelOffset / this.fovPixels, 0, 0));
  var orthoRight = this.orthoCenter.clone();
  //OrthoCenter * Matrix4f::Translation(-OrthoPixelOffset, 0, 0),
  //orthoRight.translate(new THREE.Vector3(-this.orthoPixelOffset / this.fovPixels, 0, 0));

  this.eyes[0].update(
      this.interpupillaryDistance / 2,
      projectionLeft,
      orthoLeft,
      this.distortionCenterOffsetX);
  this.eyes[1].update(
      -this.interpupillaryDistance / 2,
      projectionRight,
      orthoRight,
      -this.distortionCenterOffsetX);
};
