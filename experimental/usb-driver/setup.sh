pushd `dirname $0` > /dev/null

cp ../../lib/vr.js demo/
cp ../../examples/rift_cube_demo.js demo/
cp ../../third_party/gl-matrix/gl-matrix.js demo/

popd > /dev/null
