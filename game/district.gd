extends Node3D

# Interim, walk-through district set. Store names are proposed, not locked canon.
# Each storefront has an open entrance and a distinct interior; there is no
# collision/navigation or final city art in this prototype.
func _ready() -> void:
	_shop(1, -9.0, "HARBOR ELECTRIC", "3e5861", "d7aa73", 0)
	_shop(1, -3.0, "SALT & TEA", "705a4a", "b9b08e", 1)
	_shop(1, 3.0, "NIGHT PHARMACY", "4f645c", "bac8b8", 2)
	_shop(-1, -9.0, "CINDER MARKET", "705c53", "cfaa73", 1)
	_shop(-1, -3.0, "PAPER & WIRE", "535b68", "d4c4a1", 0)
	_shop(-1, 3.0, "DOCKSIDE REPAIR", "605b50", "d4a86e", 2)
	for z in [-11.0, 0.0, 10.0]:
		_streetlight(5.0, z)
	_prop("road_barrier", Vector3(4.5, 0, 10.8), 0.7)
	_prop("plastic_crate", Vector3(-4.7, 0, -6.8), 0.8)
	_prop("aircon_unit", Vector3(9.8, 3.8, -3.0), 0.7)
	_hideout()
	_harbor()

func _shop(side: int, z: float, name: String, wall: String, accent: String, style: int) -> void:
	var x := float(side)
	# Back wall and side returns deliberately leave the front open.
	_box(Vector3(0.18, 3.2, 5.2), Vector3(x * 10.0, 1.6, z), wall)
	for edge in [-2.6, 2.6]:
		_box(Vector3(4.0, 3.2, 0.18), Vector3(x * 8.0, 1.6, z + edge), wall)
		_box(Vector3(0.22, 2.8, 0.22), Vector3(x * 6.0, 1.4, z + edge), accent)
	_box(Vector3(4.2, 0.18, 5.35), Vector3(x * 8.0, 3.2, z), "293138")
	# Different upper-storey heights, window patterns and roofs.
	var height := 2.0 + 0.8 * float(style)
	_box(Vector3(4.0, height, 5.2), Vector3(x * 8.0, 3.3 + height * 0.5, z), wall)
	_box(Vector3(4.2, 0.16, 5.4), Vector3(x * 8.0, 3.3 + height, z), "263139")
	for offset in [-1.65, 0.0, 1.65]:
		_box(Vector3(0.035, 1.1, 0.80 + 0.15 * style), Vector3(x * 5.97, 4.2, z + offset), "77959a", true)
	# Front awning, sign, and a visible counter inside the opening.
	_box(Vector3(1.1, 0.09, 4.8), Vector3(x * 5.7, 2.65, z), accent)
	_box(Vector3(0.10, 0.52, 4.25), Vector3(x * 6.0, 2.93, z), "202d32")
	var label := Label3D.new()
	label.text = name
	label.font = load("res://assets/fonts/BebasNeue-Regular.ttf")
	label.font_size = 48
	label.pixel_size = 0.006
	label.modulate = Color("e7d4ad")
	label.outline_size = 2
	label.shaded = false
	label.position = Vector3(x * 5.93, 2.94, z)
	label.rotation.y = -x * PI * 0.5
	add_child(label)
	_box(Vector3(0.8, 0.80, 2.8), Vector3(x * 8.4, 0.40, z), accent)
	for i in 4:
		var depth := -1.05 + i * 0.65
		var product: String = ["a9b5a4", "aa715b", "d5b679", "708a8b"][(i + style) % 4]
		_box(Vector3(0.22, 0.22 + 0.07 * (i % 2), 0.18), Vector3(x * 8.4, 0.94, z + depth), product)
	for level in [1.2, 1.9]:
		_box(Vector3(0.65, 0.07, 3.6), Vector3(x * 9.5, level, z), "9b8d73")
		for i in 5:
			_box(Vector3(0.16, 0.20, 0.20), Vector3(x * 9.5, level + 0.14, z - 1.2 + i * 0.6), accent)
	var glow := OmniLight3D.new()
	glow.position = Vector3(x * 7.2, 2.45, z)
	glow.light_color = Color("ffd6a2") if style == 1 else Color("bedcdd")
	glow.light_energy = 0.7
	glow.omni_range = 4.0
	add_child(glow)

