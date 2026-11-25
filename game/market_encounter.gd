extends Node3D

# Provisional environmental storytelling and collector for the first encounter.
# The vehicle and character are temporary 3D assets, not final production art.
var van: Node3D
var collector: Node3D
var collector_label: Label3D

func _ready() -> void:
	van = Node3D.new()
	van.position = Vector3(3.2, 0, -9.6)
	add_child(van)
	_box(van, Vector3(1.75, 0.72, 3.8), Vector3(0, 0.65, 0), "777c7a")
	_box(van, Vector3(1.66, 0.78, 2.4), Vector3(0, 1.34, 0.45), "a4aaa4")
	_box(van, Vector3(1.58, 0.50, 0.045), Vector3(0, 1.32, -0.78), "253d48")
	_box(van, Vector3(1.75, 0.08, 2.35), Vector3(0, 1.78, 0.47), "304f68")
	_box(van, Vector3(1.79, 0.09, 0.13), Vector3(0, 0.38, 1.93), "31383b")
	_box(van, Vector3(0.32, 0.18, 0.03), Vector3(-0.60, 0.72, 1.93), "aa4e42", true)
	_box(van, Vector3(0.32, 0.18, 0.03), Vector3(0.60, 0.72, 1.93), "aa4e42", true)
	# A diagonal scratch makes the rear corner distinct from the other side.
	var dent := _box(van, Vector3(0.36, 0.04, 0.04), Vector3(0.59, 0.84, 1.93), "343c3c")
	dent.rotation.z = -0.35
	for x in [-0.88, 0.88]:
		for z in [-1.25, 1.20]:
			var tyre := MeshInstance3D.new()
			var mesh := CylinderMesh.new()
			mesh.top_radius = 0.35
			mesh.bottom_radius = 0.35
			mesh.height = 0.20
			tyre.mesh = mesh
			tyre.rotation.z = PI * 0.5
			tyre.position = Vector3(x, 0.35, z)
			var material := StandardMaterial3D.new()
			material.albedo_color = Color("20272a")
			material.roughness = 0.95
			tyre.material_override = material
			van.add_child(tyre)
	var clue := Label3D.new()
	clue.name = "VanMarker"
	clue.text = "DAMAGED VAN"
	clue.position.y = 2.3
	clue.modulate = Color("f0e5c8")
	clue.outline_size = 8
	clue.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	van.add_child(clue)
	collector = preload("res://character.gd").new()
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
