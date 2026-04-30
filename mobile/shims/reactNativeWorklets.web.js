const RuntimeKind = {
  ReactNative: 1,
  UI: 2,
  Worker: 3,
};

function identity(value) {
  return value;
}

module.exports = {
  __esModule: true,
  RuntimeKind,
  getRuntimeKind: () => RuntimeKind.ReactNative,
  isWorkletFunction: () => false,
  createSerializable: identity,
  isSerializableRef: () => false,
  makeShareable: identity,
  makeShareableCloneRecursive: identity,
  makeShareableCloneOnUIRecursive: identity,
  isShareableRef: () => false,
  createSynchronizable: identity,
  isSynchronizable: () => false,
  createWorkletRuntime: () => ({}),
  runOnRuntime: (_runtime, fn) => fn,
  runOnJS: fn => fn,
  runOnUI: fn => fn,
  runOnUIAsync: fn => fn,
  runOnUISync: fn => fn,
  scheduleOnRN: fn => fn,
  scheduleOnUI: fn => fn,
  executeOnUIRuntimeSync: fn => fn,
  callMicrotasks: () => {},
  unstable_eventLoopTask: () => {},
  getStaticFeatureFlag: () => false,
  setDynamicFeatureFlag: () => {},
  serializableMappingCache: new WeakMap(),
  shareableMappingCache: new WeakMap(),
  WorkletsModule: {},
};
