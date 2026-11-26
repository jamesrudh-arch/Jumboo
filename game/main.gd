extends Node3D

# Identity-only build: the previous unapproved gameplay prototype was removed.
var shot: Node3D

func _ready() -> void:
	var world := WorldEnvironment.new()
	var environment := Environment.new()
	environment.background_mode = Environment.BG_COLOR
	environment.background_color = Color("10171d")
	environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.ambient_light_color = Color("8b9b9b")
	environment.ambient_light_energy = 0.7
	world.environment = environment
	add_child(world)
	shot = preload("res://studio_intro_3d.gd").new()
	add_child(shot)
	await get_tree().create_timer(3.7, false).timeout
	if is_instance_valid(shot):
		shot.reveal_title()
