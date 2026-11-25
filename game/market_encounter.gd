extends Node3D

# Provisional environmental storytelling and collector for the first encounter.
# The vehicle and character are temporary 3D assets, not final production art.
var van: Node3D
var collector: Node3D
var collector_label: Label3D
var van_body: StaticBody3D

func _ready() -> void:
	van = Node3D.new()
	van.position = Vector3(3.2, 0, -9.6)
	add_child(van)
	# Licensed, detailed passenger-van derivative replaces the primitive car.
	# It has no authored dent/tarp: that narrative clue still needs art.
	var model := (load("res://assets/vehicles/passenger_van.glb") as PackedScene).instantiate() as Node3D
	model.name = "PassengerVanModel"
	model.rotation.y = PI * 0.5
	van.add_child(model)
	van_body = StaticBody3D.new()
	van_body.position.y = 0.95
	var van_shape := CollisionShape3D.new()
	var box := BoxShape3D.new()
	box.size = Vector3(2.4, 1.9, 5.0)
	van_shape.shape = box
	van_body.add_child(van_shape)
	van.add_child(van_body)
	var clue := Label3D.new()
	clue.name = "VanMarker"
	clue.text = "DAMAGED VAN"
	clue.position.y = 2.6
	clue.modulate = Color("f0e5c8")
	clue.outline_size = 8
	clue.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	van.add_child(clue)
	collector = preload("res://character.gd").new()
	collector.model_path = "res://assets/characters/rocketbox/carlos_casual.glb"
	collector.coat_color = Color("55443a")
	collector.position = Vector3(1.0, 0, -7.4)
	add_child(collector)
	collector_label = Label3D.new()
	collector_label.position.y = 2.35
	collector_label.text = "COLLECTOR"
	collector_label.modulate = Color("efc3af")
	collector_label.outline_size = 8
	collector_label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	collector.add_child(collector_label)
	set_progress(1)

func set_progress(stage: int) -> void:
	van.visible = stage >= 2
	van_body.collision_layer = 1 if stage >= 2 else 0
	collector.visible = stage == 3

func _box(parent: Node3D, size: Vector3, pos: Vector3, hex: String, unlit := false) -> MeshInstance3D:
	var part := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	part.mesh = mesh
	part.position = pos
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(hex)
	mat.roughness = 0.78
	if unlit:
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	part.material_override = mat
	parent.add_child(part)
	return part
