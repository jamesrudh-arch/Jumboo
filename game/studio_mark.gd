extends Control

# Original geometric monogram, not a stock logo.
func _draw() -> void:
	var ink := Color("e6f4f2")
	var cyan := Color("7fe2df")
	draw_line(Vector2(8, 12), Vector2(8, 70), ink, 4.0)
	draw_line(Vector2(8, 12), Vector2(40, 12), ink, 4.0)
	draw_line(Vector2(8, 70), Vector2(40, 70), ink, 4.0)
	draw_arc(Vector2(38, 41), 29, -PI / 2, PI / 2, 36, ink, 4.0, true)
	draw_line(Vector2(46, 18), Vector2(66, 41), cyan, 4.0)
	draw_line(Vector2(66, 41), Vector2(82, 18), cyan, 4.0)
	draw_line(Vector2(66, 41), Vector2(66, 70), cyan, 4.0)