func _streetlight(x: float, z: float) -> void:
	_box(Vector3(0.12, 4.6, 0.12), Vector3(x, 2.3, z), "485156")
	_box(Vector3(0.8, 0.08, 0.12), Vector3(x - 0.35, 4.5, z), "536064")
	_box(Vector3(0.3, 0.05, 0.25), Vector3(x - 0.7, 4.43, z), "e8c999", true)
	var lamp := OmniLight3D.new()
	lamp.position = Vector3(x - 0.7, 4.2, z)
	lamp.light_color = Color("ffd4a1")
	lamp.light_energy = 1.0
	lamp.omni_range = 6.0
	add_child(lamp)

func _hideout() -> void:
	# An open-backed cutaway keeps the third-person camera from clipping a wall.
	for side in [-1.0, 1.0]:
		_box(Vector3(0.20, 3.6, 6.4), Vector3(side * 4.0, 1.8, 18.0), "485054")
		for z in [15.0, 18.0, 21.0]:
			_box(Vector3(0.26, 3.8, 0.26), Vector3(side * 3.8, 1.9, z), "72766e")
	_box(Vector3(8.1, 0.28, 0.3), Vector3(0, 3.55, 15.0), "6b716b")
	_box(Vector3(8.0, 0.04, 6.0), Vector3(0, 0.10, 18.0), "4a4e4b")
	_box(Vector3(2.4, 0.12, 0.8), Vector3(-2.5, 0.9, 19.4), "756550")
	for x in [-3.5, -1.5]:
		_box(Vector3(0.10, 0.9, 0.10), Vector3(x, 0.45, 19.4), "394343")
	_prop("generator", Vector3(2.5, 0, 19.6), 0.8)
	_prop("jerrycan", Vector3(2.1, 0, 18.5), 0.8)
	_prop("wooden_crate", Vector3(-3.0, 0, 16.4), 0.8)
	_prop("covered_car", Vector3(1.8, 0, 16.5), 0.55)
	_prop("barrel", Vector3(-3.3, 0, 20.1), 0.7)
	var lamp := OmniLight3D.new()
	lamp.position = Vector3(0, 3.1, 17.6)
	lamp.light_color = Color("ffcc95")
	lamp.light_energy = 1.25
	lamp.omni_range = 7
	add_child(lamp)

func _harbor() -> void:
	# Distant harbor silhouettes set the city context; not a navigable waterfront.
	_box(Vector3(65, 0.08, 14), Vector3(0, -0.05, -22), "263e4d")
	for i in 15:
		var x := -28.0 + i * 4.0
		var height := 6.0 + float((i * 11) % 10) * 1.2
		_box(Vector3(2.9, height, 2.8), Vector3(x, height * 0.5, -30), "263740")
		for level in 3:
			_box(Vector3(2.3, 0.08, 0.05), Vector3(x, 2.0 + level * 1.6, -28.57), "90a6a1", true)
	# Freighter, containers and crane silhouette, separate 3D geometry.
	_box(Vector3(13, 1.0, 2.2), Vector3(-12, 0.55, -21), "37434b")
	for i in 4:
		_box(Vector3(2.0, 1.1, 1.7), Vector3(-16 + i * 2.6, 1.55, -21), ["6a564b", "465d63", "6a6652", "4b5664"][i])
	for x in [-24.0, 17.0]:
		_box(Vector3(0.25, 10, 0.25), Vector3(x, 5, -25), "586a6b")
		_box(Vector3(7.0, 0.18, 0.18), Vector3(x + 3.0, 9.9, -25), "586a6b")

func _prop(asset: String, pos: Vector3, factor: float) -> void:
	var node := (load("res://assets/props/" + asset + ".glb") as PackedScene).instantiate() as Node3D
	node.position = pos
	node.scale = Vector3.ONE * factor
	add_child(node)

func _box(size: Vector3, pos: Vector3, hex: String, unlit := false) -> MeshInstance3D:
	var node := MeshInstance3D.new()
	var mesh := BoxMesh.new()
	mesh.size = size
	node.mesh = mesh
	node.position = pos
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(hex)
	mat.roughness = 0.82
	if unlit:
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	node.material_override = mat
	add_child(node)
	return node
