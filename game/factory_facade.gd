extends Node3D

# Select related pieces from the original modular glTF instead of displaying
# its entire laid-out parts library. The original 2K maps are retained.
func _ready() -> void:
	var scene := load("res://assets/realistic/modular_factory_facade/modular_factory_facade_2k.gltf") as PackedScene
	if scene == null:
		push_warning("Factory facade could not be loaded")
		return
	var source := scene.instantiate() as Node3D
	add_child(source)
	var pieces := ["wall_door_garage_door_01", "door_garage_door_01", "wall_window_centered_medium_01", "window_centered_medium_01"]
	for piece_name in pieces:
		var original := source.find_child(piece_name, true, false) as MeshInstance3D
		if original == null:
			push_warning("Factory module not found: " + piece_name)
			continue
		var piece := original.duplicate() as MeshInstance3D
		piece.name = "Facade_" + piece_name
		# The kit is laid out in a parts sheet; move its matching modules
		# into a facade with its floor at zero.
		piece.position = Vector3(3.0, 0.0 if piece_name.contains("garage") else 3.0, 0.0)
		add_child(piece)
		if piece_name.contains("centered_medium"):
			var second := piece.duplicate() as MeshInstance3D
			second.name = piece.name + "_second"
			second.position.x = 0.0
			add_child(second)
	remove_child(source)
	source.queue_free()
