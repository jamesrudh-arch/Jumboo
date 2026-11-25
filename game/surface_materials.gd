extends RefCounted

# Original 2K CC0 color, OpenGL normal and roughness maps: see assets/materials/README.md.
# Shared resources avoid loading a new copy for every surface.
static var wood: StandardMaterial3D
static var concrete: StandardMaterial3D
static var wet_concrete: StandardMaterial3D
static var asphalt: StandardMaterial3D

static func get_wood() -> StandardMaterial3D:
	if wood == null:
		wood = _make("brown_planks", 0.85)
	return wood

static func get_concrete(wet := false) -> StandardMaterial3D:
	if wet:
		if wet_concrete == null:
			wet_concrete = _make("concrete", 0.38)
		return wet_concrete
	if concrete == null:
		concrete = _make("concrete", 0.9)
	return concrete

static func get_asphalt() -> StandardMaterial3D:
	if asphalt == null:
		asphalt = _make("asphalt", 0.48)
	return asphalt

static func _make(name: String, roughness: float) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.albedo_texture = load("res://assets/materials/" + name + "_diff.jpg")
	mat.normal_enabled = true
	mat.normal_texture = load("res://assets/materials/" + name + "_nor_gl.jpg")
	mat.roughness_texture = load("res://assets/materials/" + name + "_rough.jpg")
	mat.roughness = roughness
	mat.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return mat
