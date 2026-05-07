extends Node
class_name Game

var btn = Button.new()

func _ready():
	btn.pressed.connect(_on_pressed)
	var label = Label.new()
	label.text = "Hello"

func _on_pressed():
	print("Button pressed")