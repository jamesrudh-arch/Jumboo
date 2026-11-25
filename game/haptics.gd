extends RefCounted

# Haptics are optional; iOS/Xogot and controller behavior require hardware QA.
static var enabled := true

static func pulse(duration_ms: int, weak: float = 0.25, strong: float = 0.12) -> void:
	if not enabled:
		return
	if OS.has_feature("mobile"):
		Input.vibrate_handheld(clampi(duration_ms, 1, 500))
	for device in Input.get_connected_joypads():
		Input.start_joy_vibration(device, clampf(weak, 0.0, 1.0), clampf(strong, 0.0, 1.0), clampf(float(duration_ms) / 1000.0, 0.01, 0.5))
