extends Node3D

# Original 3D studio and game-title presentation. TextMesh produces extruded
# geometry, rather than a flat title card. See Godot's 3D-text documentation.
var camera: Camera3D
var studio_group: Node3D
var title_group: Node3D
var city_text: MeshInstance3D
var key_light: OmniLight3D
var emblem_ring: Node3D
var timer := 0.0
var phase := "studio"

func _ready() -> void:
	var bg := MeshInstance3D.new()
	var bg_mesh := BoxMesh.new()
	bg_mesh.size = Vector3(30, 18, 0.12)
	bg.mesh = bg_mesh
	bg.position = Vector3(0, 0, -1.1)
	var bg_material := StandardMaterial3D.new()
	bg_material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bg_material.albedo_color = Color("080d14")
	bg.material_override = bg_material
	add_child(bg)
	var silver := StandardMaterial3D.new()
	silver.albedo_color = Color("c6d6d5")
	silver.metallic = 0.68
	silver.roughness = 0.29
	var cyan := StandardMaterial3D.new()
	cyan.albedo_color = Color("8ce7e3")
	cyan.metallic = 0.32
	cyan.roughness = 0.28
	cyan.emission_enabled = true
	cyan.emission = Color("4aa9a7")
	cyan.emission_energy_multiplier = 0.28
	studio_group = Node3D.new()
	add_child(studio_group)
	# Machined outer signature: actual 3D concentric rings and index marks,
	# placed behind the extruded monogram instead of a flat overlay.
	emblem_ring = Node3D.new()
	emblem_ring.position = Vector3(0, 1.12, -0.16)
	studio_group.add_child(emblem_ring)
	_ring(emblem_ring, 1.22, 1.17, silver)
	_ring(emblem_ring, 1.11, 1.09, cyan)
	var backing := MeshInstance3D.new()
	var disk := CylinderMesh.new()
	disk.top_radius = 1.07
	disk.bottom_radius = 1.07
	disk.height = 0.18
	backing.mesh = disk
	backing.rotation.x = PI * 0.5
	backing.position.z = -0.18
	var gunmetal := StandardMaterial3D.new()
	gunmetal.albedo_color = Color("263943")
	gunmetal.metallic = 0.72
	gunmetal.roughness = 0.36
	backing.material_override = gunmetal
	emblem_ring.add_child(backing)
	for i in 12:
		var angle := TAU * float(i) / 12.0
		var tick := Node3D.new()
		tick.rotation.z = angle
		emblem_ring.add_child(tick)
		_bar(tick, Vector3(0, 1.145, 0), Vector3(0.025, 0.085, 0.04), silver)
	_make_text(studio_group, "DY", 1.1, 1.65, 0.30, silver)
	_make_text(studio_group, "D’YOUNGS GAMES", -0.27, 4.9, 0.20, silver)
	_make_text(studio_group, "P R E S E N T S", -0.85, 2.25, 0.025, cyan)
	_bar(studio_group, Vector3(-1.0, 0.35, 0.03), Vector3(1.9, 0.025, 0.06), cyan)
	_bar(studio_group, Vector3(1.0, 0.35, 0.03), Vector3(1.9, 0.025, 0.06), cyan)
	title_group = Node3D.new()
	add_child(title_group)
	_make_text(title_group, "LEVERAGE", 0.55, 6.1, 0.40, silver)
	city_text = _make_text(title_group, "C I N D E R   C I T Y", -0.45, 4.4, 0.07, cyan)
	_make_text(title_group, "EVERYONE HAS LEVERAGE ON YOU.", -1.02, 3.6, 0.025, silver)
	title_group.hide()
	key_light = OmniLight3D.new()
	key_light.position = Vector3(-3, 2.4, 3)
	key_light.light_color = Color("d7f6f2")
	key_light.light_energy = 2.5
	key_light.omni_range = 14
	add_child(key_light)
	var rim := OmniLight3D.new()
	rim.position = Vector3(3.8, -1.0, 2.2)
	rim.light_color = Color("6dd5dc")
	rim.light_energy = 1.8
	rim.omni_range = 13
	add_child(rim)
	camera = Camera3D.new()
	camera.position = Vector3(0, 0.15, 9.3)
	camera.fov = 36
	add_child(camera)
	camera.look_at(global_position + Vector3(0, 0.1, 0), Vector3.UP)
	camera.make_current()
	var ident := AudioStreamPlayer.new()
	ident.stream = load("res://assets/studio_ident.wav")
	ident.volume_db = -8.0
	add_child(ident)
	ident.play()

func _make_text(parent: Node3D, text: String, y: float, width: float, depth: float, material: Material) -> MeshInstance3D:
	var geometry := TextMesh.new()
	geometry.font = load("res://assets/fonts/BebasNeue-Regular.ttf")
	geometry.font_size = 48
	geometry.pixel_size = 0.01
	geometry.depth = depth
	geometry.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	geometry.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	geometry.text = text
	var instance := MeshInstance3D.new()
	instance.mesh = geometry
	instance.material_override = material
	parent.add_child(instance)
	var actual_width := geometry.get_aabb().size.x
	if actual_width > 0.0:
		var factor := width / actual_width
		instance.scale = Vector3(factor, factor, 1.0)
	instance.position.y = y
	return instance

func _ring(parent: Node3D, outer: float, inner: float, material: Material) -> void:
	var mesh := TorusMesh.new()
	mesh.outer_radius = outer
	mesh.inner_radius = inner
	mesh.rings = 48
	mesh.ring_segments = 8
	var part := MeshInstance3D.new()
	part.mesh = mesh
	part.rotation.x = PI * 0.5
	part.material_override = material
	parent.add_child(part)

func _bar(parent: Node3D, pos: Vector3, size: Vector3, material: Material) -> void:
	var mesh := BoxMesh.new()
	mesh.size = size
	var piece := MeshInstance3D.new()
	piece.mesh = mesh
	piece.material_override = material
	piece.position = pos
	parent.add_child(piece)

func reveal_title() -> void:
	phase = "title"
	timer = 0.0
	studio_group.hide()
	title_group.show()
	city_text.hide()

func _process(delta: float) -> void:
	timer += delta
	var reveal := smoothstep(0.0, 1.6, timer)
	var active := studio_group if phase == "studio" else title_group
	active.rotation.y = lerpf(-0.42, -0.025, reveal)
	active.rotation.x = lerpf(0.10, 0.0, reveal)
	active.position.z = lerpf(-1.1, 0.0, reveal)
	key_light.position.x = lerpf(-3.2, 2.4, minf(timer / 4.0, 1.0))
	if phase == "studio":
		emblem_ring.rotation.z = lerpf(-0.14, 0.0, reveal)
	if phase == "title" and timer >= 0.9:
		city_text.show()
