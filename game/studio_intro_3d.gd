extends Node3D

# Approved GLB geometry, shown as an isolated real-time 3D opening shot.
# The lighting/motion are an in-engine interpretation, not the offline render.
var camera: Camera3D
var studio_group: Node3D
var title_group: Node3D
var city_text: Node3D
var tagline: Node3D
var icon: Node3D
var key_light: OmniLight3D
var ident: AudioStreamPlayer
var timer := 0.0
var phase := "studio"

func _ready() -> void:
	var bg := MeshInstance3D.new()
	var plane := QuadMesh.new()
	plane.size = Vector2(40, 25)
	bg.mesh = plane
	bg.position = Vector3(0, 2.5, -3)
	var material := StandardMaterial3D.new()
	material.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	material.albedo_color = Color("10171d") # Approved Ink token.
	bg.material_override = material
	add_child(bg)
	studio_group = preload("res://assets/brand/dyoungs_studio_mark_3d.glb").instantiate()
	studio_group.name = "ApprovedStudioMark"
	add_child(studio_group)
	title_group = preload("res://assets/brand/leverage_custom_3d.glb").instantiate()
	title_group.name = "ApprovedLeverageWordmark"
	add_child(title_group)
	city_text = title_group.get_node_or_null("Cinder City")
	tagline = title_group.get_node_or_null("Tagline")
	icon = preload("res://assets/brand/leverage_icon_3d.glb").instantiate()
	icon.name = "ApprovedFulcrumIcon"
	# The icon is separate from the wordmark and appears after the title.
	icon.scale = Vector3.ONE * 0.34
	icon.position = Vector3(5.0, 1.15, 0)
	title_group.add_child(icon)
	title_group.hide()
	key_light = OmniLight3D.new()
	key_light.position = Vector3(-4, 5, 6)
	key_light.light_color = Color("d9e7ef")
	key_light.light_energy = 3.0
	key_light.omni_range = 24
	add_child(key_light)
	var rim := OmniLight3D.new()
	rim.position = Vector3(5, 4, 3)
	rim.light_color = Color("e0b77e") # Approved Amber token.
	rim.light_energy = 2.5
	rim.omni_range = 24
	add_child(rim)
	camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 6.8
	add_child(camera)
	_update_camera()
	camera.make_current()
	ident = AudioStreamPlayer.new()
	ident.stream = preload("res://assets/brand/dyoungs_studio_sting.wav")
	ident.volume_db = -4.0
	add_child(ident)
	ident.play()

func reveal_title() -> void:
	phase = "title"
	timer = 0.0
	studio_group.hide()
	title_group.show()
	if city_text: city_text.hide()
	if tagline: tagline.hide()
	icon.hide()
	ident.stream = preload("res://assets/brand/leverage_title_sting.wav")
	ident.play()
	_update_camera()

func _update_camera() -> void:
	var progress := smoothstep(0.0, 1.0, clampf(timer / 4.0, 0.0, 1.0))
	var angle := lerpf(0.34, 0.0, progress)
	var target := Vector3(0, 2.45 if phase == "studio" else 2.85, 0)
	camera.position = target + Vector3(18.0 * sin(angle), lerpf(0.8, 0.2, progress), 18.0 * cos(angle))
	camera.look_at(to_global(target), Vector3.UP)

func _process(delta: float) -> void:
	timer += delta
	_update_camera()
	key_light.position.x = lerpf(5.0, -4.0, clampf(timer / 4.0, 0.0, 1.0))
	if phase == "title":
		if timer >= 0.9 and city_text: city_text.show()
		if timer >= 1.7 and tagline: tagline.show()
		if timer >= 2.5: icon.show()
