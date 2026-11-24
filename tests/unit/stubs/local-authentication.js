const cfg = () => globalThis.__bio || { hardware: true, enrolled: true, types: [2] };
exports.AuthenticationType = { FINGERPRINT: 1, FACIAL_RECOGNITION: 2, IRIS: 3 };
exports.hasHardwareAsync = async () => cfg().hardware;
exports.isEnrolledAsync = async () => cfg().enrolled;
exports.supportedAuthenticationTypesAsync = async () => cfg().types;
