extends RefCounted

# Semantic actions work with keyboard and standard mapped gamepads. Touch uses
# its own analog stick and the same gameplay callbacks, not fake key events.
static func configure() -> void:
	_action("move_left", [KEY_A, KEY_LEFT], JOY_AXIS_LEFT_X, -1.0)
	_action("move_right", [KEY_D, KEY_RIGHT], JOY_AXIS_LEFT_X, 1.0)
	_action("move_forward", [KEY_W, KEY_UP], JOY_AXIS_LEFT_Y, -1.0)
	_action("move_back", [KEY_S, KEY_DOWN], JOY_AXIS_LEFT_Y, 1.0)
	_action("camera_left", [KEY_Q], JOY_AXIS_RIGHT_X, -1.0)
	_action("camera_right", [KEY_E], JOY_AXIS_RIGHT_X, 1.0)
	_button("game_interact", [KEY_ENTER, KEY_SPACE], JOY_BUTTON_B)
	_button("game_punch", [KEY_J], JOY_BUTTON_X)
	_button("game_heavy", [KEY_L], JOY_BUTTON_Y)
	_button("game_kick", [KEY_I], JOY_BUTTON_A)
	_button("game_dodge", [KEY_K], JOY_BUTTON_B)
	_button("game_dialogue", [KEY_X], JOY_BUTTON_X)
	_button("game_map", [KEY_M], JOY_BUTTON_BACK)

static func _ensure(action: String) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action, 0.18)
	else:
		InputMap.action_erase_events(action)
		InputMap.action_set_deadzone(action, 0.18)

static func _add_keys(action: String, keys: Array) -> void:
	for code in keys:
		var event := InputEventKey.new()
		event.physical_keycode = code
		InputMap.action_add_event(action, event)

static func _action(action: String, keys: Array, axis: int, direction: float) -> void:
	_ensure(action)
	_add_keys(action, keys)
	var event := InputEventJoypadMotion.new()
	event.device = -1
	event.axis = axis
	event.axis_value = direction
	InputMap.action_add_event(action, event)

static func _button(action: String, keys: Array, button: int) -> void:
	_ensure(action)
	_add_keys(action, keys)
	var event := InputEventJoypadButton.new()
	event.device = -1
	event.button_index = button
	InputMap.action_add_event(action, event)
