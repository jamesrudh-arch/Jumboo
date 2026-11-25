extends Node3D

# Licensed interim human rig. This is not the final Marcus character design.
var players: Array[AnimationPlayer] = []
var current_clip := ""

func _ready() -> void:
	for path in ["res://assets/characters/body_m_animated.glb", "res://assets/characters/outfit_m_animated.glb"]:
		var model := (load(path) as PackedScene).instantiate()
		add_child(model)
		for node in model.find_children("*", "AnimationPlayer", true, false):
			players.append(node as AnimationPlayer)
		for mesh in model.find_children("*", "MeshInstance3D", true, false):
			_color_mesh(mesh as MeshInstance3D, path.contains("outfit"))
	play_motion("Idle")

func _color_mesh(mesh: MeshInstance3D, clothed: bool) -> void:
	var mat := StandardMaterial3D.new()
	var n := String(mesh.name).to_lower()
	if clothed:
		mat.albedo_color = Color("333e46") if n.contains("body") or n.contains("arms") else Color("1d2932")
	elif n.contains("eyes"):
		mat.albedo_color = Color("c5b7aa")
	elif n.contains("brow"):
		mat.albedo_color = Color("211917")
	else:
		mat.albedo_color = Color("805846")
	mat.roughness = 0.85
	mesh.material_override = mat

func play_motion(name: String) -> void:
	if name == current_clip:
		return
	current_clip = name
	for p in players:
		if p.has_animation(name):
			p.play(name, 0.18)
