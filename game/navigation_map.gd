extends Control

# A schematic of the currently playable block, in the same x/z coordinates as
# the world. The line is a bearing, not an obstacle-aware route.
var player_position := Vector3.ZERO
var player_heading := 0.0
var target_position := Vector3.ZERO
var has_target := false
var target_name := ""
var expanded := false

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_expanded(false)

func set_expanded(value: bool) -> void:
	expanded = value
	size = Vector2(340, 300) if expanded else Vector2(190, 170)
	position = Vector2(900, 190) if expanded else Vector2(1050, 190)
	queue_redraw()

func set_navigation(player: Vector3, heading: float, target: Vector3, name: String, active: bool) -> void:
	player_position = player
	player_heading = heading
	target_position = target
	target_name = name
	has_target = active
	queue_redraw()

func _map_point(world: Vector3) -> Vector2:
	var inner := Rect2(Vector2(12, 30), size - Vector2(24, 42))
	return inner.position + Vector2((world.x + 12.0) / 24.0 * inner.size.x, (world.z + 15.0) / 36.0 * inner.size.y)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.025, 0.045, 0.06, 0.91), true)
	draw_rect(Rect2(Vector2.ZERO, size), Color("6d989c"), false, 1.5)
	var top_left := _map_point(Vector3(-3.75, 0, -14.0))
	var bottom_right := _map_point(Vector3(3.75, 0, 21.0))
	draw_rect(Rect2(top_left, bottom_right - top_left), Color("34434a"))
	for x in [-8.0, 8.0]:
		for z in [-9.0, -3.0, 3.0]:
			var a := _map_point(Vector3(x - 2.0, 0, z - 2.5))
			var b := _map_point(Vector3(x + 2.0, 0, z + 2.5))
			draw_rect(Rect2(a, b - a), Color("53666a"))
	var warehouse_a := _map_point(Vector3(-4.0, 0, 15.0))
	var warehouse_b := _map_point(Vector3(4.0, 0, 21.0))
	draw_rect(Rect2(warehouse_a, warehouse_b - warehouse_a), Color("796b59"), false, 2.0)
	var dot := _map_point(player_position)
	if has_target:
		var goal := _map_point(target_position)
		draw_line(dot, goal, Color(1.0, 0.80, 0.36, 0.55), 1.5, true)
		draw_circle(goal, 5.0, Color("ffd678"))
		draw_arc(goal, 8.0, 0, TAU, 24, Color("fff1cc"), 1.5, true)
	var forward := Vector2(sin(player_heading), cos(player_heading))
	var side := Vector2(-forward.y, forward.x)
	draw_colored_polygon(PackedVector2Array([dot + forward * 8.0, dot - forward * 5.0 + side * 5.0, dot - forward * 5.0 - side * 5.0]), Color("b5f3f2"))
	var font := get_theme_default_font()
	draw_string(font, Vector2(10, 20), "DISTRICT  /  N ↑", HORIZONTAL_ALIGNMENT_LEFT, size.x - 20, 14, Color("d7ebeb"))
	if has_target:
		var distance := Vector2(player_position.x - target_position.x, player_position.z - target_position.z).length()
		draw_string(font, Vector2(12, size.y - 8), "%s  •  %.0f m" % [target_name, distance], HORIZONTAL_ALIGNMENT_LEFT, size.x - 24, 13, Color("ffe2a0"))
