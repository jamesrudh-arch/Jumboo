extends CharacterBody3D

# Licensed interim human rig. This is not the final Marcus character design.
var players: Array[AnimationPlayer] = []
var current_clip := ""
# Provisional palette, set before the rig enters the tree.
var coat_color := Color("333e46")
# Rocketbox characters are interim licensed models, not final bespoke cast.
# The separate phone pickup currently depends on the older skeleton.
var use_legacy_rig := false
var model_path := "res://assets/characters/rocketbox/andre_casual.glb"

func _ready() -> void:
	# Invisible collision shell; visual characters remain the authored meshes.
	motion_mode = CharacterBody3D.MOTION_MODE_FLOATING
	collision_layer = 2
	collision_mask = 1
	var collision := CollisionShape3D.new()
	var shape := CapsuleShape3D.new()
	shape.radius = 0.32
	shape.height = 1.65
	collision.shape = shape
	collision.position.y = 0.85
	add_child(collision)
	if use_legacy_rig:
		for path in ["res://assets/characters/body_m_animated.glb", "res://assets/characters/outfit_m_animated.glb"]:
			var model := (load(path) as PackedScene).instantiate()
			add_child(model)
			for node in model.find_children("*", "AnimationPlayer", true, false):
				players.append(node as AnimationPlayer)
			for mesh in model.find_children("*", "MeshInstance3D", true, false):
				_color_mesh(mesh as MeshInstance3D, path.contains("outfit"))
	else:
		var scene := load(model_path) as PackedScene
		if scene == null:
			push_error("Character model failed to load: " + model_path)
			return
		var model := scene.instantiate()
		model.name = "HumanModel"
		add_child(model)
		for node in model.find_children("*", "AnimationPlayer", true, false):
			players.append(node as AnimationPlayer)
		# These files contain several alternate outfits in the same GLB. Show
		# the original outfit only; hide overlapping shirt/formal variants.
		for item in model.find_children("*", "MeshInstance3D", true, false):
			var mesh := item as MeshInstance3D
			var n := String(mesh.name)
			mesh.visible = n in ["Body", "Hair", "Outfit_original", "Skin_original"]
			mesh.extra_cull_margin = 3.0
	play_motion("Idle")

func _color_mesh(mesh: MeshInstance3D, clothed: bool) -> void:
	var mat := StandardMaterial3D.new()
	var n := String(mesh.name).to_lower()
	if clothed:
		mat.albedo_color = coat_color if n.contains("body") or n.contains("arms") else coat_color.darkened(0.32)
	elif n.contains("eyes"):
		mat.albedo_color = Color("c5b7aa")
	elif n.contains("brow"):
		mat.albedo_color = Color("211917")
	else:
		mat.albedo_color = Color("805846")
	mat.roughness = 0.85
	# Avoid aggressively culling animated extremities outside the rest-pose AABB.
	mesh.extra_cull_margin = 2.0
	mesh.material_override = mat

func play_motion(name: String) -> void:
	if name == current_clip:
		return
	current_clip = name
	# Rocketbox has no combat clips: this is a temporary gesture, not an
	# authored punch or hit reaction. Idle/walk are native mocap clips.
	var clip := name
	if not use_legacy_rig:
		if name == "Punch_Jab":
			clip = "Argue"
		elif name == "Hit_Chest":
			clip = "Shrug"
	for p in players:
		if p.has_animation(clip):
			p.play(clip, 0.18)
