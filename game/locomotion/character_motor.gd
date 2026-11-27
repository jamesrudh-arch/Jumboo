extends CharacterBody3D
## Camera-relative grounded movement for the player character. A scene must
## provide a collision shape and a camera; this component is not a level.

signal movement_updated(horizontal_velocity: Vector3, desired_direction: Vector3)

@export_range(0.1, 10.0, 0.1) var walk_speed := 1.4
@export_range(0.1, 50.0, 0.1) var acceleration := 8.0
@export_range(0.1, 50.0, 0.1) var deceleration := 12.0
@export_range(0.0, 1.0, 0.01) var input_deadzone := 0.12
@export var movement_camera: Camera3D
@export var keyboard_enabled := true
var touch_vector := Vector2.ZERO
var control_enabled := true:
	set(enabled):
		control_enabled = enabled
		if not enabled:
			touch_vector = Vector2.ZERO

# The caller owns the touch pointer and must reset this when released or
# canceled. Clamp so diagonal or malformed inputs never exceed full speed.
func set_touch_vector(value: Vector2) -> void:
	if not control_enabled or not is_finite(value.x) or not is_finite(value.y):
		touch_vector = Vector2.ZERO
		return
	touch_vector = value.limit_length(1.0)

func clear_input() -> void:
	touch_vector = Vector2.ZERO

func _physics_process(delta: float) -> void:
	var input := Vector2.ZERO
	if control_enabled:
		input = touch_vector
		if keyboard_enabled:
			input = (input + Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down")).limit_length(1.0)
	var strength := input.length()
	if strength <= input_deadzone:
		input = Vector2.ZERO
	else:
		# Remap the deadzone to retain a continuous analog range.
		var remapped := (strength - input_deadzone) / maxf(1.0 - input_deadzone, 0.001)
		input = input.normalized() * clampf(remapped, 0.0, 1.0)
	var direction := camera_relative(input, movement_camera)
	var target := direction * walk_speed
	var rate := acceleration if input != Vector2.ZERO else deceleration
	var horizontal := Vector2(velocity.x, velocity.z).move_toward(Vector2(target.x, target.z), rate * delta)
	velocity.x = horizontal.x
	velocity.z = horizontal.y
	if not is_on_floor():
		velocity.y -= float(ProjectSettings.get_setting("physics/3d/default_gravity", 9.8)) * delta
	elif velocity.y <= 0.0:
		velocity.y = -0.1
	move_and_slide()
	movement_updated.emit(Vector3(velocity.x, 0.0, velocity.z), direction)

# A camera's up/down pitch must not inject vertical motion or reduce speed.
static func camera_relative(input: Vector2, camera: Camera3D) -> Vector3:
	var yaw := 0.0
	if is_instance_valid(camera):
		var forward := -camera.global_basis.z
		forward.y = 0.0
		if forward.length_squared() > 0.000001:
			yaw = atan2(-forward.x, -forward.z)
	var local := Vector3(input.x, 0.0, input.y)
	return local.rotated(Vector3.UP, yaw)
